package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.MatchReplay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchReplayRepository extends JpaRepository<MatchReplay, Long> {

    List<MatchReplay> findByMatchIdOrderByCreatedAtDesc(Long matchId);

    Optional<MatchReplay> findFirstByMatchIdOrderByCreatedAtDesc(Long matchId);

    List<MatchReplay> findByMatchIdIn(List<Long> matchIds);
}
