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
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketDataService {

    private static final int HISTORY_LIMIT = 180;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final AssetRepository assetRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Random random = new Random();
    private final Map<String, Deque<Map<String, Object>>> priceHistory = new ConcurrentHashMap<>();

    public MarketDataService(AssetRepository assetRepository, SimpMessagingTemplate messagingTemplate) {
        this.assetRepository = assetRepository;
        this.messagingTemplate = messagingTemplate;
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

        List<Map<String, Object>> ticks = new ArrayList<>();
        for (Asset asset : assets) {
            Asset updated = applyPriceMovement(asset);
            ticks.add(toTick(updated));
            addHistoryPoint(updated.getSymbol(), updated.getCurrentPrice());
        }
        assetRepository.saveAll(assets);

        Map<String, Object> payload = new HashMap<>();
        payload.put("timestamp", Instant.now().toEpochMilli());
        payload.put("updates", ticks);
        payload.put("updatesPerSecond", ticks.size() * 2);

        messagingTemplate.convertAndSend("/topic/market", payload);
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
        BigDecimal movement = BigDecimal.valueOf((random.nextDouble() * 2) - 1)
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
        Map<String, Object> tick = new HashMap<>();
        tick.put("assetId", asset.getAssetId());
        tick.put("symbol", asset.getSymbol());
        tick.put("name", asset.getName());
        tick.put("assetType", asset.getAssetType().name());
        tick.put("price", asset.getCurrentPrice());
        tick.put("previousPrice", asset.getPreviousPrice());
        tick.put("changePercent", asset.getChangePercent());
        tick.put("lastUpdated", asset.getLastUpdated() != null
            ? asset.getLastUpdated().toInstant(ZoneOffset.UTC).toEpochMilli()
            : Instant.now().toEpochMilli());
        return tick;
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
        assets.add(newAsset("AAPL", "Apple Inc.", Asset.AssetType.STOCK, "3.20T", 192.12));
        assets.add(newAsset("MSFT", "Microsoft Corp.", Asset.AssetType.STOCK, "3.05T", 428.17));
        assets.add(newAsset("NVDA", "NVIDIA Corp.", Asset.AssetType.STOCK, "2.67T", 885.92));
        assets.add(newAsset("TSLA", "Tesla Inc.", Asset.AssetType.STOCK, "610B", 175.21));
        assets.add(newAsset("BTCUSD", "Bitcoin", Asset.AssetType.CRYPTOCURRENCY, "1.30T", 67712.34));
        assets.add(newAsset("ETHUSD", "Ethereum", Asset.AssetType.CRYPTOCURRENCY, "420B", 3541.76));
        assets.add(newAsset("XAUUSD", "Gold Spot", Asset.AssetType.COMMODITY, "N/A", 2315.45));
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
