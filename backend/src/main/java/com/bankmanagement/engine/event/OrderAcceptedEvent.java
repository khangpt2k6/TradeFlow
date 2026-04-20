package com.bankmanagement.engine.event;

import com.bankmanagement.engine.OrderType;
import com.bankmanagement.engine.Side;

/**
 * The single input event the engine accepts. Persist these in order and
 * the entire book + fill history can be reconstructed by replay.
 */
public record OrderAcceptedEvent(
    long orderId,
    long sequenceNumber,
    Side side,
    OrderType type,
    long priceTicks,
    long quantity
) {
}
