package com.bankmanagement.engine.event;

import java.util.List;

/**
 * Append-only log of accepted orders. The engine is a pure function of
 * this log — replaying it from the start always yields the same book state
 * and the same sequence of fills.
 */
public interface EventLog {

    void append(OrderAcceptedEvent event);

    List<OrderAcceptedEvent> snapshot();
}
