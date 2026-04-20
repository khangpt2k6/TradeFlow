package com.bankmanagement.engine;

import java.util.Objects;

/**
 * A working order inside the engine. Mutable only in {@code remainingQty} —
 * the matcher decrements it as fills happen.
 *
 * Prices are long cents (or any fixed-point unit the engine is configured for)
 * to keep BigDecimal off the hot path.
 */
public final class Order {

    private final long orderId;
    private final long sequenceNumber;
    private final Side side;
    private final OrderType type;
    private final long priceTicks;
    private final long originalQty;
    private long remainingQty;

    public Order(long orderId,
                 long sequenceNumber,
                 Side side,
                 OrderType type,
                 long priceTicks,
                 long quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive");
        }
        if (type == OrderType.LIMIT && priceTicks <= 0) {
            throw new IllegalArgumentException("limit price must be positive");
        }
        this.orderId = orderId;
        this.sequenceNumber = sequenceNumber;
        this.side = Objects.requireNonNull(side);
        this.type = Objects.requireNonNull(type);
        this.priceTicks = priceTicks;
        this.originalQty = quantity;
        this.remainingQty = quantity;
    }

    public long orderId() { return orderId; }
    public long sequenceNumber() { return sequenceNumber; }
    public Side side() { return side; }
    public OrderType type() { return type; }
    public long priceTicks() { return priceTicks; }
    public long originalQty() { return originalQty; }
    public long remainingQty() { return remainingQty; }

    public boolean isFilled() { return remainingQty == 0; }

    void reduce(long filledQty) {
        if (filledQty <= 0 || filledQty > remainingQty) {
            throw new IllegalArgumentException("invalid fill qty: " + filledQty);
        }
        remainingQty -= filledQty;
    }

    @Override
    public String toString() {
        return "Order{id=" + orderId + ", seq=" + sequenceNumber + ", " + side + " " + type
            + " " + remainingQty + "/" + originalQty + " @ " + priceTicks + "}";
    }
}
