package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.TournamentMatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentMatchRepository extends JpaRepository<TournamentMatch, Long> {
    List<TournamentMatch> findByTeam1IdOrTeam2IdOrderByCreatedAtDesc(Long team1Id, Long team2Id);
    List<TournamentMatch> findByTournamentId(Long tournamentId);
    List<TournamentMatch> findByTournamentIdOrderByRoundAscPositionAsc(Long tournamentId);
    List<TournamentMatch> findByTournamentIdAndRound(Long tournamentId, Integer round);
    List<TournamentMatch> findByTournamentIdAndStageOrderByRoundAscPositionAsc(Long tournamentId, String stage);
    List<TournamentMatch> findByTournamentIdAndStageAndRound(Long tournamentId, String stage, Integer round);
}