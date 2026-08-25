package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.MatchResultSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchResultSubmissionRepository extends JpaRepository<MatchResultSubmission, Long> {
    List<MatchResultSubmission> findByRefereeIdOrderByCreatedAtDesc(Long refereeId);
    List<MatchResultSubmission> findByStatusOrderByCreatedAtDesc(String status);
    List<MatchResultSubmission> findByStatusAndTournamentIdOrderByCreatedAtDesc(String status, Long tournamentId);
    List<MatchResultSubmission> findByTournamentIdOrderByCreatedAtDesc(Long tournamentId);
    List<MatchResultSubmission> findAllByOrderByCreatedAtDesc();
    Optional<MatchResultSubmission> findFirstByMatchIdAndStatus(Long matchId, String status);
    List<MatchResultSubmission> findByMatchIdInAndStatus(List<Long> matchIds, String status);
}
