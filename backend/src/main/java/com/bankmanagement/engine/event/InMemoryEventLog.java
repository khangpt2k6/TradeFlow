package com.bankmanagement.engine.event;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory implementation suitable for tests, replay benchmarks, and
 * single-node operation. A durable variant would write to an append-only
 * file or distributed log (Kafka, Bookkeeper) before acknowledging.
 */
public final class InMemoryEventLog implements EventLog {

    private final List<OrderAcceptedEvent> events = new ArrayList<>();

    @Override
    public synchronized void append(OrderAcceptedEvent event) {
        events.add(event);
    }

    @Override
    public synchronized List<OrderAcceptedEvent> snapshot() {
        return Collections.unmodifiableList(new ArrayList<>(events));
    }
}
