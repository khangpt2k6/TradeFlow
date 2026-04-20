package com.bankmanagement.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.concurrent.Executor;

/**
 * Concurrency backbone for the trading simulator.
 *
 * - marketTickExecutor: parallel price-tick computation across the symbol universe.
 * - matchingEngineExecutor: bounded pool for order submission / matching work.
 * - taskScheduler: multi-threaded @Scheduled pool so ticking + housekeeping don't queue behind each other.
 */
@Configuration
@EnableScheduling
@EnableAsync
public class AsyncConfig {

    private static final int CORES = Math.max(2, Runtime.getRuntime().availableProcessors());

    @Bean(name = "marketTickExecutor")
    public Executor marketTickExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(CORES);
        ex.setMaxPoolSize(CORES * 2);
        ex.setQueueCapacity(512);
        ex.setThreadNamePrefix("mkt-tick-");
        ex.setAllowCoreThreadTimeOut(true);
        ex.initialize();
        return ex;
    }

    @Bean(name = "matchingEngineExecutor")
    public Executor matchingEngineExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(CORES);
        ex.setMaxPoolSize(CORES * 4);
        ex.setQueueCapacity(2048);
        ex.setThreadNamePrefix("match-");
        ex.setAllowCoreThreadTimeOut(true);
        ex.initialize();
        return ex;
    }

    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler s = new ThreadPoolTaskScheduler();
        s.setPoolSize(Math.max(4, CORES));
        s.setThreadNamePrefix("tf-sched-");
        s.setRemoveOnCancelPolicy(true);
        s.initialize();
        return s;
    }
}
