package com.bankmanagement.service;

import com.bankmanagement.model.Asset;
import com.bankmanagement.repository.AssetRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class MarketDataService {

    private static final int HISTORY_LIMIT = 240;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final AssetRepository assetRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final TradingService tradingService;
    private final Map<String, Deque<Map<String, Object>>> priceHistory = new ConcurrentHashMap<>();
    private final AtomicLong tickCount = new AtomicLong(0);
    private final AtomicLong lastBatchTs = new AtomicLong(System.currentTimeMillis());
    private final AtomicLong lastBatchSize = new AtomicLong(0);

    public MarketDataService(AssetRepository assetRepository,
                             SimpMessagingTemplate messagingTemplate,
                             TradingService tradingService) {
        this.assetRepository = assetRepository;
        this.messagingTemplate = messagingTemplate;
        this.tradingService = tradingService;
    }

    @PostConstruct
    public void initializeMarket() {
        if (assetRepository.count() == 0) {
            assetRepository.saveAll(seedAssets());
        }

        List<Asset> assets = assetRepository.findAll();
        for (Asset asset : assets) {
            priceHistory.put(asset.getSymbol(), new ArrayDeque<>());
            addHistoryPoint(asset.getSymbol(), asset.getCurrentPrice());
        }
    }

    @Scheduled(fixedRate = 500)
    public void streamMarketTicks() {
        List<Asset> assets = assetRepository.findByIsActiveTrueOrderBySymbolAsc();
        if (assets.isEmpty()) {
            return;
        }

        // Parallelize price movement across cores — CPU-bound math scales linearly with symbol count.
        List<Map<String, Object>> ticks = assets.parallelStream()
            .map(asset -> {
                Asset updated = applyPriceMovement(asset);
                addHistoryPoint(updated.getSymbol(), updated.getCurrentPrice());
                return toTick(updated);
            })
            .toList();

        assetRepository.saveAll(assets);
        assets.parallelStream().forEach(a -> tradingService.onMarketPrice(a.getSymbol(), a.getCurrentPrice()));

        long total = tickCount.addAndGet(ticks.size());
        long now = Instant.now().toEpochMilli();
        long prev = lastBatchTs.getAndSet(now);
        lastBatchSize.set(ticks.size());
        long dt = Math.max(1, now - prev);
        long tps = (ticks.size() * 1000L) / dt;

        // Market breadth: share of symbols currently positive on the session.
        long advancers = ticks.stream()
            .filter(t -> {
                Object ch = t.get("changePercent");
                return ch instanceof BigDecimal b && b.signum() > 0;
            })
            .count();
        long decliners = ticks.size() - advancers;

        Map<String, Object> payload = new HashMap<>();
        payload.put("timestamp", now);
        payload.put("updates", ticks);
        payload.put("ticksPerSecond", tps);
        payload.put("totalTicks", total);
        payload.put("advancers", advancers);
        payload.put("decliners", decliners);
        payload.put("symbolCount", ticks.size());

        messagingTemplate.convertAndSend("/topic/market", payload);
    }

    /** Snapshot of live tick stream metrics — consumed by the dashboard and /api/trading/metrics. */
    public Map<String, Object> getTickStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTicks", tickCount.get());
        stats.put("lastBatchSize", lastBatchSize.get());
        stats.put("lastBatchAt", lastBatchTs.get());
        stats.put("symbolCount", priceHistory.size());
        return stats;
    }

    public List<Map<String, Object>> getActiveAssets() {
        return assetRepository.findByIsActiveTrueOrderBySymbolAsc()
            .stream()
            .map(this::toTick)
            .sorted(Comparator.comparing(tick -> String.valueOf(tick.get("symbol"))))
            .toList();
    }

    public List<Map<String, Object>> getPriceHistory(String symbol) {
        Deque<Map<String, Object>> history = priceHistory.get(symbol.toUpperCase());
        if (history == null) {
            return List.of();
        }
        synchronized (history) {
            return new ArrayList<>(history);
        }
    }

    private Asset applyPriceMovement(Asset asset) {
        BigDecimal previous = asset.getCurrentPrice();
        BigDecimal maxMovePercent = BigDecimal.valueOf(0.9); // max +-0.9%
        // ThreadLocalRandom is lock-free per thread — required for parallelStream tick processing.
        BigDecimal movement = BigDecimal.valueOf((ThreadLocalRandom.current().nextDouble() * 2) - 1)
            .multiply(maxMovePercent)
            .divide(ONE_HUNDRED, 6, RoundingMode.HALF_UP);

        BigDecimal next = previous.multiply(BigDecimal.ONE.add(movement))
            .max(BigDecimal.valueOf(0.01))
            .setScale(4, RoundingMode.HALF_UP);

        BigDecimal changePercent = next.subtract(previous)
            .divide(previous, 6, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .setScale(2, RoundingMode.HALF_UP);

        asset.setPreviousPrice(previous);
        asset.setCurrentPrice(next);
        asset.setChangePercent(changePercent);
        asset.setLastUpdated(LocalDateTime.now());
        return asset;
    }

    private Map<String, Object> toTick(Asset asset) {
        BigDecimal price = asset.getCurrentPrice();
        BigDecimal previous = asset.getPreviousPrice();
        BigDecimal changePercent = asset.getChangePercent() != null
            ? asset.getChangePercent()
            : BigDecimal.ZERO;

        // Server-computed dollar move so the watchlist row doesn't need to do `price * %chg / 100`.
        BigDecimal dollarChange = price.multiply(changePercent)
            .divide(ONE_HUNDRED, 4, RoundingMode.HALF_UP);

        // Server-classified flash direction so the client doesn't need a prevPricesRef + diffing useEffect.
        String direction = "flat";
        if (previous != null) {
            int cmp = price.compareTo(previous);
            if (cmp > 0) direction = "up";
            else if (cmp < 0) direction = "down";
        }

        Map<String, Object> tick = new HashMap<>();
        tick.put("assetId", asset.getAssetId());
        tick.put("symbol", asset.getSymbol());
        tick.put("name", asset.getName());
        tick.put("assetType", asset.getAssetType().name());
        tick.put("price", price);
        tick.put("previousPrice", previous);
        tick.put("changePercent", changePercent);
        tick.put("dollarChange", dollarChange);
        tick.put("direction", direction);
        tick.put("lastUpdated", asset.getLastUpdated() != null
            ? asset.getLastUpdated().toInstant(ZoneOffset.UTC).toEpochMilli()
            : Instant.now().toEpochMilli());
        return tick;
    }

    /**
     * O/H/L/last for the rolling session window kept in priceHistory (HISTORY_LIMIT points).
     * Pulled out of the dashboard's `sessionStats` useMemo so the client just renders.
     */
    public Map<String, Object> getSessionStats(String symbol) {
        Deque<Map<String, Object>> history = priceHistory.get(symbol == null ? "" : symbol.toUpperCase());
        Map<String, Object> stats = new HashMap<>();
        stats.put("symbol", symbol == null ? null : symbol.toUpperCase());
        if (history == null || history.isEmpty()) {
            stats.put("open", null);
            stats.put("high", null);
            stats.put("low", null);
            stats.put("last", null);
            stats.put("points", 0);
            return stats;
        }

        BigDecimal open = null, high = null, low = null, last = null;
        int points;
        synchronized (history) {
            points = history.size();
            for (Map<String, Object> point : history) {
                Object raw = point.get("price");
                if (!(raw instanceof BigDecimal price)) {
                    continue;
                }
                if (open == null) open = price;
                if (high == null || price.compareTo(high) > 0) high = price;
                if (low == null || price.compareTo(low) < 0) low = price;
                last = price;
            }
        }
        stats.put("open", open);
        stats.put("high", high);
        stats.put("low", low);
        stats.put("last", last);
        stats.put("points", points);
        return stats;
    }

    /** Direct accessor for the rolling history deque — used by CandlestickService for OHLC aggregation. */
    public List<Map<String, Object>> rawHistory(String symbol) {
        Deque<Map<String, Object>> history = priceHistory.get(symbol == null ? "" : symbol.toUpperCase());
        if (history == null) {
            return List.of();
        }
        synchronized (history) {
            return new ArrayList<>(history);
        }
    }

    private void addHistoryPoint(String symbol, BigDecimal price) {
        Deque<Map<String, Object>> history = priceHistory.computeIfAbsent(symbol, k -> new ArrayDeque<>());
        synchronized (history) {
            Map<String, Object> point = new HashMap<>();
            point.put("timestamp", Instant.now().toEpochMilli());
            point.put("price", price);
            history.addLast(point);

            while (history.size() > HISTORY_LIMIT) {
                history.removeFirst();
            }
        }
    }

    private List<Asset> seedAssets() {
        List<Asset> assets = new ArrayList<>();
        // Mega-cap tech
        assets.add(newAsset("AAPL", "Apple Inc.", Asset.AssetType.STOCK, "3.20T", 192.12));
        assets.add(newAsset("MSFT", "Microsoft Corp.", Asset.AssetType.STOCK, "3.05T", 428.17));
        assets.add(newAsset("NVDA", "NVIDIA Corp.", Asset.AssetType.STOCK, "2.67T", 885.92));
        assets.add(newAsset("GOOGL", "Alphabet Inc.", Asset.AssetType.STOCK, "2.10T", 172.35));
        assets.add(newAsset("AMZN", "Amazon.com Inc.", Asset.AssetType.STOCK, "1.92T", 188.77));
        assets.add(newAsset("META", "Meta Platforms", Asset.AssetType.STOCK, "1.28T", 502.18));
        assets.add(newAsset("TSLA", "Tesla Inc.", Asset.AssetType.STOCK, "610B", 175.21));
        assets.add(newAsset("NFLX", "Netflix Inc.", Asset.AssetType.STOCK, "265B", 612.90));
        assets.add(newAsset("AMD", "Advanced Micro Devices", Asset.AssetType.STOCK, "258B", 158.22));
        assets.add(newAsset("INTC", "Intel Corp.", Asset.AssetType.STOCK, "148B", 34.81));
        assets.add(newAsset("ORCL", "Oracle Corp.", Asset.AssetType.STOCK, "335B", 121.42));
        assets.add(newAsset("CRM", "Salesforce Inc.", Asset.AssetType.STOCK, "280B", 289.66));
        // Finance
        assets.add(newAsset("JPM", "JPMorgan Chase", Asset.AssetType.STOCK, "570B", 198.14));
        assets.add(newAsset("BAC", "Bank of America", Asset.AssetType.STOCK, "320B", 40.83));
        assets.add(newAsset("GS", "Goldman Sachs", Asset.AssetType.STOCK, "145B", 456.12));
        assets.add(newAsset("V", "Visa Inc.", Asset.AssetType.STOCK, "560B", 275.30));
        assets.add(newAsset("MA", "Mastercard Inc.", Asset.AssetType.STOCK, "445B", 478.55));
        // Energy / industrial / consumer
        assets.add(newAsset("XOM", "Exxon Mobil", Asset.AssetType.STOCK, "465B", 116.27));
        assets.add(newAsset("CVX", "Chevron Corp.", Asset.AssetType.STOCK, "290B", 157.44));
        assets.add(newAsset("BA", "Boeing Co.", Asset.AssetType.STOCK, "108B", 178.16));
        assets.add(newAsset("DIS", "Walt Disney Co.", Asset.AssetType.STOCK, "205B", 112.77));
        assets.add(newAsset("WMT", "Walmart Inc.", Asset.AssetType.STOCK, "495B", 61.20));
        assets.add(newAsset("KO", "Coca-Cola Co.", Asset.AssetType.STOCK, "265B", 61.75));
        assets.add(newAsset("PFE", "Pfizer Inc.", Asset.AssetType.STOCK, "160B", 28.33));
        assets.add(newAsset("UBER", "Uber Technologies", Asset.AssetType.STOCK, "155B", 74.21));
        // Crypto
        assets.add(newAsset("BTCUSD", "Bitcoin", Asset.AssetType.CRYPTOCURRENCY, "1.30T", 67712.34));
        assets.add(newAsset("ETHUSD", "Ethereum", Asset.AssetType.CRYPTOCURRENCY, "420B", 3541.76));
        assets.add(newAsset("SOLUSD", "Solana", Asset.AssetType.CRYPTOCURRENCY, "75B", 165.42));
        // Commodities
        assets.add(newAsset("XAUUSD", "Gold Spot", Asset.AssetType.COMMODITY, "N/A", 2315.45));
        assets.add(newAsset("XAGUSD", "Silver Spot", Asset.AssetType.COMMODITY, "N/A", 27.84));
        return assets;
    }

    private Asset newAsset(String symbol, String name, Asset.AssetType type, String marketCap, double price) {
        Asset asset = new Asset();
        asset.setSymbol(symbol);
        asset.setName(name);
        asset.setAssetType(type);
        asset.setCurrentPrice(BigDecimal.valueOf(price).setScale(4, RoundingMode.HALF_UP));
        asset.setPreviousPrice(asset.getCurrentPrice());
        asset.setChangePercent(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        asset.setMarketCap(marketCap);
        asset.setCurrency("USD");
        asset.setCreatedAt(LocalDateTime.now());
        asset.setLastUpdated(LocalDateTime.now());
        asset.setIsActive(true);
        return asset;
    }
}
