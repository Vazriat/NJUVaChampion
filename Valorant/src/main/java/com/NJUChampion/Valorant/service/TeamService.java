package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.CreateTeamRequest;
import com.NJUChampion.Valorant.dto.TeamVO;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
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

    @Transactional
    public TeamVO create(CreateTeamRequest req, Long captainId) {
        if (teamRepository.existsByName(req.getName())) {
            throw new IllegalArgumentException("战队名已被使用");
        }

        if (teamRepository.findByCaptainId(captainId).isPresent()) {
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

        long count = teamMemberRepository.countByTeamId(teamId);
        if (count >= 5) {
            throw new IllegalArgumentException("战队人数已满（上限5人）");
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
}