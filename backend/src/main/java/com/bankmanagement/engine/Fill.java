package com.bankmanagement.engine;

/**
 * Immutable record of one match between an aggressor and a resting order.
 * Two fills are emitted per match (one per counterparty) at the controller
 * boundary; the engine itself emits one canonical record per cross.
 */
public record Fill(
    long aggressorOrderId,
    long restingOrderId,
    Side aggressorSide,
    long priceTicks,
    long quantity,
    long sequenceNumber
) {
}
