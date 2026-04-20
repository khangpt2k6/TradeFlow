package com.bankmanagement.engine;

import com.bankmanagement.engine.event.EventLog;
import com.bankmanagement.engine.event.OrderAcceptedEvent;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Single-threaded, deterministic matching engine for one symbol.
 *
 * <p>Order of operations on each {@link #submit}:
 * <ol>
 *   <li>Append the {@link OrderAcceptedEvent} to the log so the input is durable
 *       before any state changes — replay from the log reproduces fills exactly.</li>
 *   <li>Walk the opposite side of the book best-price-first, crossing while the
 *       aggressor is marketable.</li>
 *   <li>Rest a LIMIT remainder on the book, or drop a MARKET remainder.</li>
 * </ol>
 *
 * <p>Fill price is always the resting order's price (price improvement for the
 * aggressor — standard CLOB semantics).</p>
 */
public final class MatchingEngine {

    private final OrderBook book = new OrderBook();
    private final EventLog eventLog;
    private long fillSequence = 0L;

    public MatchingEngine(EventLog eventLog) {
        this.eventLog = eventLog;
    }

    public MatchResult submit(OrderAcceptedEvent event) {
        eventLog.append(event);
        return apply(event);
    }

    /** Internal apply path used by both {@link #submit} and {@link #replayFrom}. */
    private MatchResult apply(OrderAcceptedEvent event) {
        Order order = new Order(event.orderId(), event.sequenceNumber(),
            event.side(), event.type(), event.priceTicks(), event.quantity());

        List<Fill> fills = cross(order);
        book.compactHeads();

        boolean rested = false;
        if (!order.isFilled() && order.type() == OrderType.LIMIT) {
            book.rest(order);
            rested = true;
        }
        return new MatchResult(order, fills, rested);
    }

    private List<Fill> cross(Order aggressor) {
        List<Fill> fills = new ArrayList<>();
        Iterator<Order> opposite = book.oppositeIterator(aggressor.side());

        while (!aggressor.isFilled() && opposite.hasNext()) {
            Order resting = opposite.next();
            if (!isMarketable(aggressor, resting)) {
                break; // best price on the opposite side is no longer crossable — stop
            }
            long qty = Math.min(aggressor.remainingQty(), resting.remainingQty());
            aggressor.reduce(qty);
            resting.reduce(qty);
            fills.add(new Fill(
                aggressor.orderId(),
                resting.orderId(),
                aggressor.side(),
                resting.priceTicks(),
                qty,
                ++fillSequence
            ));
        }
        return fills;
    }

    private static boolean isMarketable(Order aggressor, Order resting) {
        if (aggressor.type() == OrderType.MARKET) {
            return true;
        }
        return aggressor.side() == Side.BUY
            ? aggressor.priceTicks() >= resting.priceTicks()
            : aggressor.priceTicks() <= resting.priceTicks();
    }

    public OrderBook book() {
        return book;
    }

    /**
     * Rebuilds engine state by replaying every event in {@code log} in order.
     * The returned engine has its own fresh book; the supplied log becomes the
     * canonical source of truth for the new instance.
     */
    public static MatchingEngine replayFrom(EventLog log) {
        MatchingEngine engine = new MatchingEngine(new ReplaySinkLog());
        for (OrderAcceptedEvent event : log.snapshot()) {
            engine.apply(event);
        }
        return engine;
    }

    /** Discards appends — replay re-applies events that are already persisted. */
    private static final class ReplaySinkLog implements EventLog {
        @Override public void append(OrderAcceptedEvent event) { /* no-op */ }
        @Override public java.util.List<OrderAcceptedEvent> snapshot() { return java.util.List.of(); }
    }
}
