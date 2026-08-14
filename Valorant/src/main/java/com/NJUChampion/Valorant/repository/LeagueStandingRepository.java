package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.LeagueStanding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LeagueStandingRepository extends JpaRepository<LeagueStanding, Long> {
    List<LeagueStanding> findByTournamentIdOrderByWinsDescRoundDiffDesc(Long tournamentId);
    List<LeagueStanding> findByTournamentId(Long tournamentId);
    Optional<LeagueStanding> findByTournamentIdAndTeamId(Long tournamentId, Long teamId);
    boolean existsByTeamId(Long teamId);
}
