package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.common.Rank;
import com.NJUChampion.Valorant.dto.CreateTeamRequest;
import com.NJUChampion.Valorant.dto.TeamRatingVO;
import com.NJUChampion.Valorant.dto.TeamVO;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final TournamentMatchRepository tournamentMatchRepository;
    private final GameRecordRepository gameRecordRepository;
    private final TournamentRepository tournamentRepository;
    private final TournamentTeamRepository tournamentTeamRepository;
    private final SwissStandingRepository swissStandingRepository;
    private final CompetitionTeamRepository competitionTeamRepository;
    private final LeagueStandingRepository leagueStandingRepository;

    @Transactional
    public TeamVO create(CreateTeamRequest req, Long captainId) {
        if (teamRepository.existsByName(req.getName())) {
            throw new IllegalArgumentException("战队名已被使用");
        }

        if (teamRepository.findByCaptainId(captainId)
                .filter(t -> t.getStatus() == 1)
                .isPresent()) {
            throw new IllegalArgumentException("你已经拥有一个战队");
        }
        if (teamMemberRepository.findByUserId(captainId).stream()
                .anyMatch(tm -> "CAPTAIN".equals(tm.getRole()) || "MEMBER".equals(tm.getRole()))) {
            throw new IllegalArgumentException("你已加入其他战队，无法创建");
        }

        Team team = Team.builder()
                .name(req.getName())
                .logo(req.getLogo())
                .description(req.getDescription())
                .captainId(captainId)
                .build();
        team = teamRepository.save(team);

        TeamMember captain = TeamMember.builder()
                .teamId(team.getId())
                .userId(captainId)
                .role("CAPTAIN")
                .build();
        teamMemberRepository.save(captain);

        return toVO(team);
    }

    public List<TeamVO> listAll() {
        return teamRepository.findAll().stream()
                .filter(t -> t.getStatus() == 1)
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public TeamVO getById(Long teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        return toVODetail(team);
    }

    @Transactional
    public void join(Long teamId, Long userId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (team.getStatus() == 0) {
            throw new IllegalArgumentException("战队已解散");
        }

        List<TeamMember> myTeams = teamMemberRepository.findByUserId(userId);
        if (!myTeams.isEmpty()) {
            throw new IllegalArgumentException("你已加入其他战队");
        }

        if (teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
            throw new IllegalArgumentException("你已是该战队成员");
        }

        TeamMember member = TeamMember.builder()
                .teamId(teamId)
                .userId(userId)
                .role("MEMBER")
                .build();
        teamMemberRepository.save(member);
    }

    @Transactional
    public void leave(Long teamId, Long userId) {
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new IllegalArgumentException("你不是该战队成员"));

        if ("CAPTAIN".equals(member.getRole())) {
            throw new IllegalArgumentException("队长不能退出战队，请转让队长或解散战队");
        }

        teamMemberRepository.deleteByTeamIdAndUserId(teamId, userId);
    }

    public TeamVO getMyTeam(Long userId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) {
            throw new IllegalArgumentException("你尚未加入任何战队");
        }
        Team team = teamRepository.findById(memberships.get(0).getTeamId())
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        return toVODetail(team);
    }

    public List<TeamVO> getMyCaptainedTeams(Long userId) {
        return teamRepository.findByCaptainId(userId)
                .filter(t -> t.getStatus() == 1)
                .map(this::toVO)
                .map(List::of)
                .orElse(Collections.emptyList());
    }

    private TeamVO toVO(Team team) {
        User captain = team.getCaptainId() != null && team.getCaptainId() != 0L ? userRepository.findById(team.getCaptainId()).orElse(null) : null;
        long count = teamMemberRepository.countByTeamId(team.getId());

        return TeamVO.builder()
                .id(team.getId())
                .name(team.getName())
                .logo(team.getLogo())
                .description(team.getDescription())
                .captainId(team.getCaptainId())
                .captainName(captain != null ? getDisplayName(captain) : null)
                .status(team.getStatus())
                .memberCount((int) count)
                .createdAt(team.getCreatedAt())
                .build();
    }

    private TeamVO toVODetail(Team team) {
        TeamVO vo = toVO(team);
        List<TeamMember> members = teamMemberRepository.findByTeamId(team.getId());
        List<TeamVO.MemberVO> memberVOs = members.stream().map(m -> {
            User u = userRepository.findById(m.getUserId()).orElse(null);
            return TeamVO.MemberVO.builder()
                    .id(m.getId())
                    .userId(m.getUserId())
                    .username(u != null ? u.getUsername() : null)
                    .displayName(u != null ? getDisplayName(u) : null)
                    .role(m.getRole())
                    .joinedAt(m.getJoinedAt())
                    .build();
        }).collect(Collectors.toList());
        vo.setMembers(memberVOs);
        return vo;
    }

    private String getDisplayName(User user) {
        String display = user.getDisplayGameId();
        return display != null ? display : user.getUsername();
    }

    public List<Map<String, Object>> getMatchHistory(Long teamId) {
        List<TournamentMatch> matches = tournamentMatchRepository
                .findByTeam1IdOrTeam2IdOrderByCreatedAtDesc(teamId, teamId);

        List<Map<String, Object>> result = new java.util.ArrayList<>();

        for (TournamentMatch match : matches) {
            Map<String, Object> entry = new java.util.LinkedHashMap<>();
            entry.put("matchId", match.getId());
            entry.put("stage", match.getStage());
            entry.put("round", match.getRound());
            entry.put("status", match.getStatus());

            // Determine opponent
            boolean isTeam1 = teamId.equals(match.getTeam1Id());
            Long opponentId = isTeam1 ? match.getTeam2Id() : match.getTeam1Id();
            Team opponent = opponentId != null ? teamRepository.findById(opponentId).orElse(null) : null;
            entry.put("opponentId", opponentId);
            entry.put("opponentName", opponent != null ? opponent.getName() : null);

            // Tournament info
            Tournament tournament = tournamentRepository.findById(match.getTournamentId()).orElse(null);
            entry.put("tournamentId", match.getTournamentId());
            entry.put("tournamentName", tournament != null ? tournament.getName() : null);

            // Result
            boolean won = match.getWinnerId() != null && match.getWinnerId().equals(teamId);
            entry.put("winnerId", match.getWinnerId());
            entry.put("won", won);

            // Game records
            List<GameRecord> games = gameRecordRepository.findByMatchIdOrderByGameNumberAsc(match.getId());
            List<Map<String, Object>> gameVOs = new java.util.ArrayList<>();
            for (GameRecord g : games) {
                Map<String, Object> gv = new java.util.LinkedHashMap<>();
                gv.put("gameNumber", g.getGameNumber());
                gv.put("team1Score", g.getTeam1Score());
                gv.put("team2Score", g.getTeam2Score());
                gameVOs.add(gv);
            }
            entry.put("games", gameVOs);

            result.add(entry);
        }

        return result;
    }

    // ========== 战队评分 ==========

    public List<TeamRatingVO> listRatings(String sort) {
        List<TeamRatingVO> ratings = teamRepository.findAll().stream()
                .filter(t -> t.getStatus() == 1)
                .map(this::toRatingVO)
                .collect(Collectors.toList());

        if ("lexicographic".equalsIgnoreCase(sort)) {
            ratings.sort((a, b) -> compareLexicographicDesc(a, b));
        } else {
            ratings.sort(Comparator.comparingInt(TeamRatingVO::getScore).reversed());
        }
        return ratings;
    }

    private TeamRatingVO toRatingVO(Team team) {
        List<TeamMember> members = teamMemberRepository.findByTeamId(team.getId());

        List<Rank> ranks = new ArrayList<>();
        for (TeamMember m : members) {
            User u = userRepository.findById(m.getUserId()).orElse(null);
            Rank r = Rank.fromLabel(u != null ? u.getVerifiedRank() : null);
            if (r == null) {
                r = Rank.IRON;
            }
            ranks.add(r);
        }
        while (ranks.size() < 5) {
            ranks.add(Rank.IRON);
        }
        ranks.sort(Comparator.comparingInt(Rank::getOrder).reversed());
        List<Rank> top5 = ranks.subList(0, 5);

        int score = 0;
        List<String> topRanks = new ArrayList<>();
        for (Rank r : top5) {
            score += r.getScore();
            topRanks.add(r.getLabel());
        }

        return TeamRatingVO.builder()
                .teamId(team.getId())
                .teamName(team.getName())
                .memberCount(members.size())
                .topRanks(topRanks)
                .score(score)
                .build();
    }

    private int compareLexicographicDesc(TeamRatingVO a, TeamRatingVO b) {
        List<String> ra = a.getTopRanks();
        List<String> rb = b.getTopRanks();
        for (int i = 0; i < Math.min(ra.size(), rb.size()); i++) {
            int oa = Rank.orderOf(ra.get(i));
            int ob = Rank.orderOf(rb.get(i));
            if (oa != ob) {
                return Integer.compare(ob, oa);
            }
        }
        return 0;
    }

    /**
     * 用户被禁用时，处理其战队关系：
     * 队长 → 转让给最早加入的队员；无队员 → 解散战队。
     * 普通成员 → 直接移除成员关系。
     */
    @Transactional
    public void onUserDisabled(Long userId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);
        for (TeamMember m : memberships) {
            Team team = teamRepository.findById(m.getTeamId()).orElse(null);
            if (team == null || team.getStatus() != 1) {
                teamMemberRepository.deleteByTeamIdAndUserId(m.getTeamId(), userId);
                continue;
            }

            if (userId.equals(team.getCaptainId())) {
                List<TeamMember> others = teamMemberRepository.findByTeamId(team.getId()).stream()
                        .filter(x -> !x.getUserId().equals(userId))
                        .sorted(Comparator.comparing(TeamMember::getJoinedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .collect(Collectors.toList());

                if (others.isEmpty()) {
                    team.setStatus(0);
                    teamRepository.save(team);
                    teamMemberRepository.deleteByTeamId(team.getId());
                } else {
                    TeamMember newCaptain = others.get(0);
                    team.setCaptainId(newCaptain.getUserId());
                    teamRepository.save(team);
                    newCaptain.setRole("CAPTAIN");
                    teamMemberRepository.save(newCaptain);
                    teamMemberRepository.deleteByTeamIdAndUserId(team.getId(), userId);
                }
            } else {
                teamMemberRepository.deleteByTeamIdAndUserId(team.getId(), userId);
            }
        }
    }

    /**
     * 彻底删除战队（物理删除）。
     * 仅当战队没有任何「未删除赛事」的参赛记录时才允许删除；
     * 否则反馈并禁止，避免历史对阵/报名/积分出现孤儿引用。
     */
    @Transactional
    public void purgeTeam(Long teamId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (competitionTeamRepository.existsByTeamId(teamId)) {
            throw new IllegalArgumentException("该战队报名了未分组的赛事活动，无法彻底删除，请先取消报名或完成分组");
        }
        if (tournamentTeamRepository.existsByTeamId(teamId)) {
            throw new IllegalArgumentException("该战队有未删除的赛事报名记录，无法彻底删除，请先删除相关赛事或改为解散");
        }
        if (!tournamentMatchRepository.findByTeam1IdOrTeam2IdOrderByCreatedAtDesc(teamId, teamId).isEmpty()) {
            throw new IllegalArgumentException("该战队有未删除的赛事对阵记录，无法彻底删除，请先删除相关赛事或改为解散");
        }
        if (swissStandingRepository.existsByTeamId(teamId)) {
            throw new IllegalArgumentException("该战队有未删除的瑞士轮赛事记录，无法彻底删除，请先删除相关赛事或改为解散");
        }
        if (leagueStandingRepository.existsByTeamId(teamId)) {
            throw new IllegalArgumentException("该战队有未删除的联赛赛事记录，无法彻底删除，请先删除相关赛事或改为解散");
        }

        teamMemberRepository.deleteByTeamId(teamId);
        teamRepository.delete(team);
    }
}
