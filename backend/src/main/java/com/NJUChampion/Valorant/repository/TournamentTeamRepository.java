package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.TournamentTeam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TournamentTeamRepository extends JpaRepository<TournamentTeam, Long> {
    List<TournamentTeam> findByTournamentId(Long tournamentId);
    List<TournamentTeam> findByTeamIdIn(List<Long> teamIds);
    Optional<TournamentTeam> findByTournamentIdAndTeamId(Long tournamentId, Long teamId);
    boolean existsByTournamentIdAndTeamId(Long tournamentId, Long teamId);
    long countByTournamentId(Long tournamentId);
    void deleteByTournamentIdAndTeamId(Long tournamentId, Long teamId);
    boolean existsByTeamId(Long teamId);
}