package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.PlayerGameStat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlayerGameStatRepository extends JpaRepository<PlayerGameStat, Long> {
    List<PlayerGameStat> findByGameId(Long gameId);
    List<PlayerGameStat> findByGameIdIn(List<Long> gameIds);
    List<PlayerGameStat> findByUserId(Long userId);
    List<PlayerGameStat> findByUserIdIn(List<Long> userIds);
    void deleteByGameId(Long gameId);
}
