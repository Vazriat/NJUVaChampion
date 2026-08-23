package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.RankReviewOverride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RankReviewOverrideRepository extends JpaRepository<RankReviewOverride, Long> {
    List<RankReviewOverride> findByTournamentId(Long tournamentId);
    List<RankReviewOverride> findByCompetitionId(Long competitionId);
    Optional<RankReviewOverride> findByTournamentIdAndUserId(Long tournamentId, Long userId);
    Optional<RankReviewOverride> findByCompetitionIdAndUserId(Long competitionId, Long userId);
    void deleteByTournamentIdAndUserId(Long tournamentId, Long userId);
    void deleteByCompetitionIdAndUserId(Long competitionId, Long userId);
}
