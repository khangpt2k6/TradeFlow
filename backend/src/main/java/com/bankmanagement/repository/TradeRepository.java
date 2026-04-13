package com.bankmanagement.repository;

import com.bankmanagement.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {
    List<Trade> findTop50ByUserIdOrderByExecutedAtDesc(Long userId);
    long countByExecutedAtAfter(LocalDateTime since);

    @Query("SELECT t.assetId as assetId, " +
           "SUM(CASE WHEN t.tradeType = 'BUY' THEN t.quantity ELSE -t.quantity END) as netQuantity " +
           "FROM Trade t " +
           "WHERE t.userId = :userId AND t.status = 'COMPLETED' " +
           "GROUP BY t.assetId")
    List<Map<String, Object>> summarizePositions(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(t.totalAmount), 0) FROM Trade t WHERE t.userId = :userId AND t.status = 'COMPLETED'")
    BigDecimal sumCompletedVolumeByUserId(@Param("userId") Long userId);
}
