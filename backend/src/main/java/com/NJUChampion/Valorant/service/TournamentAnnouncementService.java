package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.TeamMember;
import com.NJUChampion.Valorant.entity.Tournament;
import com.NJUChampion.Valorant.entity.TournamentAnnouncement;
import com.NJUChampion.Valorant.entity.TournamentTeam;
import com.NJUChampion.Valorant.repository.TeamMemberRepository;
import com.NJUChampion.Valorant.repository.TournamentAnnouncementRepository;
import com.NJUChampion.Valorant.repository.TournamentRepository;
import com.NJUChampion.Valorant.repository.TournamentTeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TournamentAnnouncementService {

    private final TournamentAnnouncementRepository tournamentAnnouncementRepository;
    private final TournamentRepository tournamentRepository;
    private final TournamentTeamRepository tournamentTeamRepository;
    private final TeamMemberRepository teamMemberRepository;

    public List<TournamentAnnouncement> listByTournament(Long tournamentId) {
        return tournamentAnnouncementRepository.findByTournamentIdOrderByPublishedAtDesc(tournamentId);
    }

    public List<TournamentAnnouncement> listPublishedByTournament(Long tournamentId) {
        return tournamentAnnouncementRepository.findByTournamentIdAndStatusOrderByPublishedAtDesc(tournamentId, "PUBLISHED");
    }

    public TournamentAnnouncement getById(Long id) {
        return tournamentAnnouncementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("赛事通知不存在"));
    }

    public TournamentAnnouncement save(TournamentAnnouncement announcement) {
        return tournamentAnnouncementRepository.save(announcement);
    }

    @Transactional
    public TournamentAnnouncement publish(Long id) {
        TournamentAnnouncement a = getById(id);
        a.setStatus("PUBLISHED");
        a.setPublishedAt(LocalDateTime.now());
        return tournamentAnnouncementRepository.save(a);
    }

    public void delete(Long id) {
        tournamentAnnouncementRepository.deleteById(id);
    }

    /**
     * Published notifications for tournaments the current user participates in
     * (as a member of a registered team).
     */
    public List<Map<String, Object>> listMyPublished(Long userId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) {
            return List.of();
        }
        List<Long> teamIds = memberships.stream()
                .map(TeamMember::getTeamId)
                .distinct()
                .collect(Collectors.toList());
        List<TournamentTeam> registrations = tournamentTeamRepository.findByTeamIdIn(teamIds);
        List<Long> tournamentIds = registrations.stream()
                .map(TournamentTeam::getTournamentId)
                .distinct()
                .collect(Collectors.toList());
        if (tournamentIds.isEmpty()) {
            return List.of();
        }

        List<TournamentAnnouncement> announcements = tournamentAnnouncementRepository
                .findByTournamentIdInAndStatusOrderByPublishedAtDesc(tournamentIds, "PUBLISHED");
        return announcements.stream().map(this::toMapWithTournamentName).collect(Collectors.toList());
    }

    private Map<String, Object> toMapWithTournamentName(TournamentAnnouncement a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("tournamentId", a.getTournamentId());
        m.put("title", a.getTitle());
        m.put("content", a.getContent());
        m.put("priority", a.getPriority());
        m.put("status", a.getStatus());
        m.put("publishedAt", a.getPublishedAt());
        m.put("createdAt", a.getCreatedAt());
        m.put("updatedAt", a.getUpdatedAt());
        Tournament tournament = tournamentRepository.findById(a.getTournamentId()).orElse(null);
        m.put("tournamentName", tournament != null ? tournament.getName() : null);
        return m;
    }

    public List<Map<String, Object>> listPublishedWithTournamentName(Long tournamentId) {
        return listPublishedByTournament(tournamentId).stream()
                .map(this::toMapWithTournamentName)
                .collect(Collectors.toList());
    }
}
