package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.CompetitionTeam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompetitionTeamRepository extends JpaRepository<CompetitionTeam, Long> {
    List<CompetitionTeam> findByCompetitionId(Long competitionId);
    Optional<CompetitionTeam> findByCompetitionIdAndTeamId(Long competitionId, Long teamId);
    boolean existsByCompetitionIdAndTeamId(Long competitionId, Long teamId);
    long countByCompetitionId(Long competitionId);
    boolean existsByTeamId(Long teamId);
    void deleteByCompetitionId(Long competitionId);
}
