package com.bankmanagement.service;

import com.bankmanagement.model.Asset;
import com.bankmanagement.model.Trade;
import com.bankmanagement.repository.AssetRepository;
import com.bankmanagement.repository.TradeRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class TradingService {

    private static final BigDecimal MAX_ORDER_NOTIONAL = BigDecimal.valueOf(250_000);
    private static final int MAX_ORDERS_PER_10S = 40;

    private final AssetRepository assetRepository;
    private final TradeRepository tradeRepository;

    private final Map<Long, ArrayDeque<Long>> recentOrderTimestamps = new ConcurrentHashMap<>();
    private final ArrayDeque<Map<String, Object>> fraudAlerts = new ArrayDeque<>();
    private final AtomicLong processedOrders = new AtomicLong(0);
    private final AtomicLong rejectedOrders = new AtomicLong(0);
    private final AtomicLong retriesUsed = new AtomicLong(0);

    public TradingService(AssetRepository assetRepository, TradeRepository tradeRepository) {
        this.assetRepository = assetRepository;
        this.tradeRepository = tradeRepository;
    }

    public Map<String, Object> placeOrder(String symbol, String side, BigDecimal quantity) {
        Long userId = currentUserId();
        validateOrderRate(userId);
        validateQuantity(quantity);

        Asset asset = assetRepository.findBySymbol(symbol.toUpperCase())
            .orElseThrow(() -> new IllegalArgumentException("Unknown symbol: " + symbol));
        Trade.TradeType tradeType = Trade.TradeType.valueOf(side.toUpperCase());

        BigDecimal executionPrice = asset.getCurrentPrice();
        BigDecimal totalAmount = executionPrice.multiply(quantity).setScale(2, RoundingMode.HALF_UP);
        BigDecimal commission = totalAmount.multiply(BigDecimal.valueOf(0.0015)).setScale(2, RoundingMode.HALF_UP);

        if (totalAmount.compareTo(MAX_ORDER_NOTIONAL) > 0) {
            rejectedOrders.incrementAndGet();
            recordFraudAlert(userId, symbol, "MAX_NOTIONAL_EXCEEDED", "Order notional exceeded configured limit.");
            throw new IllegalArgumentException("Order blocked by risk engine: notional exceeds max allowed.");
        }

        Trade savedTrade = executeWithRetry(userId, asset, tradeType, quantity, executionPrice, totalAmount, commission);
        processedOrders.incrementAndGet();

        Map<String, Object> response = new HashMap<>();
        response.put("tradeId", savedTrade.getTradeId());
        response.put("symbol", asset.getSymbol());
        response.put("side", savedTrade.getTradeType());
        response.put("quantity", savedTrade.getQuantity());
        response.put("price", savedTrade.getPricePerUnit());
        response.put("totalAmount", savedTrade.getTotalAmount());
        response.put("commission", savedTrade.getCommission());
        response.put("status", savedTrade.getStatus());
        response.put("executedAt", savedTrade.getExecutedAt());
        return response;
    }

    public List<Trade> getRecentOrders() {
        return tradeRepository.findTop50ByUserIdOrderByExecutedAtDesc(currentUserId());
    }

    public Map<String, Object> getPortfolioSummary() {
        Long userId = currentUserId();
        List<Map<String, Object>> grouped = tradeRepository.summarizePositions(userId);

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

        BigDecimal grossVolume = tradeRepository.sumCompletedVolumeByUserId(userId);
        BigDecimal currentValue = positions.stream()
            .map(row -> (BigDecimal) row.get("marketValue"))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new HashMap<>();
        summary.put("positions", positions);
        summary.put("positionCount", positions.size());
        summary.put("grossVolume", grossVolume);
        summary.put("currentValue", currentValue);
        summary.put("processedOrders", processedOrders.get());
        summary.put("rejectedOrders", rejectedOrders.get());
        summary.put("retriesUsed", retriesUsed.get());
        return summary;
    }

    public Map<String, Object> getEngineMetrics() {
        LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
        long recentOrders = tradeRepository.countByExecutedAtAfter(tenSecondsAgo);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("processedOrders", processedOrders.get());
        metrics.put("rejectedOrders", rejectedOrders.get());
        metrics.put("retriesUsed", retriesUsed.get());
        metrics.put("ordersLast10Seconds", recentOrders);
        metrics.put("timestamp", Instant.now().toEpochMilli());
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

        for (int level = 1; level <= 8; level++) {
            BigDecimal spreadFactor = BigDecimal.valueOf(level).multiply(BigDecimal.valueOf(0.0008));
            BigDecimal bidPrice = mid.multiply(BigDecimal.ONE.subtract(spreadFactor)).setScale(4, RoundingMode.HALF_UP);
            BigDecimal askPrice = mid.multiply(BigDecimal.ONE.add(spreadFactor)).setScale(4, RoundingMode.HALF_UP);
            BigDecimal quantity = BigDecimal.valueOf(Math.max(50, 600 - (level * 45))).setScale(2, RoundingMode.HALF_UP);

            bids.add(Map.of("price", bidPrice, "quantity", quantity));
            asks.add(Map.of("price", askPrice, "quantity", quantity.add(BigDecimal.valueOf(level * 4L))));
        }

        Map<String, Object> orderBook = new HashMap<>();
        orderBook.put("symbol", symbol.toUpperCase());
        orderBook.put("midPrice", mid);
        orderBook.put("bids", bids);
        orderBook.put("asks", asks);
        orderBook.put("timestamp", Instant.now().toEpochMilli());
        return orderBook;
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
                return tradeRepository.save(trade);
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
        tradeRepository.save(failed);
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

    @SuppressWarnings("unchecked")
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getDetails() == null) {
            throw new IllegalStateException("Authentication details missing");
        }
        Map<String, Object> details = (Map<String, Object>) authentication.getDetails();
        Object raw = details.get("userId");
        if (raw == null) {
            throw new IllegalStateException("No userId in authentication context");
        }
        return ((Number) raw).longValue();
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
