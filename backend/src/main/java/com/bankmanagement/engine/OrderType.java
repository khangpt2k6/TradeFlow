package com.bankmanagement.engine;

public enum OrderType {
    /** Crosses immediately at the best available price; unmatched remainder cancels. */
    MARKET,
    /** Crosses if marketable; unmatched remainder rests on the book at the limit price. */
    LIMIT
}
