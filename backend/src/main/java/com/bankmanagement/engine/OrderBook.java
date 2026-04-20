package com.bankmanagement.engine;

import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

/**
 * Single-symbol limit order book with strict price-time priority.
 *
 * <p>Bids are kept in descending price order, asks in ascending order.
 * Within a price level, orders are FIFO by sequence number — the first
 * order to enter the level is the first to fill.</p>
 *
 * <p>Not thread-safe by design: the matching engine owns the book and
 * mutates it from a single writer thread.</p>
 */
public final class OrderBook {

    private final NavigableMap<Long, Deque<Order>> bids = new TreeMap<>(Comparator.reverseOrder());
    private final NavigableMap<Long, Deque<Order>> asks = new TreeMap<>();

    public void rest(Order order) {
        if (order.type() != OrderType.LIMIT) {
            throw new IllegalArgumentException("only limit orders rest on the book");
        }
        if (order.isFilled()) {
            return;
        }
        NavigableMap<Long, Deque<Order>> side = sideFor(order.side());
        side.computeIfAbsent(order.priceTicks(), k -> new ArrayDeque<>()).addLast(order);
    }

    public Order bestBid() {
        Map.Entry<Long, Deque<Order>> entry = bids.firstEntry();
        return entry == null ? null : entry.getValue().peekFirst();
    }

    public Order bestAsk() {
        Map.Entry<Long, Deque<Order>> entry = asks.firstEntry();
        return entry == null ? null : entry.getValue().peekFirst();
    }

    /**
     * Iterates resting orders on the side opposite to {@code aggressorSide},
     * best price first, peeling away fully-filled orders as the caller signals.
     */
    Iterator<Order> oppositeIterator(Side aggressorSide) {
        NavigableMap<Long, Deque<Order>> opposite = sideFor(aggressorSide.opposite());
        return new Iterator<>() {
            Map.Entry<Long, Deque<Order>> level = opposite.firstEntry();
            Iterator<Order> levelIter = level == null ? null : level.getValue().iterator();
            Order nextOrder = advance();

            private Order advance() {
                while (true) {
                    if (levelIter != null && levelIter.hasNext()) {
                        return levelIter.next();
                    }
                    if (level == null) {
                        return null;
                    }
                    opposite.remove(level.getKey()); // remove the now-exhausted (or fully consumed) level
                    level = opposite.firstEntry();
                    levelIter = level == null ? null : level.getValue().iterator();
                }
            }

            @Override
            public boolean hasNext() {
                return nextOrder != null;
            }

            @Override
            public Order next() {
                Order o = nextOrder;
                nextOrder = advance();
                return o;
            }
        };
    }

    /**
     * Removes any leading fully-filled orders at the head of each side.
     * Called by the engine after a cross loop so subsequent {@link #bestBid}
     * / {@link #bestAsk} reads are accurate.
     */
    void compactHeads() {
        compactSide(bids);
        compactSide(asks);
    }

    private static void compactSide(NavigableMap<Long, Deque<Order>> side) {
        while (!side.isEmpty()) {
            Map.Entry<Long, Deque<Order>> entry = side.firstEntry();
            Deque<Order> q = entry.getValue();
            while (!q.isEmpty() && q.peekFirst().isFilled()) {
                q.pollFirst();
            }
            if (q.isEmpty()) {
                side.pollFirstEntry();
            } else {
                return;
            }
        }
    }

    public int depth(Side side) {
        int n = 0;
        for (Deque<Order> q : sideFor(side).values()) {
            n += q.size();
        }
        return n;
    }

    private NavigableMap<Long, Deque<Order>> sideFor(Side side) {
        return side == Side.BUY ? bids : asks;
    }
}
