package com.bankmanagement.engine;

import com.bankmanagement.engine.event.InMemoryEventLog;
import com.bankmanagement.engine.event.OrderAcceptedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchingEngineTest {

    private InMemoryEventLog log;
    private MatchingEngine engine;
    private long seq;
    private long orderId;

    @BeforeEach
    void setUp() {
        log = new InMemoryEventLog();
        engine = new MatchingEngine(log);
        seq = 0;
        orderId = 0;
    }

    @Test
    void limitRestsWhenNoCross() {
        MatchResult result = submit(Side.BUY, OrderType.LIMIT, 100, 10);

        assertTrue(result.fills().isEmpty());
        assertTrue(result.restedOnBook());
        assertEquals(10, result.order().remainingQty());
        assertEquals(100, engine.book().bestBid().priceTicks());
        assertNull(engine.book().bestAsk());
    }

    @Test
    void marketableLimitCrossesAtRestingPrice() {
        submit(Side.SELL, OrderType.LIMIT, 105, 10);
        MatchResult result = submit(Side.BUY, OrderType.LIMIT, 110, 10);

        assertEquals(1, result.fills().size());
        Fill fill = result.fills().get(0);
        assertEquals(105, fill.priceTicks(), "fill price should be the resting ask, not the aggressor's limit");
        assertEquals(10, fill.quantity());
        assertFalse(result.restedOnBook());
        assertNull(engine.book().bestBid());
        assertNull(engine.book().bestAsk());
    }

    @Test
    void aggressorRestsRemainderAfterPartialFill() {
        submit(Side.SELL, OrderType.LIMIT, 105, 4);
        MatchResult result = submit(Side.BUY, OrderType.LIMIT, 110, 10);

        assertEquals(1, result.fills().size());
        assertEquals(4, result.fills().get(0).quantity());
        assertTrue(result.restedOnBook());
        assertEquals(6, result.order().remainingQty());
        assertEquals(110, engine.book().bestBid().priceTicks());
        assertNull(engine.book().bestAsk());
    }

    @Test
    void priceTimePriorityFillsOldestFirstAtSamePrice() {
        long firstSellId = nextId();
        engine.submit(new OrderAcceptedEvent(firstSellId, ++seq, Side.SELL, OrderType.LIMIT, 105, 5));
        long secondSellId = nextId();
        engine.submit(new OrderAcceptedEvent(secondSellId, ++seq, Side.SELL, OrderType.LIMIT, 105, 5));

        MatchResult result = submit(Side.BUY, OrderType.MARKET, 0, 5);

        assertEquals(1, result.fills().size());
        assertEquals(firstSellId, result.fills().get(0).restingOrderId(),
            "the earlier-arriving sell at the same price must fill first");
    }

    @Test
    void betterPricedRestingOrderFillsBeforeWorsePricedOlderOne() {
        long olderWorseId = nextId();
        engine.submit(new OrderAcceptedEvent(olderWorseId, ++seq, Side.SELL, OrderType.LIMIT, 110, 5));
        long newerBetterId = nextId();
        engine.submit(new OrderAcceptedEvent(newerBetterId, ++seq, Side.SELL, OrderType.LIMIT, 105, 5));

        MatchResult result = submit(Side.BUY, OrderType.MARKET, 0, 5);

        assertEquals(1, result.fills().size());
        assertEquals(newerBetterId, result.fills().get(0).restingOrderId(),
            "price priority outranks time priority across levels");
        assertEquals(105, result.fills().get(0).priceTicks());
    }

    @Test
    void marketOrderRemainderIsCancelledNotRested() {
        submit(Side.SELL, OrderType.LIMIT, 105, 3);
        MatchResult result = submit(Side.BUY, OrderType.MARKET, 0, 10);

        assertEquals(3, result.filledQty());
        assertFalse(result.restedOnBook(), "market remainder must not rest");
        assertEquals(7, result.order().remainingQty());
        assertNull(engine.book().bestBid(), "no leftover should appear on the book");
    }

    @Test
    void crossWalksMultipleResting() {
        submit(Side.SELL, OrderType.LIMIT, 105, 3);
        submit(Side.SELL, OrderType.LIMIT, 106, 3);
        submit(Side.SELL, OrderType.LIMIT, 107, 3);

        MatchResult result = submit(Side.BUY, OrderType.LIMIT, 108, 9);

        assertEquals(3, result.fills().size());
        assertEquals(List.of(105L, 106L, 107L),
            result.fills().stream().map(Fill::priceTicks).toList());
        assertTrue(result.order().isFilled());
        assertNull(engine.book().bestAsk());
    }

    @Test
    void replayReproducesIdenticalBookState() {
        submit(Side.BUY, OrderType.LIMIT, 100, 10);
        submit(Side.BUY, OrderType.LIMIT, 99, 5);
        submit(Side.SELL, OrderType.LIMIT, 105, 8);
        submit(Side.SELL, OrderType.LIMIT, 102, 3); // crosses against the 100 bid for 3
        submit(Side.SELL, OrderType.LIMIT, 110, 4);

        OrderBook live = engine.book();
        OrderBook replayed = MatchingEngine.replayFrom(log).book();

        assertBookEquals(live, replayed);
    }

    private void assertBookEquals(OrderBook a, OrderBook b) {
        assertEquals(a.depth(Side.BUY), b.depth(Side.BUY), "bid depth differs");
        assertEquals(a.depth(Side.SELL), b.depth(Side.SELL), "ask depth differs");

        Order aBid = a.bestBid();
        Order bBid = b.bestBid();
        if (aBid == null) {
            assertNull(bBid);
        } else {
            assertNotNull(bBid);
            assertEquals(aBid.priceTicks(), bBid.priceTicks());
            assertEquals(aBid.remainingQty(), bBid.remainingQty());
        }

        Order aAsk = a.bestAsk();
        Order bAsk = b.bestAsk();
        if (aAsk == null) {
            assertNull(bAsk);
        } else {
            assertNotNull(bAsk);
            assertEquals(aAsk.priceTicks(), bAsk.priceTicks());
            assertEquals(aAsk.remainingQty(), bAsk.remainingQty());
        }
    }

    private MatchResult submit(Side side, OrderType type, long priceTicks, long qty) {
        return engine.submit(new OrderAcceptedEvent(nextId(), ++seq, side, type, priceTicks, qty));
    }

    private long nextId() {
        return ++orderId;
    }
}
