package com.bankmanagement.util;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Utility class for concurrent operations and thread-safe data structures
 */
public class ConcurrentUtils {

    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(10, r -> {
        Thread t = new Thread(r, "TradeFlow-ConcurrentUtils-");
        t.setDaemon(true);
        return t;
    });

    /**
     * Execute a task with timeout
     */
    public static <T> CompletableFuture<T> executeWithTimeout(Supplier<T> task, long timeout, TimeUnit unit) {
        return CompletableFuture.supplyAsync(task, EXECUTOR)
            .orTimeout(timeout, unit)
            .exceptionally(throwable -> {
                if (throwable instanceof TimeoutException) {
                    System.err.println("⚠️ Task timed out after " + timeout + " " + unit);
                } else {
                    System.err.println("❌ Task failed: " + throwable.getMessage());
                }
                return null;
            });
    }

    /**
     * Thread-safe counter with atomic operations
     */
    public static class AtomicCounter {
        private final AtomicLong count = new AtomicLong(0);

        public long increment() {
            return count.incrementAndGet();
        }

        public long decrement() {
            return count.decrementAndGet();
        }

        public long get() {
            return count.get();
        }

        public long add(long value) {
            return count.addAndGet(value);
        }

        public void reset() {
            count.set(0);
        }
    }

    /**
     * Thread-safe cache with TTL
     */
    public static class TTLCache<K, V> {
        private final ConcurrentHashMap<K, CacheEntry<V>> cache = new ConcurrentHashMap<>();
        private final long ttlMillis;

        public TTLCache(long ttlMillis) {
            this.ttlMillis = ttlMillis;
        }

        public void put(K key, V value) {
            cache.put(key, new CacheEntry<>(value, System.currentTimeMillis()));
        }

        public V get(K key) {
            CacheEntry<V> entry = cache.get(key);
            if (entry == null) {
                return null;
            }
            
            if (System.currentTimeMillis() - entry.timestamp > ttlMillis) {
                cache.remove(key);
                return null;
            }
            
            return entry.value;
        }

        public void clear() {
            cache.clear();
        }

        public int size() {
            return cache.size();
        }

        private static class CacheEntry<V> {
            final V value;
            final long timestamp;

            CacheEntry(V value, long timestamp) {
                this.value = value;
                this.timestamp = timestamp;
            }
        }
    }

    /**
     * Thread-safe rate limiter
     */
    public static class RateLimiter {
        private final AtomicLong lastRequestTime = new AtomicLong(0);
        private final long minIntervalMillis;

        public RateLimiter(long minIntervalMillis) {
            this.minIntervalMillis = minIntervalMillis;
        }

        public boolean tryAcquire() {
            long now = System.currentTimeMillis();
            long lastTime = lastRequestTime.get();
            
            if (now - lastTime >= minIntervalMillis) {
                if (lastRequestTime.compareAndSet(lastTime, now)) {
                    return true;
                }
            }
            
            return false;
        }

        public void acquire() {
            while (!tryAcquire()) {
                try {
                    Thread.sleep(1);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }

    /**
     * Thread-safe circular buffer
     */
    public static class CircularBuffer<T> {
        private final Object[] buffer;
        private final AtomicLong writeIndex = new AtomicLong(0);
        private final AtomicLong readIndex = new AtomicLong(0);
        private final int capacity;

        public CircularBuffer(int capacity) {
            this.capacity = capacity;
            this.buffer = new Object[capacity];
        }

        public boolean offer(T item) {
            long currentWrite = writeIndex.get();
            long currentRead = readIndex.get();
            
            if (currentWrite - currentRead >= capacity) {
                return false; // Buffer full
            }
            
            buffer[(int) (currentWrite % capacity)] = item;
            writeIndex.incrementAndGet();
            return true;
        }

        @SuppressWarnings("unchecked")
        public T poll() {
            long currentRead = readIndex.get();
            long currentWrite = writeIndex.get();
            
            if (currentRead >= currentWrite) {
                return null; // Buffer empty
            }
            
            T item = (T) buffer[(int) (currentRead % capacity)];
            readIndex.incrementAndGet();
            return item;
        }

        public int size() {
            return (int) (writeIndex.get() - readIndex.get());
        }

        public boolean isEmpty() {
            return size() == 0;
        }

        public boolean isFull() {
            return size() == capacity;
        }
    }

    /**
     * Thread-safe batch processor
     */
    public static class BatchProcessor<T> {
        private final CircularBuffer<T> buffer;
        private final int batchSize;
        private final long maxWaitMillis;
        private final java.util.function.Consumer<java.util.List<T>> processor;
        private volatile boolean running = true;

        public BatchProcessor(int bufferCapacity, int batchSize, long maxWaitMillis, 
                            java.util.function.Consumer<java.util.List<T>> processor) {
            this.buffer = new CircularBuffer<>(bufferCapacity);
            this.batchSize = batchSize;
            this.maxWaitMillis = maxWaitMillis;
            this.processor = processor;
            
            // Start processing thread
            EXECUTOR.submit(this::processLoop);
        }

        public boolean submit(T item) {
            return buffer.offer(item);
        }

        private void processLoop() {
            while (running) {
                try {
                    java.util.List<T> batch = new java.util.ArrayList<>();
                    
                    // Collect items for batch
                    long startTime = System.currentTimeMillis();
                    while (batch.size() < batchSize && 
                           System.currentTimeMillis() - startTime < maxWaitMillis) {
                        T item = buffer.poll();
                        if (item != null) {
                            batch.add(item);
                        } else {
                            Thread.sleep(10);
                        }
                    }
                    
                    // Process batch if not empty
                    if (!batch.isEmpty()) {
                        try {
                            processor.accept(batch);
                        } catch (Exception e) {
                            System.err.println("❌ Batch processing failed: " + e.getMessage());
                        }
                    }
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        public void shutdown() {
            running = false;
        }
    }

    /**
     * Thread-safe singleton pattern
     */
    public static class ThreadSafeSingleton<T> {
        private final AtomicReference<T> instance = new AtomicReference<>();
        private final Supplier<T> factory;

        public ThreadSafeSingleton(Supplier<T> factory) {
            this.factory = factory;
        }

        public T get() {
            T current = instance.get();
            if (current == null) {
                current = factory.get();
                if (!instance.compareAndSet(null, current)) {
                    current = instance.get();
                }
            }
            return current;
        }
    }

    /**
     * Execute multiple tasks in parallel and wait for all to complete
     */
    public static <T> CompletableFuture<java.util.List<T>> executeAll(
            java.util.List<Supplier<T>> tasks) {
        
        java.util.List<CompletableFuture<T>> futures = tasks.stream()
            .map(task -> CompletableFuture.supplyAsync(task, EXECUTOR))
            .toList();
        
        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                .map(CompletableFuture::join)
                .toList());
    }

    /**
     * Execute tasks with retry mechanism
     */
    public static <T> CompletableFuture<T> executeWithRetry(
            Supplier<T> task, int maxRetries, long delayMillis) {
        
        return CompletableFuture.supplyAsync(() -> {
            int attempts = 0;
            Exception lastException = null;
            
            while (attempts < maxRetries) {
                try {
                    return task.get();
                } catch (Exception e) {
                    lastException = e;
                    attempts++;
                    
                    if (attempts < maxRetries) {
                        try {
                            Thread.sleep(delayMillis * attempts); // Exponential backoff
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            throw new RuntimeException(ie);
                        }
                    }
                }
            }
            
            throw new RuntimeException("Task failed after " + maxRetries + " attempts", lastException);
        }, EXECUTOR);
    }

    /**
     * Shutdown the executor service
     */
    public static void shutdown() {
        EXECUTOR.shutdown();
        try {
            if (!EXECUTOR.awaitTermination(30, TimeUnit.SECONDS)) {
                EXECUTOR.shutdownNow();
            }
        } catch (InterruptedException e) {
            EXECUTOR.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
