package com.bankmanagement.controller;

import com.bankmanagement.service.MarketDataService;
import com.bankmanagement.service.TradingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/trading")
@CrossOrigin(origins = "*")
public class TradingController {

    private final MarketDataService marketDataService;
    private final TradingService tradingService;

    public TradingController(MarketDataService marketDataService, TradingService tradingService) {
        this.marketDataService = marketDataService;
        this.tradingService = tradingService;
    }

    @GetMapping("/assets")
    public ResponseEntity<?> assets() {
        return ResponseEntity.ok(marketDataService.getActiveAssets());
    }

    @GetMapping("/assets/{symbol}/history")
    public ResponseEntity<?> history(@PathVariable String symbol) {
        return ResponseEntity.ok(marketDataService.getPriceHistory(symbol));
    }

    @PostMapping("/orders")
    public ResponseEntity<?> placeOrder(@RequestBody Map<String, Object> payload) {
        try {
            String symbol = String.valueOf(payload.getOrDefault("symbol", "")).trim();
            String side = String.valueOf(payload.getOrDefault("side", "")).trim();
            BigDecimal quantity = new BigDecimal(String.valueOf(payload.getOrDefault("quantity", "0")));

            if (symbol.isEmpty() || side.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "symbol and side are required"
                ));
            }

            Map<String, Object> execution = tradingService.placeOrder(symbol, side, quantity);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("execution", execution);
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", ex.getMessage()
            ));
        }
    }

    @GetMapping("/orders")
    public ResponseEntity<?> orders() {
        return ResponseEntity.ok(tradingService.getRecentOrders());
    }

    @GetMapping("/portfolio")
    public ResponseEntity<?> portfolio() {
        return ResponseEntity.ok(tradingService.getPortfolioSummary());
    }

    @GetMapping("/metrics")
    public ResponseEntity<?> metrics() {
        return ResponseEntity.ok(tradingService.getEngineMetrics());
    }

    @GetMapping("/order-book/{symbol}")
    public ResponseEntity<?> orderBook(@PathVariable String symbol) {
        try {
            return ResponseEntity.ok(tradingService.buildOrderBook(symbol));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", ex.getMessage()
            ));
        }
    }

    @GetMapping("/fraud-alerts")
    public ResponseEntity<?> fraudAlerts() {
        return ResponseEntity.ok(tradingService.getRecentFraudAlerts());
    }
}
