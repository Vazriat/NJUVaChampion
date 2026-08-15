package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.TournamentAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentAnnouncementRepository extends JpaRepository<TournamentAnnouncement, Long> {
    List<TournamentAnnouncement> findByTournamentIdOrderByPublishedAtDesc(Long tournamentId);
    List<TournamentAnnouncement> findByTournamentIdAndStatusOrderByPublishedAtDesc(Long tournamentId, String status);
    List<TournamentAnnouncement> findByTournamentIdInAndStatusOrderByPublishedAtDesc(List<Long> tournamentIds, String status);
}
