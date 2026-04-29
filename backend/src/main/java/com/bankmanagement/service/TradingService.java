package com.bankmanagement.service;

import com.bankmanagement.model.Asset;
import com.bankmanagement.model.Trade;
import com.bankmanagement.repository.AssetRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class TradingService {

    private static final BigDecimal MAX_ORDER_NOTIONAL = BigDecimal.valueOf(250_000);
    /** Starting USD cash for the anonymous simulation session (paper money). */
    private static final BigDecimal SESSION_STARTING_CASH = BigDecimal.valueOf(100_000);
    private static final int MAX_ORDERS_PER_10S = 40;
    /** Anonymous simulation session — no login or persisted user row required. */
    private static final long SIMULATION_USER_ID = 1L;
    private static final int MAX_TRADES_IN_MEMORY = 20_000;
    private static final int MAX_TAPE_ENTRIES = 200;

    private final AssetRepository assetRepository;

    private final List<Trade> simulatedTrades = new ArrayList<>();
    private final AtomicLong syntheticTradeIds = new AtomicLong(1);

    private final Map<Long, ArrayDeque<Long>> recentOrderTimestamps = new ConcurrentHashMap<>();
    private final ArrayDeque<Map<String, Object>> fraudAlerts = new ArrayDeque<>();
    private final AtomicLong processedOrders = new AtomicLong(0);
    private final AtomicLong rejectedOrders = new AtomicLong(0);
    private final AtomicLong retriesUsed = new AtomicLong(0);
    private final ArrayDeque<Map<String, Object>> timeAndSales = new ArrayDeque<>();
    private final AtomicLong restingOrderIds = new AtomicLong(1);

    private final Object restingBookLock = new Object();
    private final List<RestingOrder> restingOrders = new ArrayList<>();
    /** Simulated user: quantity tied up in open sell limits (cannot double-spend the same shares). */
    private final Map<Long, BigDecimal> restingSellQtyByAssetId = new HashMap<>();

    public TradingService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    /**
     * Places a market or limit order for the anonymous simulation user.
     *
     * @param orderType "MARKET" (default) or "LIMIT"
     * @param limitPrice required when orderType is LIMIT
     */
    public Map<String, Object> placeOrder(String symbol, String side, BigDecimal quantity, String orderType, BigDecimal limitPrice) {
        Long userId = SIMULATION_USER_ID;
        validateOrderRate(userId);
        validateQuantity(quantity);

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase())
            .orElseThrow(() -> new IllegalArgumentException("Unknown symbol: " + symbol));
        Trade.TradeType tradeType = Trade.TradeType.valueOf(side.toUpperCase());
        boolean isLimit = orderType != null && "LIMIT".equalsIgnoreCase(orderType.trim());

        if (tradeType == Trade.TradeType.SELL) {
            validateSellAgainstPosition(userId, asset.getAssetId(), quantity);
        }

        if (isLimit) {
            if (limitPrice == null || limitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Limit orders require a positive limitPrice.");
            }
            return placeLimitOrder(userId, asset, tradeType, quantity, limitPrice);
        }

        BigDecimal executionPrice = asset.getCurrentPrice();
        BigDecimal totalAmount = executionPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        BigDecimal commission = totalAmount.multiply(BigDecimal.valueOf(0.0015)).setScale(2, RoundingMode.HALF_UP);

        if (totalAmount.compareTo(MAX_ORDER_NOTIONAL) > 0) {
            rejectedOrders.incrementAndGet();
            recordFraudAlert(userId, symbol, "MAX_NOTIONAL_EXCEEDED", "Order notional exceeded configured limit.");
            throw new IllegalArgumentException("Order blocked by risk engine: notional exceeds max allowed.");
        }

        if (tradeType == Trade.TradeType.BUY && !hasCashForBuy(userId, totalAmount.add(commission))) {
            throw new IllegalArgumentException("Insufficient cash for this buy order.");
        }

        Trade savedTrade = executeWithRetry(userId, asset, tradeType, quantity, executionPrice, totalAmount, commission);
        processedOrders.incrementAndGet();

        return toExecutionMap(asset.getSymbol(), savedTrade, null);
    }

    /** Called after each market tick so resting limits can fill against streamed prices. */
    public void onMarketPrice(String symbol, BigDecimal lastPrice) {
        if (symbol == null || lastPrice == null) {
            return;
        }
        String sym = symbol.toUpperCase();
        List<RestingOrder> snapshot;
        synchronized (restingBookLock) {
            snapshot = new ArrayList<>();
            for (RestingOrder o : restingOrders) {
                if (o.symbol.equals(sym)) {
                    snapshot.add(o);
                }
            }
        }

        for (RestingOrder o : snapshot) {
            boolean buyHit = o.side == Trade.TradeType.BUY && lastPrice.compareTo(o.limitPrice) <= 0;
            boolean sellHit = o.side == Trade.TradeType.SELL && lastPrice.compareTo(o.limitPrice) >= 0;
            if (!buyHit && !sellHit) {
                continue;
            }

            Asset asset = assetRepository.findById(o.assetId).orElse(null);
            if (asset == null) {
                continue;
            }
            BigDecimal fillPrice = lastPrice.setScale(4, RoundingMode.HALF_UP);
            BigDecimal totalAmount = fillPrice.multiply(o.quantity).setScale(2, RoundingMode.HALF_UP);
            BigDecimal commission = totalAmount.multiply(BigDecimal.valueOf(0.0015)).setScale(2, RoundingMode.HALF_UP);
            if (totalAmount.compareTo(MAX_ORDER_NOTIONAL) > 0) {
                continue;
            }
            if (o.side == Trade.TradeType.BUY && !hasCashForBuy(o.userId, totalAmount.add(commission))) {
                continue;
            }
            if (o.side == Trade.TradeType.SELL) {
                try {
                    validateSellAgainstPosition(o.userId, o.assetId, o.quantity);
                } catch (IllegalArgumentException ex) {
                    continue;
                }
            }

            boolean removed;
            synchronized (restingBookLock) {
                removed = restingOrders.remove(o);
                if (removed && o.side == Trade.TradeType.SELL) {
                    releaseRestingSell(o.assetId, o.quantity);
                }
            }
            if (!removed) {
                continue;
            }

            Trade t = executeDirectFill(o.userId, asset, o.side, o.quantity, fillPrice, totalAmount, commission,
                "Limit filled on streamed price");
            if (t != null) {
                processedOrders.incrementAndGet();
            }
        }
    }

    public List<Map<String, Object>> getWorkingOrders() {
        synchronized (restingBookLock) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (RestingOrder o : restingOrders) {
                Map<String, Object> row = new HashMap<>();
                row.put("restingOrderId", o.restingId);
                row.put("symbol", o.symbol);
                row.put("side", o.side.name());
                row.put("quantity", o.quantity);
                row.put("limitPrice", o.limitPrice);
                row.put("placedAt", o.placedAt != null
                    ? o.placedAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    : null);
                out.add(row);
            }
            return out;
        }
    }

    private Map<String, Object> placeLimitOrder(Long userId, Asset asset, Trade.TradeType tradeType,
                                                 BigDecimal quantity, BigDecimal limitPrice) {
        BigDecimal mid = asset.getCurrentPrice();
        BigDecimal notionalCap = limitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        if (notionalCap.compareTo(MAX_ORDER_NOTIONAL) > 0) {
            rejectedOrders.incrementAndGet();
            throw new IllegalArgumentException("Order blocked by risk engine: limit notional exceeds max allowed.");
        }

        boolean marketableBuy = tradeType == Trade.TradeType.BUY && mid.compareTo(limitPrice) <= 0;
        boolean marketableSell = tradeType == Trade.TradeType.SELL && mid.compareTo(limitPrice) >= 0;

        if (marketableBuy || marketableSell) {
            BigDecimal executionPrice = mid.setScale(4, RoundingMode.HALF_UP);
            BigDecimal totalAmount = executionPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
            BigDecimal commission = totalAmount.multiply(BigDecimal.valueOf(0.0015)).setScale(2, RoundingMode.HALF_UP);
            if (tradeType == Trade.TradeType.BUY && !hasCashForBuy(userId, totalAmount.add(commission))) {
                throw new IllegalArgumentException("Insufficient cash for this buy order.");
            }
            Trade savedTrade = executeWithRetry(userId, asset, tradeType, quantity, executionPrice, totalAmount, commission);
            processedOrders.incrementAndGet();
            return toExecutionMap(asset.getSymbol(), savedTrade, null);
        }

        if (tradeType == Trade.TradeType.BUY) {
            BigDecimal worst = limitPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
            BigDecimal worstComm = worst.multiply(BigDecimal.valueOf(0.0015)).setScale(2, RoundingMode.HALF_UP);
            if (!hasCashForBuy(userId, worst.add(worstComm))) {
                throw new IllegalArgumentException("Insufficient cash to rest this buy limit at the given price.");
            }
        }

        RestingOrder resting = new RestingOrder(
            restingOrderIds.getAndIncrement(),
            userId,
            asset.getAssetId(),
            asset.getSymbol(),
            tradeType,
            quantity,
            limitPrice,
            LocalDateTime.now()
        );
        synchronized (restingBookLock) {
            if (tradeType == Trade.TradeType.SELL) {
                validateSellAgainstPositionAndResting(userId, asset.getAssetId(), quantity);
            }
            restingOrders.add(resting);
            if (tradeType == Trade.TradeType.SELL) {
                restingSellQtyByAssetId.merge(asset.getAssetId(), quantity, BigDecimal::add);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("tradeId", null);
        response.put("symbol", asset.getSymbol());
        response.put("side", tradeType);
        response.put("quantity", quantity);
        response.put("price", null);
        response.put("totalAmount", null);
        response.put("commission", null);
        response.put("status", "RESTING");
        response.put("executedAt", null);
        response.put("restingOrderId", resting.restingId);
        response.put("limitPrice", limitPrice);
        return response;
    }

    private Map<String, Object> toExecutionMap(String symbol, Trade savedTrade, Long restingId) {
        Map<String, Object> response = new HashMap<>();
        response.put("tradeId", savedTrade.getTradeId());
        response.put("symbol", symbol);
        response.put("side", savedTrade.getTradeType());
        response.put("quantity", savedTrade.getQuantity());
        response.put("price", savedTrade.getPricePerUnit());
        response.put("totalAmount", savedTrade.getTotalAmount());
        response.put("commission", savedTrade.getCommission());
        response.put("status", savedTrade.getStatus() != null ? savedTrade.getStatus().name() : "UNKNOWN");
        response.put("executedAt", savedTrade.getExecutedAt());
        response.put("restingOrderId", restingId);
        response.put("limitPrice", null);
        return response;
    }

    private boolean hasCashForBuy(Long userId, BigDecimal required) {
        return computeSessionCash(userId).compareTo(required) >= 0;
    }

    private void validateSellAgainstPosition(Long userId, Long assetId, BigDecimal quantity) {
        BigDecimal pos = getNetPosition(userId, assetId);
        if (pos.compareTo(quantity) < 0) {
            throw new IllegalArgumentException(
                "Insufficient position to sell (have " + pos.stripTrailingZeros().toPlainString() + ").");
        }
    }

    private void validateSellAgainstPositionAndResting(Long userId, Long assetId, BigDecimal quantity) {
        BigDecimal pos = getNetPosition(userId, assetId);
        BigDecimal tied = getRestingSellExposure(assetId);
        BigDecimal available = pos.subtract(tied);
        if (available.compareTo(quantity) < 0) {
            throw new IllegalArgumentException(
                "Insufficient shares available for this sell limit (open sell limits tie up inventory).");
        }
    }

    private BigDecimal getNetPosition(Long userId, Long assetId) {
        synchronized (simulatedTrades) {
            BigDecimal net = BigDecimal.ZERO;
            for (Trade t : simulatedTrades) {
                if (!userId.equals(t.getUserId()) || t.getStatus() != Trade.TradeStatus.COMPLETED) {
                    continue;
                }
                if (!assetId.equals(t.getAssetId())) {
                    continue;
                }
                BigDecimal delta = t.getTradeType() == Trade.TradeType.BUY
                    ? t.getQuantity()
                    : t.getQuantity().negate();
                net = net.add(delta);
            }
            return net.setScale(8, RoundingMode.HALF_UP);
        }
    }

    private BigDecimal getRestingSellExposure(Long assetId) {
        synchronized (restingBookLock) {
            return restingSellQtyByAssetId.getOrDefault(assetId, BigDecimal.ZERO);
        }
    }

    private void releaseRestingSell(Long assetId, BigDecimal qty) {
        restingSellQtyByAssetId.compute(assetId, (k, v) -> {
            if (v == null) {
                return null;
            }
            BigDecimal next = v.subtract(qty);
            return next.compareTo(BigDecimal.ZERO) <= 0 ? null : next;
        });
    }

    private Trade executeDirectFill(Long userId,
                                    Asset asset,
                                    Trade.TradeType tradeType,
                                    BigDecimal quantity,
                                    BigDecimal executionPrice,
                                    BigDecimal totalAmount,
                                    BigDecimal commission,
                                    String notes) {
        Trade trade = new Trade();
        trade.setUserId(userId);
        trade.setAssetId(asset.getAssetId());
        trade.setTradeType(tradeType);
        trade.setQuantity(quantity);
        trade.setPricePerUnit(executionPrice);
        trade.setTotalAmount(totalAmount);
        trade.setCommission(commission);
        trade.setExecutedAt(LocalDateTime.now());
        trade.setStatus(Trade.TradeStatus.COMPLETED);
        trade.setNotes(notes);
        persistSimulatedTrade(trade, asset.getSymbol());
        return trade;
    }

    private record RestingOrder(
        long restingId,
        long userId,
        long assetId,
        String symbol,
        Trade.TradeType side,
        BigDecimal quantity,
        BigDecimal limitPrice,
        LocalDateTime placedAt
    ) {
    }

    /**
     * Recent orders enriched with `symbol` and epoch-millis `executedAt` so the dashboard
     * doesn't have to look up symbols from the asset list or parse LocalDateTime.
     */
    public List<Map<String, Object>> getRecentOrders() {
        List<Trade> trades;
        synchronized (simulatedTrades) {
            trades = simulatedTrades.stream()
                .filter(t -> Objects.equals(SIMULATION_USER_ID, t.getUserId()))
                .sorted(Comparator.comparing(Trade::getExecutedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(50)
                .toList();
        }

        Map<Long, String> symbolByAssetId = new HashMap<>();
        List<Map<String, Object>> out = new ArrayList<>(trades.size());
        for (Trade t : trades) {
            String symbol = symbolByAssetId.computeIfAbsent(t.getAssetId(),
                id -> assetRepository.findById(id).map(Asset::getSymbol).orElse("#" + id));

            Map<String, Object> row = new HashMap<>();
            row.put("tradeId", t.getTradeId());
            row.put("assetId", t.getAssetId());
            row.put("symbol", symbol);
            row.put("tradeType", t.getTradeType() != null ? t.getTradeType().name() : null);
            row.put("quantity", t.getQuantity());
            row.put("pricePerUnit", t.getPricePerUnit());
            row.put("totalAmount", t.getTotalAmount());
            row.put("commission", t.getCommission());
            row.put("status", t.getStatus() != null ? t.getStatus().name() : null);
            row.put("notes", t.getNotes());
            row.put("executedAt", t.getExecutedAt() != null
                ? t.getExecutedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : null);
            out.add(row);
        }
        return out;
    }

    public Map<String, Object> getPortfolioSummary() {
        Long userId = SIMULATION_USER_ID;
        List<Map<String, Object>> grouped = summarizePositionsInMemory(userId);

        List<Map<String, Object>> positions = grouped.stream()
            .map(position -> {
                Long assetId = ((Number) position.get("assetId")).longValue();
                BigDecimal netQuantity = asBigDecimal(position.get("netQuantity"));
                Asset asset = assetRepository.findById(assetId).orElse(null);
                if (asset == null) {
                    return null;
                }

                Map<String, Object> row = new HashMap<>();
                row.put("symbol", asset.getSymbol());
                row.put("assetName", asset.getName());
                row.put("quantity", netQuantity.setScale(6, RoundingMode.HALF_UP));
                row.put("currentPrice", asset.getCurrentPrice());
                row.put("marketValue", asset.getCurrentPrice().multiply(netQuantity).setScale(2, RoundingMode.HALF_UP));
                return row;
            })
            .filter(row -> row != null)
            .toList();

        BigDecimal grossVolume = sumCompletedVolumeInMemory(userId);
        BigDecimal currentValue = positions.stream()
            .map(row -> (BigDecimal) row.get("marketValue"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal sessionCash = computeSessionCash(userId);
        BigDecimal equity = sessionCash.add(currentValue).setScale(2, RoundingMode.HALF_UP);
        BigDecimal sessionPnl = equity.subtract(SESSION_STARTING_CASH).setScale(2, RoundingMode.HALF_UP);

        Map<String, Object> summary = new HashMap<>();
        summary.put("positions", positions);
        summary.put("positionCount", positions.size());
        summary.put("grossVolume", grossVolume);
        summary.put("currentValue", currentValue);
        summary.put("startingCash", SESSION_STARTING_CASH);
        summary.put("cash", sessionCash);
        summary.put("equity", equity);
        summary.put("sessionPnl", sessionPnl);
        summary.put("processedOrders", processedOrders.get());
        summary.put("rejectedOrders", rejectedOrders.get());
        summary.put("retriesUsed", retriesUsed.get());
        return summary;
    }

    public List<Map<String, Object>> getTimeAndSales() {
        synchronized (timeAndSales) {
            return new ArrayList<>(timeAndSales);
        }
    }

    public Map<String, Object> getEngineMetrics() {
        LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
        long recentOrders = countTradesExecutedAfter(tenSecondsAgo);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("processedOrders", processedOrders.get());
        metrics.put("rejectedOrders", rejectedOrders.get());
        metrics.put("retriesUsed", retriesUsed.get());
        metrics.put("ordersLast10Seconds", recentOrders);
        metrics.put("timestamp", Instant.now().toEpochMilli());
        synchronized (restingBookLock) {
            metrics.put("restingOrders", restingOrders.size());
        }
        return metrics;
    }

    public List<Map<String, Object>> getRecentFraudAlerts() {
        synchronized (fraudAlerts) {
            return new ArrayList<>(fraudAlerts);
        }
    }

    public Map<String, Object> buildOrderBook(String symbol) {
        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase())
            .orElseThrow(() -> new IllegalArgumentException("Unknown symbol: " + symbol));

        BigDecimal mid = asset.getCurrentPrice();
        List<Map<String, Object>> bids = new ArrayList<>();
        List<Map<String, Object>> asks = new ArrayList<>();

        BigDecimal bidCum = BigDecimal.ZERO;
        BigDecimal askCum = BigDecimal.ZERO;

        for (int level = 1; level <= 8; level++) {
            BigDecimal spreadFactor = BigDecimal.valueOf(level).multiply(BigDecimal.valueOf(0.0008));
            BigDecimal bidPrice = mid.multiply(BigDecimal.ONE.subtract(spreadFactor)).setScale(4, RoundingMode.HALF_UP);
            BigDecimal askPrice = mid.multiply(BigDecimal.ONE.add(spreadFactor)).setScale(4, RoundingMode.HALF_UP);
            BigDecimal bidQty = BigDecimal.valueOf(Math.max(50, 600 - (level * 45))).setScale(2, RoundingMode.HALF_UP);
            BigDecimal askQty = bidQty.add(BigDecimal.valueOf(level * 4L));

            bidCum = bidCum.add(bidQty);
            askCum = askCum.add(askQty);

            Map<String, Object> bidLevel = new HashMap<>();
            bidLevel.put("price", bidPrice);
            bidLevel.put("quantity", bidQty);
            bidLevel.put("cum", bidCum);
            bids.add(bidLevel);

            Map<String, Object> askLevel = new HashMap<>();
            askLevel.put("price", askPrice);
            askLevel.put("quantity", askQty);
            askLevel.put("cum", askCum);
            asks.add(askLevel);
        }

        BigDecimal bestBid = bids.isEmpty() ? null : (BigDecimal) bids.get(0).get("price");
        BigDecimal bestAsk = asks.isEmpty() ? null : (BigDecimal) asks.get(0).get("price");
        BigDecimal spread = (bestBid != null && bestAsk != null)
            ? bestAsk.subtract(bestBid).setScale(4, RoundingMode.HALF_UP)
            : null;
        BigDecimal depthMax = bidCum.max(askCum);

        Map<String, Object> orderBook = new HashMap<>();
        orderBook.put("symbol", symbol.toUpperCase());
        orderBook.put("midPrice", mid);
        orderBook.put("bestBid", bestBid);
        orderBook.put("bestAsk", bestAsk);
        orderBook.put("spread", spread);
        orderBook.put("depthMax", depthMax);
        orderBook.put("bids", bids);
        orderBook.put("asks", asks);
        orderBook.put("timestamp", Instant.now().toEpochMilli());
        return orderBook;
    }

    private List<Map<String, Object>> summarizePositionsInMemory(Long userId) {
        Map<Long, BigDecimal> netByAsset = new HashMap<>();
        synchronized (simulatedTrades) {
            for (Trade t : simulatedTrades) {
                if (!userId.equals(t.getUserId()) || t.getStatus() != Trade.TradeStatus.COMPLETED) {
                    continue;
                }
                BigDecimal delta = t.getTradeType() == Trade.TradeType.BUY
                    ? t.getQuantity()
                    : t.getQuantity().negate();
                netByAsset.merge(t.getAssetId(), delta, BigDecimal::add);
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : netByAsset.entrySet()) {
            if (e.getValue().compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("assetId", e.getKey());
            row.put("netQuantity", e.getValue());
            out.add(row);
        }
        return out;
    }

    private BigDecimal sumCompletedVolumeInMemory(Long userId) {
        synchronized (simulatedTrades) {
            return simulatedTrades.stream()
                .filter(t -> userId.equals(t.getUserId()) && t.getStatus() == Trade.TradeStatus.COMPLETED)
                .map(Trade::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    /**
     * Paper cash remaining after completed fills: starting balance minus buys (incl. commission) plus sell proceeds (net of commission).
     */
    private BigDecimal computeSessionCash(Long userId) {
        List<Trade> fills;
        synchronized (simulatedTrades) {
            fills = simulatedTrades.stream()
                .filter(t -> userId.equals(t.getUserId()) && t.getStatus() == Trade.TradeStatus.COMPLETED)
                .sorted(Comparator.comparing(Trade::getExecutedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        }
        BigDecimal cash = SESSION_STARTING_CASH;
        for (Trade t : fills) {
            BigDecimal total = t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal comm = t.getCommission() != null ? t.getCommission() : BigDecimal.ZERO;
            if (t.getTradeType() == Trade.TradeType.BUY) {
                cash = cash.subtract(total).subtract(comm);
            } else {
                cash = cash.add(total).subtract(comm);
            }
        }
        return cash.setScale(2, RoundingMode.HALF_UP);
    }

    private long countTradesExecutedAfter(LocalDateTime since) {
        synchronized (simulatedTrades) {
            return simulatedTrades.stream()
                .filter(t -> t.getExecutedAt() != null && t.getExecutedAt().isAfter(since))
                .count();
        }
    }

    private void persistSimulatedTrade(Trade trade, String symbol) {
        synchronized (simulatedTrades) {
            trade.setTradeId(syntheticTradeIds.getAndIncrement());
            simulatedTrades.add(trade);
            while (simulatedTrades.size() > MAX_TRADES_IN_MEMORY) {
                simulatedTrades.remove(0);
            }
        }
        recordTapeEntry(trade, symbol);
    }

    private void recordTapeEntry(Trade trade, String symbol) {
        Map<String, Object> row = new HashMap<>();
        row.put("timestamp", trade.getExecutedAt() != null
            ? trade.getExecutedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : Instant.now().toEpochMilli());
        row.put("tradeId", trade.getTradeId());
        row.put("symbol", symbol);
        row.put("side", trade.getTradeType() != null ? trade.getTradeType().name() : "");
        row.put("quantity", trade.getQuantity());
        row.put("price", trade.getPricePerUnit());
        row.put("status", trade.getStatus() != null ? trade.getStatus().name() : "");
        row.put("notes", trade.getNotes());

        synchronized (timeAndSales) {
            timeAndSales.addFirst(row);
            while (timeAndSales.size() > MAX_TAPE_ENTRIES) {
                timeAndSales.removeLast();
            }
        }
    }

    private Trade executeWithRetry(Long userId,
                                   Asset asset,
                                   Trade.TradeType tradeType,
                                   BigDecimal quantity,
                                   BigDecimal executionPrice,
                                   BigDecimal totalAmount,
                                   BigDecimal commission) {
        int attempt = 0;
        RuntimeException lastError = null;

        while (attempt < 3) {
            try {
                attempt++;

                if (Math.random() < 0.03) {
                    throw new IllegalStateException("Simulated transient matching engine timeout");
                }

                Trade trade = new Trade();
                trade.setUserId(userId);
                trade.setAssetId(asset.getAssetId());
                trade.setTradeType(tradeType);
                trade.setQuantity(quantity);
                trade.setPricePerUnit(executionPrice);
                trade.setTotalAmount(totalAmount);
                trade.setCommission(commission);
                trade.setExecutedAt(LocalDateTime.now());
                trade.setStatus(Trade.TradeStatus.COMPLETED);
                trade.setNotes("Executed via simulation engine");
                persistSimulatedTrade(trade, asset.getSymbol());
                return trade;
            } catch (RuntimeException ex) {
                lastError = ex;
                if (attempt < 3) {
                    retriesUsed.incrementAndGet();
                    try {
                        Thread.sleep(40L * attempt);
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }

        Trade failed = new Trade();
        failed.setUserId(userId);
        failed.setAssetId(asset.getAssetId());
        failed.setTradeType(tradeType);
        failed.setQuantity(quantity);
        failed.setPricePerUnit(executionPrice);
        failed.setTotalAmount(totalAmount);
        failed.setCommission(commission);
        failed.setExecutedAt(LocalDateTime.now());
        failed.setStatus(Trade.TradeStatus.FAILED);
        failed.setNotes(lastError != null ? lastError.getMessage() : "Execution failed");
        rejectedOrders.incrementAndGet();
        persistSimulatedTrade(failed, asset.getSymbol());
        throw new IllegalStateException("Failed to execute order after retries");
    }

    private void validateOrderRate(Long userId) {
        long now = System.currentTimeMillis();
        recentOrderTimestamps.computeIfAbsent(userId, key -> new ArrayDeque<>());
        ArrayDeque<Long> timestamps = recentOrderTimestamps.get(userId);

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > 10_000) {
                timestamps.removeFirst();
            }

            if (timestamps.size() >= MAX_ORDERS_PER_10S) {
                rejectedOrders.incrementAndGet();
                recordFraudAlert(userId, "MULTI", "RATE_LIMIT_TRIGGERED", "Order frequency exceeded anti-abuse threshold.");
                throw new IllegalArgumentException("Order blocked by anti-abuse controls. Please slow down.");
            }
            timestamps.addLast(now);
        }
    }

    private void validateQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero.");
        }
        if (quantity.compareTo(BigDecimal.valueOf(1_000_000)) > 0) {
            throw new IllegalArgumentException("Quantity exceeds simulation limits.");
        }
    }

    private BigDecimal asBigDecimal(Object value) {
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(String.valueOf(value));
    }

    private void recordFraudAlert(Long userId, String symbol, String type, String detail) {
        Map<String, Object> event = new HashMap<>();
        event.put("userId", userId);
        event.put("symbol", symbol);
        event.put("type", type);
        event.put("detail", detail);
        event.put("timestamp", Instant.now().toEpochMilli());

        synchronized (fraudAlerts) {
            fraudAlerts.addFirst(event);
            while (fraudAlerts.size() > 100) {
                fraudAlerts.removeLast();
            }
        }
    }
}
