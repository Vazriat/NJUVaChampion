package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.CompetitionVO;
import com.NJUChampion.Valorant.dto.CreateCompetitionRequest;
import com.NJUChampion.Valorant.dto.GroupRequest;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CompetitionService {

    private final CompetitionRepository competitionRepository;
    private final CompetitionTeamRepository competitionTeamRepository;
    private final TournamentRepository tournamentRepository;
    private final TournamentTeamRepository tournamentTeamRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public CompetitionVO create(CreateCompetitionRequest req) {
        Competition c = Competition.builder()
                .name(req.getName())
                .description(req.getDescription())
                .status("SETUP")
                .build();
        c = competitionRepository.save(c);
        return toVO(c);
    }

    @Transactional
    public CompetitionVO publish(Long id) {
        Competition c = get(id);
        if (!"SETUP".equals(c.getStatus())) {
            throw new IllegalArgumentException("活动状态不正确，当前状态：" + c.getStatus());
        }
        c.setStatus("REGISTRATION");
        c = competitionRepository.save(c);
        return toVO(c);
    }

    @Transactional
    public void registerTeam(Long competitionId, Long teamId, Long userId) {
        Competition c = get(competitionId);
        if (!"REGISTRATION".equals(c.getStatus())) {
            throw new IllegalArgumentException("活动不在报名阶段");
        }
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (!team.getCaptainId().equals(userId)) {
            throw new IllegalArgumentException("只有队长可以报名");
        }
        if (competitionTeamRepository.existsByCompetitionIdAndTeamId(competitionId, teamId)) {
            throw new IllegalArgumentException("该战队已报名");
        }
        competitionTeamRepository.save(CompetitionTeam.builder()
                .competitionId(competitionId)
                .teamId(teamId)
                .build());
    }

    @Transactional
    public void unregisterTeam(Long competitionId, Long teamId, Long userId) {
        Competition c = get(competitionId);
        if (!"REGISTRATION".equals(c.getStatus())) {
            throw new IllegalArgumentException("活动不在报名阶段");
        }
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (!team.getCaptainId().equals(userId)) {
            throw new IllegalArgumentException("只有队长可以取消报名");
        }
        CompetitionTeam ct = competitionTeamRepository.findByCompetitionIdAndTeamId(competitionId, teamId)
                .orElseThrow(() -> new IllegalArgumentException("该战队未报名"));
        competitionTeamRepository.delete(ct);
    }

    // ========== 管理员管理报名队伍 ==========

    @Transactional
    public void registerTeamByAdmin(Long competitionId, Long teamId) {
        Competition c = get(competitionId);
        if (!"REGISTRATION".equals(c.getStatus()) && !"SETUP".equals(c.getStatus())) {
            throw new IllegalArgumentException("当前状态不允许添加队伍");
        }
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (competitionTeamRepository.existsByCompetitionIdAndTeamId(competitionId, teamId)) {
            throw new IllegalArgumentException("该战队已报名");
        }
        competitionTeamRepository.save(CompetitionTeam.builder()
                .competitionId(competitionId)
                .teamId(teamId)
                .build());
    }

    @Transactional
    public void batchRegisterTeamByAdmin(Long competitionId, List<Long> teamIds) {
        Competition c = get(competitionId);
        if (!"REGISTRATION".equals(c.getStatus()) && !"SETUP".equals(c.getStatus())) {
            throw new IllegalArgumentException("当前状态不允许添加队伍");
        }
        for (Long teamId : teamIds) {
            if (!teamRepository.existsById(teamId)) {
                throw new IllegalArgumentException("战队不存在: " + teamId);
            }
            if (competitionTeamRepository.existsByCompetitionIdAndTeamId(competitionId, teamId)) {
                continue;
            }
            competitionTeamRepository.save(CompetitionTeam.builder()
                    .competitionId(competitionId)
                    .teamId(teamId)
                    .build());
        }
    }

    @Transactional
    public void unregisterTeamByAdmin(Long competitionId, Long teamId) {
        CompetitionTeam ct = competitionTeamRepository.findByCompetitionIdAndTeamId(competitionId, teamId)
                .orElseThrow(() -> new IllegalArgumentException("该战队未报名"));
        competitionTeamRepository.delete(ct);
    }

    /**
     * 手动分组：任意组数，每组独立指定赛制。
     * 每组生成一个独立的 Tournament（SETUP），之后走现有赛事流程。
     */
    @Transactional
    public void group(Long competitionId, GroupRequest req) {
        Competition c = get(competitionId);
        if (!"REGISTRATION".equals(c.getStatus())) {
            throw new IllegalArgumentException("活动不在报名阶段，无法分组");
        }

        List<CompetitionTeam> registered = competitionTeamRepository.findByCompetitionId(competitionId);
        Set<Long> registeredIds = registered.stream()
                .map(CompetitionTeam::getTeamId)
                .collect(Collectors.toSet());

        Set<Long> assigned = new HashSet<>();
        for (GroupRequest.GroupItem g : req.getGroups()) {
            for (Long teamId : g.getTeamIds()) {
                if (!registeredIds.contains(teamId)) {
                    throw new IllegalArgumentException("队伍 " + teamId + " 未报名，无法分配");
                }
                if (!assigned.add(teamId)) {
                    throw new IllegalArgumentException("队伍 " + teamId + " 被重复分配");
                }
            }
        }
        if (!assigned.equals(registeredIds)) {
            throw new IllegalArgumentException("分配不完整：报名队伍与分组队伍不一致");
        }

        for (GroupRequest.GroupItem g : req.getGroups()) {
            validateGroupCapacity(g.getFormat(), g.getTeamIds().size());

            Tournament t = Tournament.builder()
                    .name(c.getName() + "-" + g.getName())
                    .description("由活动「" + c.getName() + "」分组生成")
                    .status("SETUP")
                    .type(resolveType(g.getFormat()))
                    .format(g.getFormat().toUpperCase())
                    .maxTeams(g.getTeamIds().size())
                    .competitionId(competitionId)
                    .groupName(g.getName())
                    .build();
            t = tournamentRepository.save(t);

            int seed = 1;
            for (Long teamId : g.getTeamIds()) {
                tournamentTeamRepository.save(TournamentTeam.builder()
                        .tournamentId(t.getId())
                        .teamId(teamId)
                        .seed(seed++)
                        .build());
            }
        }

        c.setStatus("GROUPED");
        competitionRepository.save(c);
    }

    private void validateGroupCapacity(String format, int size) {
        switch (format.toUpperCase()) {
            case "SINGLE_ELIM":
                if (!Set.of(2, 4, 8, 16).contains(size)) {
                    throw new IllegalArgumentException("单败淘汰每组仅支持 2/4/8/16 队，当前 " + size + " 队");
                }
                break;
            case "DOUBLE_ELIM":
                if (!Set.of(4, 8).contains(size)) {
                    throw new IllegalArgumentException("双败淘汰每组仅支持 4/8 队，当前 " + size + " 队");
                }
                break;
            case "SWISS_ELIM":
                if (size != 16) {
                    throw new IllegalArgumentException("瑞士轮每组仅支持 16 队，当前 " + size + " 队");
                }
                break;
            case "SINGLE_RR":
            case "DOUBLE_RR":
                if (size < 2) {
                    throw new IllegalArgumentException("循环赛每组至少 2 队");
                }
                break;
            default:
                throw new IllegalArgumentException("不支持的赛制：" + format);
        }
    }

    private String resolveType(String format) {
        String f = format.toUpperCase();
        return ("SINGLE_RR".equals(f) || "DOUBLE_RR".equals(f)) ? "LEAGUE" : "CUP";
    }

    @Transactional
    public void delete(Long id) {
        Competition c = get(id);
        // 只删报名，子赛事（Tournament）保留，独立存在
        competitionTeamRepository.deleteByCompetitionId(id);
        competitionRepository.delete(c);
    }

    public List<CompetitionVO> list() {
        return competitionRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public CompetitionVO getById(Long id) {
        return toVODetail(get(id));
    }

    private Competition get(Long id) {
        return competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("活动不存在"));
    }

    private CompetitionVO toVO(Competition c) {
        int count = (int) competitionTeamRepository.countByCompetitionId(c.getId());
        return CompetitionVO.builder()
                .id(c.getId())
                .name(c.getName())
                .description(c.getDescription())
                .status(c.getStatus())
                .registeredCount(count)
                .createdAt(c.getCreatedAt())
                .build();
    }

    private CompetitionVO toVODetail(Competition c) {
        CompetitionVO vo = toVO(c);

        List<CompetitionTeam> registered = competitionTeamRepository.findByCompetitionId(c.getId());
        List<CompetitionVO.RegisteredTeamInfo> teamInfos = registered.stream().map(ct -> {
            Team team = teamRepository.findById(ct.getTeamId()).orElse(null);
            String captainName = null;
            if (team != null && team.getCaptainId() != null && team.getCaptainId() != 0L) {
                captainName = userRepository.findById(team.getCaptainId()).map(User::getUsername).orElse(null);
            }
            return CompetitionVO.RegisteredTeamInfo.builder()
                    .teamId(ct.getTeamId())
                    .teamName(team != null ? team.getName() : "未知战队")
                    .captainId(team != null ? team.getCaptainId() : null)
                    .captainName(captainName)
                    .memberCount(team != null ? (int) teamMemberRepository.countByTeamId(team.getId()) : 0)
                    .registeredAt(ct.getRegisteredAt())
                    .build();
        }).collect(Collectors.toList());
        vo.setRegisteredTeams(teamInfos);

        List<Tournament> children = tournamentRepository.findByCompetitionId(c.getId());
        List<CompetitionVO.ChildTournament> childVOs = children.stream().map(t ->
                CompetitionVO.ChildTournament.builder()
                        .tournamentId(t.getId())
                        .name(t.getName())
                        .groupName(t.getGroupName())
                        .format(t.getFormat())
                        .maxTeams(t.getMaxTeams())
                        .status(t.getStatus())
                        .build()
        ).collect(Collectors.toList());
        vo.setChildTournaments(childVOs);

        return vo;
    }
}
