package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.MatchVideo;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchVideoRepository extends JpaRepository<MatchVideo, Long> {

    List<MatchVideo> findByMatchIdAndStatusOrderByCreatedAtDesc(Long matchId, String status);

    Page<MatchVideo> findByTournamentIdAndStatusOrderByCreatedAtDesc(
            Long tournamentId, String status, Pageable pageable);

    Page<MatchVideo> findByTournamentIdAndStatusAndCategoryOrderByCreatedAtDesc(
            Long tournamentId, String status, String category, Pageable pageable);

    Optional<MatchVideo> findFirstByMatchIdAndUrl(Long matchId, String url);

    long countByMatchIdAndStatus(Long matchId, String status);

    List<MatchVideo> findByMatchIdInAndStatusOrderByCreatedAtDesc(List<Long> matchIds, String status);

    Page<MatchVideo> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
