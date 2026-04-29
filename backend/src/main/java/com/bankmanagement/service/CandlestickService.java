package com.bankmanagement.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Server-side candle aggregation + indicator math, lifted out of the React chart widget.
 *
 * Inputs come from MarketDataService.rawHistory(symbol) — a rolling deque of {timestamp, price}.
 * Output is a fully-formed payload the chart can render without any client-side reduction:
 *
 *   { symbol, intervalSec, candles[ {time, open, high, low, close, volume} ],
 *     ema9[], ema20[], vwap[] }
 *
 * The chart widget simply calls setData on each series — no Map/reduce, no allocation per tick.
 */
@Service
public class CandlestickService {

    /** Intervals exposed to the UI; keys match the front-end timeframe selector. */
    private static final Map<String, Integer> INTERVALS;
    static {
        Map<String, Integer> m = new LinkedHashMap<>();
        m.put("1s", 1);
        m.put("5s", 5);
        m.put("15s", 15);
        m.put("1m", 60);
        m.put("5m", 300);
        INTERVALS = Map.copyOf(m);
    }

    private static final int DEFAULT_EMA_FAST = 9;
    private static final int DEFAULT_EMA_SLOW = 20;
    private static final int CANDLE_PRICE_SCALE = 4;
    private static final int INDICATOR_SCALE = 4;

    private final MarketDataService marketDataService;

    public CandlestickService(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    public List<String> supportedIntervals() {
        return new ArrayList<>(INTERVALS.keySet());
    }

    /**
     * Build the full chart payload for one symbol+interval.
     *
     * @param symbol      ticker symbol (case-insensitive)
     * @param intervalKey one of "1s", "5s", "15s", "1m", "5m" — falls back to "5s" if unknown
     */
    public Map<String, Object> buildChartPayload(String symbol, String intervalKey) {
        int intervalSec = resolveIntervalSeconds(intervalKey);
        String normalizedKey = INTERVALS.entrySet().stream()
            .filter(e -> e.getValue() == intervalSec)
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse("5s");

        List<Map<String, Object>> rawTicks = marketDataService.rawHistory(symbol);
        List<Candle> candles = aggregate(rawTicks, intervalSec);

        List<IndicatorPoint> ema9 = ema(candles, DEFAULT_EMA_FAST);
        List<IndicatorPoint> ema20 = ema(candles, DEFAULT_EMA_SLOW);
        List<IndicatorPoint> vwap = vwap(candles);

        Map<String, Object> payload = new HashMap<>();
        payload.put("symbol", symbol == null ? null : symbol.toUpperCase(Locale.ROOT));
        payload.put("interval", normalizedKey);
        payload.put("intervalSec", intervalSec);
        payload.put("candles", candles.stream().map(Candle::toMap).toList());
        payload.put("ema9", ema9.stream().map(IndicatorPoint::toMap).toList());
        payload.put("ema20", ema20.stream().map(IndicatorPoint::toMap).toList());
        payload.put("vwap", vwap.stream().map(IndicatorPoint::toMap).toList());
        payload.put("supportedIntervals", supportedIntervals());
        return payload;
    }

    private int resolveIntervalSeconds(String intervalKey) {
        if (intervalKey == null) return 5;
        Integer v = INTERVALS.get(intervalKey.trim().toLowerCase(Locale.ROOT));
        return v == null ? 5 : v;
    }

    /**
     * Aggregate {timestamp, price} ticks into OHLC buckets keyed by `floor(tsSec / intervalSec) * intervalSec`.
     * Volume here = tick count per bucket (no per-trade size on the synthetic stream).
     */
    private List<Candle> aggregate(List<Map<String, Object>> ticks, int intervalSec) {
        if (ticks == null || ticks.isEmpty() || intervalSec <= 0) {
            return List.of();
        }

        // LinkedHashMap to preserve insertion order — ticks are already chronological from the deque.
        Map<Long, Candle> buckets = new LinkedHashMap<>();
        for (Map<String, Object> t : ticks) {
            Long ts = toLong(t.get("timestamp"));
            BigDecimal price = toBigDecimal(t.get("price"));
            if (ts == null || price == null) continue;

            long bucket = (ts / 1000L / intervalSec) * intervalSec;
            Candle c = buckets.get(bucket);
            if (c == null) {
                buckets.put(bucket, new Candle(bucket, price, price, price, price, 1));
            } else {
                c.absorb(price);
            }
        }

        // The Map preserves chronological insertion order; no sort needed.
        List<Candle> out = new ArrayList<>(buckets.values());
        return out;
    }

    /** Standard exponential moving average over close prices, period in candles. */
    private List<IndicatorPoint> ema(List<Candle> candles, int period) {
        if (candles.isEmpty() || period <= 0) {
            return List.of();
        }
        double k = 2.0 / (period + 1.0);
        List<IndicatorPoint> out = new ArrayList<>(candles.size());
        double prev = candles.get(0).close.doubleValue();
        for (int i = 0; i < candles.size(); i++) {
            double c = candles.get(i).close.doubleValue();
            prev = (i == 0) ? c : (c * k + prev * (1.0 - k));
            out.add(new IndicatorPoint(candles.get(i).time,
                BigDecimal.valueOf(prev).setScale(INDICATOR_SCALE, RoundingMode.HALF_UP)));
        }
        return out;
    }

    /**
     * Session VWAP: cumulative typical-price × volume divided by cumulative volume.
     * Typical price = (high + low + close) / 3.
     */
    private List<IndicatorPoint> vwap(List<Candle> candles) {
        if (candles.isEmpty()) {
            return List.of();
        }
        double pv = 0.0;
        double v = 0.0;
        List<IndicatorPoint> out = new ArrayList<>(candles.size());
        for (Candle c : candles) {
            double tp = (c.high.doubleValue() + c.low.doubleValue() + c.close.doubleValue()) / 3.0;
            pv += tp * c.volume;
            v += c.volume;
            double value = (v > 0.0) ? (pv / v) : tp;
            out.add(new IndicatorPoint(c.time,
                BigDecimal.valueOf(value).setScale(INDICATOR_SCALE, RoundingMode.HALF_UP)));
        }
        return out;
    }

    private static Long toLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o == null) return null;
        try {
            return Long.parseLong(String.valueOf(o));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static BigDecimal toBigDecimal(Object o) {
        if (o instanceof BigDecimal b) return b;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        if (o == null) return null;
        try {
            return new BigDecimal(String.valueOf(o));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** OHLC bucket. Mutated during aggregation, then frozen into a Map for serialization. */
    private static final class Candle {
        final long time;
        final BigDecimal open;
        BigDecimal high;
        BigDecimal low;
        BigDecimal close;
        long volume;

        Candle(long time, BigDecimal open, BigDecimal high, BigDecimal low, BigDecimal close, long volume) {
            this.time = time;
            this.open = open.setScale(CANDLE_PRICE_SCALE, RoundingMode.HALF_UP);
            this.high = high.setScale(CANDLE_PRICE_SCALE, RoundingMode.HALF_UP);
            this.low = low.setScale(CANDLE_PRICE_SCALE, RoundingMode.HALF_UP);
            this.close = close.setScale(CANDLE_PRICE_SCALE, RoundingMode.HALF_UP);
            this.volume = volume;
        }

        void absorb(BigDecimal price) {
            BigDecimal scaled = price.setScale(CANDLE_PRICE_SCALE, RoundingMode.HALF_UP);
            if (scaled.compareTo(high) > 0) high = scaled;
            if (scaled.compareTo(low) < 0) low = scaled;
            close = scaled;
            volume++;
        }

        Map<String, Object> toMap() {
            // Field names match what lightweight-charts expects (time in seconds, OHLC, value).
            Map<String, Object> m = new HashMap<>();
            m.put("time", time);
            m.put("open", open);
            m.put("high", high);
            m.put("low", low);
            m.put("close", close);
            m.put("volume", volume);
            return m;
        }
    }

    private record IndicatorPoint(long time, BigDecimal value) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new HashMap<>();
            m.put("time", time);
            m.put("value", value);
            return m;
        }
    }

    /** Static accessor so callers can introspect the supported set without an instance. */
    public static List<String> staticSupportedIntervals() {
        return Arrays.asList(INTERVALS.keySet().toArray(new String[0]));
    }
}
