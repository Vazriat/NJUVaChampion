package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.LiveStream;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LiveStreamRepository extends JpaRepository<LiveStream, Long> {

    List<LiveStream> findByMatchIdOrderByStartedAtDesc(Long matchId);

    Page<LiveStream> findByStatusOrderByStartedAtDesc(String status, Pageable pageable);

    long countByStatus(String status);

    Optional<LiveStream> findFirstByStatusOrderByStartedAtDesc(String status);

    Optional<LiveStream> findFirstByRefereeIdAndStatus(Long refereeId, String status);

    Optional<LiveStream> findFirstByMatchIdAndStatus(Long matchId, String status);

    List<LiveStream> findByRefereeIdInAndStatus(List<Long> refereeIds, String status);

    List<LiveStream> findByMatchIdInAndStatus(List<Long> matchIds, String status);

    List<LiveStream> findByTournamentIdAndStatus(Long tournamentId, String status);

    /** 懒过期：启动时间早于阈值的仍在直播的记录 */
    List<LiveStream> findByStatusAndStartedAtBefore(String status, LocalDateTime before);
}
