package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.GameRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GameRecordRepository extends JpaRepository<GameRecord, Long> {
    List<GameRecord> findByMatchIdOrderByGameNumberAsc(Long matchId);
    List<GameRecord> findByMatchIdIn(List<Long> matchIds);
    int countByMatchIdAndStatus(Long matchId, String status);
    Optional<GameRecord> findByMatchIdAndGameNumber(Long matchId, int gameNumber);
}
