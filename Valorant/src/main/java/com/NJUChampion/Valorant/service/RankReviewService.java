package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RankReviewService {

    private final TournamentRepository tournamentRepository;
    private final CompetitionRepository competitionRepository;
    private final TournamentTeamRepository tournamentTeamRepository;
    private final CompetitionTeamRepository competitionTeamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;
    private final CertificationRepository certificationRepository;
    private final UserRepository userRepository;
    private final RankReviewOverrideRepository rankReviewOverrideRepository;

    public List<Map<String, Object>> listTournamentReview(Long tournamentId) {
        Tournament tournament = tournamentRepository.findById(tournamentId)
                .orElseThrow(() -> new IllegalArgumentException("赛事不存在"));

        List<Long> teamIds = tournamentTeamRepository.findByTournamentId(tournamentId).stream()
                .map(TournamentTeam::getTeamId)
                .distinct()
                .collect(Collectors.toList());

        Long competitionId = tournament.getCompetitionId();
        LocalDateTime referenceTime = tournament.getCreatedAt();
        if (competitionId != null) {
            Competition competition = competitionRepository.findById(competitionId).orElse(null);
            if (competition != null && competition.getCreatedAt() != null) {
                referenceTime = competition.getCreatedAt();
            }
        }

        Set<Long> overridden = new HashSet<>();
        rankReviewOverrideRepository.findByTournamentId(tournamentId)
                .forEach(o -> overridden.add(o.getUserId()));
        if (competitionId != null) {
            rankReviewOverrideRepository.findByCompetitionId(competitionId)
                    .forEach(o -> overridden.add(o.getUserId()));
        }

        return buildReview(teamIds, referenceTime, overridden);
    }

    public List<Map<String, Object>> listCompetitionReview(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("活动不存在"));

        List<Long> teamIds = competitionTeamRepository.findByCompetitionId(competitionId).stream()
                .map(CompetitionTeam::getTeamId)
                .distinct()
                .collect(Collectors.toList());

        Set<Long> overridden = rankReviewOverrideRepository.findByCompetitionId(competitionId).stream()
                .map(RankReviewOverride::getUserId)
                .collect(Collectors.toSet());

        return buildReview(teamIds, competition.getCreatedAt(), overridden);
    }

    @Transactional
    public void passTournamentUser(Long tournamentId, Long userId) {
        rankReviewOverrideRepository.findByTournamentIdAndUserId(tournamentId, userId)
                .orElseGet(() -> rankReviewOverrideRepository.save(RankReviewOverride.builder()
                        .tournamentId(tournamentId)
                        .userId(userId)
                        .build()));
    }

    @Transactional
    public void unpassTournamentUser(Long tournamentId, Long userId) {
        rankReviewOverrideRepository.deleteByTournamentIdAndUserId(tournamentId, userId);
    }

    @Transactional
    public void passCompetitionUser(Long competitionId, Long userId) {
        rankReviewOverrideRepository.findByCompetitionIdAndUserId(competitionId, userId)
                .orElseGet(() -> rankReviewOverrideRepository.save(RankReviewOverride.builder()
                        .competitionId(competitionId)
                        .userId(userId)
                        .build()));
    }

    @Transactional
    public void unpassCompetitionUser(Long competitionId, Long userId) {
        rankReviewOverrideRepository.deleteByCompetitionIdAndUserId(competitionId, userId);
    }

    private List<Map<String, Object>> buildReview(List<Long> teamIds, LocalDateTime referenceTime,
                                                  Set<Long> overridden) {
        Map<Long, Map<String, Object>> players = new LinkedHashMap<>();
        Map<Long, Set<String>> teamNamesByUser = new HashMap<>();

        for (Long teamId : teamIds) {
            Team team = teamRepository.findById(teamId).orElse(null);
            String teamName = team != null ? team.getName() : null;
            for (TeamMember member : teamMemberRepository.findByTeamId(teamId)) {
                Long userId = member.getUserId();
                if (userId == null || overridden.contains(userId)) {
                    continue;
                }
                teamNamesByUser.computeIfAbsent(userId, k -> new LinkedHashSet<>())
                        .add(teamName != null ? teamName : ("#" + teamId));
            }
        }

        for (Long userId : teamNamesByUser.keySet()) {
            User user = userRepository.findById(userId).orElse(null);
            Certification cert = certificationRepository
                    .findFirstByUserIdAndTypeAndStatusOrderByReviewedAtDesc(userId, "RANK", "APPROVED")
                    .orElse(null);

            boolean outdated = cert == null || cert.getReviewedAt() == null
                    || cert.getReviewedAt().isBefore(referenceTime);
            if (!outdated) {
                continue;
            }

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", userId);
            m.put("username", user != null ? user.getUsername() : null);
            m.put("displayGameId", user != null ? user.getDisplayGameId() : null);
            m.put("teams", String.join("、", teamNamesByUser.get(userId)));
            m.put("rank", cert != null ? cert.getRank() : null);
            m.put("appliedAt", cert != null ? cert.getCreatedAt() : null);
            m.put("reviewedAt", cert != null ? cert.getReviewedAt() : null);
            m.put("referenceTime", referenceTime);
            players.put(userId, m);
        }

        return new ArrayList<>(players.values());
    }
}
