package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.GameRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameRecordRepository extends JpaRepository<GameRecord, Long> {
    List<GameRecord> findByMatchIdOrderByGameNumberAsc(Long matchId);
    int countByMatchIdAndStatus(Long matchId, String status);
}
