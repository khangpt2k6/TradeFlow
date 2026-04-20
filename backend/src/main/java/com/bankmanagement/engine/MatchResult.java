package com.bankmanagement.engine;

import java.util.List;

/**
 * Result of submitting a single order to the engine.
 *
 * @param order        the submitted order (mutated to reflect any fills)
 * @param fills        chronological list of fills produced by this submission
 * @param restedOnBook true if a LIMIT remainder is now sitting in the book
 */
public record MatchResult(Order order, List<Fill> fills, boolean restedOnBook) {

    public long filledQty() {
        long n = 0;
        for (Fill f : fills) {
            n += f.quantity();
        }
        return n;
    }
}
