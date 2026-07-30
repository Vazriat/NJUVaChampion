package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.SwissStanding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SwissStandingRepository extends JpaRepository<SwissStanding, Long> {
    List<SwissStanding> findByTournamentIdOrderByWinsDescBuchholzDesc(Long tournamentId);
    List<SwissStanding> findByTournamentId(Long tournamentId);
    Optional<SwissStanding> findByTournamentIdAndTeamId(Long tournamentId, Long teamId);
}
