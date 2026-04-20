package com.bankmanagement.engine;

import com.bankmanagement.engine.event.EventLog;
import com.bankmanagement.engine.event.InMemoryEventLog;
import com.bankmanagement.engine.event.OrderAcceptedEvent;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Fork;
import org.openjdk.jmh.annotations.Level;
import org.openjdk.jmh.annotations.Measurement;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.Warmup;
import org.openjdk.jmh.infra.Blackhole;
import org.openjdk.jmh.runner.Runner;
import org.openjdk.jmh.runner.RunnerException;
import org.openjdk.jmh.runner.options.Options;
import org.openjdk.jmh.runner.options.OptionsBuilder;

import java.util.Random;
import java.util.concurrent.TimeUnit;

/**
 * Microbenchmark for the matching engine hot path. Measures throughput of
 * randomized limit-order placement against a pre-warmed book.
 *
 * <p>Run with: {@code mvn -Pjmh test-compile && mvn -Pjmh exec:java}
 * (an explicit {@code Runner} {@code main} is provided so no extra plugin
 * is required).</p>
 */
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 2)
@Measurement(iterations = 5, time = 3)
@Fork(1)
@State(Scope.Benchmark)
public class MatchingEngineBenchmark {

    private static final int WARMUP_ORDERS = 10_000;
    private static final long MID_PRICE_TICKS = 10_000L;
    private static final long PRICE_BAND = 50L;

    private MatchingEngine engine;
    private Random random;
    private long nextOrderId;
    private long nextSequence;

    @Setup(Level.Iteration)
    public void primeBook() {
        EventLog log = new InMemoryEventLog();
        engine = new MatchingEngine(log);
        random = new Random(0xC0FFEE);
        nextOrderId = 0;
        nextSequence = 0;

        // Seed both sides of the book with non-crossing limit orders.
        for (int i = 0; i < WARMUP_ORDERS; i++) {
            long bidPrice = MID_PRICE_TICKS - 1 - random.nextInt((int) PRICE_BAND);
            long askPrice = MID_PRICE_TICKS + 1 + random.nextInt((int) PRICE_BAND);
            engine.submit(newEvent(Side.BUY, OrderType.LIMIT, bidPrice, 10));
            engine.submit(newEvent(Side.SELL, OrderType.LIMIT, askPrice, 10));
        }
    }

    @Benchmark
    public void placeLimitOrder(Blackhole bh) {
        Side side = random.nextBoolean() ? Side.BUY : Side.SELL;
        // Place near mid so a fraction of orders cross — exercises both code paths.
        long offset = random.nextInt((int) PRICE_BAND) - PRICE_BAND / 2;
        long price = MID_PRICE_TICKS + offset;
        bh.consume(engine.submit(newEvent(side, OrderType.LIMIT, price, 5)));
    }

    private OrderAcceptedEvent newEvent(Side side, OrderType type, long price, long qty) {
        return new OrderAcceptedEvent(++nextOrderId, ++nextSequence, side, type, price, qty);
    }

    public static void main(String[] args) throws RunnerException {
        Options opt = new OptionsBuilder()
            .include(MatchingEngineBenchmark.class.getSimpleName())
            .build();
        new Runner(opt).run();
    }
}
