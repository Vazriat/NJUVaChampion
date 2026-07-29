package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.PlayerGameStat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlayerGameStatRepository extends JpaRepository<PlayerGameStat, Long> {
    List<PlayerGameStat> findByGameId(Long gameId);
    List<PlayerGameStat> findByUserId(Long userId);
    void deleteByGameId(Long gameId);
}
