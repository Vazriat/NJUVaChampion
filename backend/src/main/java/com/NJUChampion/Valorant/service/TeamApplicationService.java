package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.common.DisplayNameUtil;
import com.NJUChampion.Valorant.dto.TeamApplicationVO;
import com.NJUChampion.Valorant.entity.RecruitmentPost;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.TeamApplication;
import com.NJUChampion.Valorant.entity.TeamMember;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.entity.UserNotification;
import com.NJUChampion.Valorant.repository.RecruitmentPostRepository;
import com.NJUChampion.Valorant.repository.TeamApplicationRepository;
import com.NJUChampion.Valorant.repository.TeamMemberRepository;
import com.NJUChampion.Valorant.repository.TeamRepository;
import com.NJUChampion.Valorant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 入队申请与邀请服务。统一承载三条入口：
 * 1. 人才市场里队员对招募帖发起申请（APPLY）
 * 2. 人才市场里队长对求职帖发起邀请（INVITE）
 * 3. 战队页直接点"申请加入"（APPLY，postId 为 null）
 *
 * 关键规则：
 * - 队员同时只能有 1 条 PENDING 的 APPLY；要申请其它战队必须先撤回。
 * - APPLY 的处理权限实时判定当前队长（team.captainId），不用记录里的 targetUserId 快照。
 * - 同意入队后连带作废该用户其它 PENDING 记录、关闭其求职帖。
 * - 队伍无人数上限，因此同意入队时不校验人数，也不关闭招募帖。
 */
@Service
@RequiredArgsConstructor
public class TeamApplicationService {

    private static final int MAX_CONTENT_LENGTH = 300;

    /** 待处理优先，其次按创建时间倒序 */
    private static final Comparator<TeamApplication> PENDING_FIRST = (a, b) -> {
        int pa = TeamApplication.STATUS_PENDING.equals(a.getStatus()) ? 0 : 1;
        int pb = TeamApplication.STATUS_PENDING.equals(b.getStatus()) ? 0 : 1;
        if (pa != pb) {
            return Integer.compare(pa, pb);
        }
        LocalDateTime ca = a.getCreatedAt();
        LocalDateTime cb = b.getCreatedAt();
        if (ca == null || cb == null) {
            return 0;
        }
        return cb.compareTo(ca);
    };

    private final TeamApplicationRepository applicationRepository;
    private final RecruitmentPostRepository postRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // ==================== 发起 ====================

    @Transactional
    public TeamApplicationVO create(Long currentUserId, String type, Long teamId,
                                    Long targetUserId, Long postId, String content) {
        String normalizedType = normalizeType(type);
        String normalizedContent = normalizeContent(content);

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (team.getStatus() == null || team.getStatus() != 1) {
            throw new IllegalArgumentException("战队已解散");
        }

        Long playerId;
        Long initiatorId;
        Long targetId;

        if (TeamApplication.TYPE_APPLY.equals(normalizedType)) {
            if (team.getCaptainId() == null) {
                throw new IllegalArgumentException("战队缺少队长，无法申请");
            }
            if (team.getCaptainId().equals(currentUserId)) {
                throw new IllegalArgumentException("你是该战队队长，无需申请");
            }
            if (!teamMemberRepository.findByUserId(currentUserId).isEmpty()) {
                throw new IllegalArgumentException("你已加入其他战队");
            }
            if (applicationRepository.findFirstByInitiatorUserIdAndTypeAndStatus(
                    currentUserId, TeamApplication.TYPE_APPLY, TeamApplication.STATUS_PENDING).isPresent()) {
                throw new IllegalArgumentException("你已有一支战队的入队申请待处理，请先撤回后再申请");
            }
            playerId = currentUserId;
            initiatorId = currentUserId;
            // 存队长快照仅用于展示，处理权限实时看 team.captainId
            targetId = team.getCaptainId();
        } else {
            if (team.getCaptainId() == null || !team.getCaptainId().equals(currentUserId)) {
                throw new IllegalArgumentException("只有队长可以邀请队员");
            }
            if (targetUserId == null) {
                throw new IllegalArgumentException("请选择要邀请的选手");
            }
            if (targetUserId.equals(currentUserId)) {
                throw new IllegalArgumentException("不能邀请自己");
            }
            User target = userRepository.findById(targetUserId)
                    .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
            if (target.getStatus() == null || target.getStatus() != 1) {
                throw new IllegalArgumentException("该用户已被禁用，无法邀请");
            }
            if (!teamMemberRepository.findByUserId(targetUserId).isEmpty()) {
                throw new IllegalArgumentException("该用户已加入其他战队");
            }
            playerId = targetUserId;
            initiatorId = currentUserId;
            targetId = targetUserId;
        }

        if (teamMemberRepository.existsByTeamIdAndUserId(team.getId(), playerId)) {
            throw new IllegalArgumentException("该用户已是该战队成员");
        }
        if (hasPendingBetween(team.getId(), playerId)) {
            throw new IllegalArgumentException("该选手与该战队已有待处理记录");
        }

        TeamApplication app = TeamApplication.builder()
                .type(normalizedType)
                .teamId(team.getId())
                .postId(postId)
                .initiatorUserId(initiatorId)
                .targetUserId(targetId)
                .content(normalizedContent)
                .status(TeamApplication.STATUS_PENDING)
                .build();
        TeamApplication saved = applicationRepository.save(app);

        if (TeamApplication.TYPE_APPLY.equals(normalizedType)) {
            notificationService.notifyOther(currentUserId, team.getCaptainId(),
                    UserNotification.TYPE_APPLICATION_RECEIVED,
                    "收到新的入队申请",
                    displayNameOf(playerId) + " 申请加入「" + team.getName() + "」"
                            + appendNote(normalizedContent),
                    UserNotification.REF_TEAM_APPLICATION, saved.getId());
        } else {
            notificationService.notifyOther(currentUserId, targetUserId,
                    UserNotification.TYPE_INVITE_RECEIVED,
                    "收到入队邀请",
                    "「" + team.getName() + "」邀请你加入" + appendNote(normalizedContent),
                    UserNotification.REF_TEAM_APPLICATION, saved.getId());
        }

        return toVOs(List.of(saved), currentUserId).get(0);
    }

    // ==================== 查询 ====================

    /** 我收到的：作为当前队长收到的入队申请 + 我收到的邀请 */
    public List<TeamApplicationVO> inbox(Long currentUserId) {
        Map<Long, TeamApplication> collected = new LinkedHashMap<>();

        teamRepository.findByCaptainId(currentUserId)
                .filter(t -> t.getStatus() != null && t.getStatus() == 1)
                .ifPresent(team -> applicationRepository
                        .findByTeamIdOrderByCreatedAtDesc(team.getId()).stream()
                        .filter(a -> TeamApplication.TYPE_APPLY.equals(a.getType()))
                        .forEach(a -> collected.put(a.getId(), a)));

        applicationRepository.findByTargetUserIdOrderByCreatedAtDesc(currentUserId).stream()
                .filter(a -> TeamApplication.TYPE_INVITE.equals(a.getType()))
                .forEach(a -> collected.putIfAbsent(a.getId(), a));

        return sortAndConvert(new ArrayList<>(collected.values()), currentUserId);
    }

    /** 我发起的：我提交的入队申请 + 我发出的邀请 */
    public List<TeamApplicationVO> mine(Long currentUserId) {
        return sortAndConvert(
                applicationRepository.findByInitiatorUserIdOrderByCreatedAtDesc(currentUserId), currentUserId);
    }

    /** 战队页队长视图：该队全部申请与邀请（含已处理） */
    public List<TeamApplicationVO> listTeamApplications(Long teamId, Long currentUserId) {
        Team team = requireCaptainedTeam(teamId, currentUserId);
        return sortAndConvert(
                applicationRepository.findByTeamIdOrderByCreatedAtDesc(team.getId()), currentUserId);
    }

    // ==================== 处理 ====================

    @Transactional
    public TeamApplicationVO accept(Long applicationId, Long currentUserId) {
        TeamApplication app = requirePending(applicationId);
        Team team = resolveTeamForHandling(app, currentUserId);
        Long playerId = playerOf(app);

        if (team.getStatus() == null || team.getStatus() != 1) {
            throw new IllegalArgumentException("战队已解散，无法同意");
        }
        User player = userRepository.findById(playerId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (player.getStatus() == null || player.getStatus() != 1) {
            throw new IllegalArgumentException("该用户已被禁用，无法加入");
        }
        if (!teamMemberRepository.findByUserId(playerId).isEmpty()) {
            throw new IllegalArgumentException("该用户已加入其他战队");
        }

        app.setStatus(TeamApplication.STATUS_ACCEPTED);
        app.setHandledAt(LocalDateTime.now());
        applicationRepository.save(app);

        teamMemberRepository.save(TeamMember.builder()
                .teamId(team.getId())
                .userId(playerId)
                .role("MEMBER")
                .build());

        // 连带：作废该用户其它待处理记录、关闭其求职帖。招募帖不关闭（队伍无人数上限）
        cancelOtherPending(playerId, app.getId());
        closePlayerAd(playerId);

        if (TeamApplication.TYPE_APPLY.equals(app.getType())) {
            notificationService.notifyOther(currentUserId, app.getInitiatorUserId(),
                    UserNotification.TYPE_APPLICATION_ACCEPTED,
                    "入队申请已通过",
                    "你申请加入「" + team.getName() + "」已通过，欢迎加入！",
                    UserNotification.REF_TEAM, team.getId());
        } else {
            // 邀请的发起人是队长；若期间发生队长转让，通知当前队长更合理
            Long captainId = team.getCaptainId() != null ? team.getCaptainId() : app.getInitiatorUserId();
            notificationService.notifyOther(currentUserId, captainId,
                    UserNotification.TYPE_APPLICATION_ACCEPTED,
                    "队员已接受邀请",
                    displayNameOf(playerId) + " 已接受「" + team.getName() + "」的邀请",
                    UserNotification.REF_TEAM, team.getId());
        }

        return toVOs(List.of(app), currentUserId).get(0);
    }

    @Transactional
    public TeamApplicationVO reject(Long applicationId, Long currentUserId) {
        TeamApplication app = requirePending(applicationId);
        Team team = resolveTeamForHandling(app, currentUserId);
        app.setStatus(TeamApplication.STATUS_REJECTED);
        app.setHandledAt(LocalDateTime.now());
        applicationRepository.save(app);

        notificationService.notifyOther(currentUserId, app.getInitiatorUserId(),
                UserNotification.TYPE_APPLICATION_REJECTED,
                TeamApplication.TYPE_APPLY.equals(app.getType()) ? "入队申请未通过" : "邀请被拒绝",
                TeamApplication.TYPE_APPLY.equals(app.getType())
                        ? "你申请加入「" + team.getName() + "」未通过"
                        : displayNameOf(app.getTargetUserId()) + " 拒绝了「" + team.getName() + "」的邀请",
                UserNotification.REF_TEAM_APPLICATION, app.getId());

        return toVOs(List.of(app), currentUserId).get(0);
    }

    /** 撤回：发起方本人（选手撤回自己的入队申请 / 队长撤回自己发出的邀请） */
    @Transactional
    public TeamApplicationVO cancel(Long applicationId, Long currentUserId) {
        TeamApplication app = requirePending(applicationId);
        if (!app.getInitiatorUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("只能撤回自己发起的记录");
        }
        app.setStatus(TeamApplication.STATUS_CANCELLED);
        app.setHandledAt(LocalDateTime.now());
        applicationRepository.save(app);

        Team team = teamRepository.findById(app.getTeamId()).orElse(null);
        String teamName = team != null ? team.getName() : "该战队";
        if (TeamApplication.TYPE_APPLY.equals(app.getType())) {
            notificationService.notifyOther(currentUserId, team != null ? team.getCaptainId() : null,
                    UserNotification.TYPE_APPLICATION_CANCELLED,
                    "入队申请已撤回",
                    displayNameOf(app.getInitiatorUserId()) + " 撤回了加入「" + teamName + "」的申请",
                    UserNotification.REF_TEAM_APPLICATION, app.getId());
        } else {
            notificationService.notifyOther(currentUserId, app.getTargetUserId(),
                    UserNotification.TYPE_APPLICATION_CANCELLED,
                    "邀请已撤回",
                    "「" + teamName + "」撤回了对你的入队邀请",
                    UserNotification.REF_TEAM_APPLICATION, app.getId());
        }

        return toVOs(List.of(app), currentUserId).get(0);
    }

    /** 供 TeamService 踢人时调用：作废该用户的全部待处理记录 */
    @Transactional
    public void cancelAllPendingForUser(Long userId) {
        cancelOtherPending(userId, null);
    }

    // ==================== 内部 ====================

    private Long playerOf(TeamApplication app) {
        return TeamApplication.TYPE_APPLY.equals(app.getType())
                ? app.getInitiatorUserId()
                : app.getTargetUserId();
    }

    /** 用户展示名，用户不存在时给一个中性占位，避免通知里出现 "null" */
    private String displayNameOf(Long userId) {
        if (userId == null) {
            return "某用户";
        }
        return DisplayNameUtil.of(userRepository.findById(userId).orElse(null), "某用户");
    }

    private String appendNote(String content) {
        return content == null ? "" : "\n附言：" + content;
    }

    private TeamApplication requirePending(Long applicationId) {
        TeamApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("记录不存在"));
        if (!TeamApplication.STATUS_PENDING.equals(app.getStatus())) {
            throw new IllegalArgumentException("该记录已处理，无法重复操作");
        }
        return app;
    }

    /**
     * 校验处理权限并返回队伍。
     * APPLY 看当前队长；INVITE 看被邀请人。
     */
    private Team resolveTeamForHandling(TeamApplication app, Long currentUserId) {
        Team team = teamRepository.findById(app.getTeamId())
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (TeamApplication.TYPE_APPLY.equals(app.getType())) {
            if (team.getCaptainId() == null || !team.getCaptainId().equals(currentUserId)) {
                throw new IllegalArgumentException("只有队长可以处理入队申请");
            }
        } else if (!app.getTargetUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("只有被邀请人可以处理该邀请");
        }
        return team;
    }

    private Team requireCaptainedTeam(Long teamId, Long currentUserId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (team.getCaptainId() == null || !team.getCaptainId().equals(currentUserId)) {
            throw new IllegalArgumentException("只有队长可以查看入队申请");
        }
        return team;
    }

    private boolean hasPendingBetween(Long teamId, Long playerId) {
        return applicationRepository
                .findByTeamIdAndStatusOrderByCreatedAtDesc(teamId, TeamApplication.STATUS_PENDING)
                .stream()
                .anyMatch(a -> playerId.equals(a.getInitiatorUserId()) || playerId.equals(a.getTargetUserId()));
    }

    private void cancelOtherPending(Long playerId, Long exceptId) {
        List<TeamApplication> candidates = new ArrayList<>();
        candidates.addAll(applicationRepository.findByInitiatorUserIdAndStatus(
                playerId, TeamApplication.STATUS_PENDING));
        candidates.addAll(applicationRepository.findByTargetUserIdAndStatus(
                playerId, TeamApplication.STATUS_PENDING));

        Set<Long> seen = new HashSet<>();
        LocalDateTime now = LocalDateTime.now();
        for (TeamApplication a : candidates) {
            if (!seen.add(a.getId())) {
                continue;
            }
            if (!TeamApplication.STATUS_PENDING.equals(a.getStatus())) {
                continue;
            }
            if (exceptId != null && exceptId.equals(a.getId())) {
                continue;
            }
            a.setStatus(TeamApplication.STATUS_CANCELLED);
            a.setHandledAt(now);
            applicationRepository.save(a);
        }
    }

    private void closePlayerAd(Long playerId) {
        postRepository.findFirstByUserIdAndTypeAndStatus(
                        playerId, RecruitmentPost.TYPE_PLAYER, RecruitmentPost.STATUS_OPEN)
                .ifPresent(post -> {
                    post.setStatus(RecruitmentPost.STATUS_CLOSED);
                    postRepository.save(post);
                });
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("请选择类型");
        }
        String normalized = type.trim().toUpperCase();
        if (!TeamApplication.TYPE_APPLY.equals(normalized) && !TeamApplication.TYPE_INVITE.equals(normalized)) {
            throw new IllegalArgumentException("类型不合法：" + type);
        }
        return normalized;
    }

    private String normalizeContent(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        String normalized = content.trim();
        if (normalized.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("附言最多 " + MAX_CONTENT_LENGTH + " 字");
        }
        return normalized;
    }

    private List<TeamApplicationVO> sortAndConvert(List<TeamApplication> apps, Long currentUserId) {
        List<TeamApplication> sorted = new ArrayList<>(apps);
        sorted.sort(PENDING_FIRST);
        return toVOs(sorted, currentUserId);
    }

    private List<TeamApplicationVO> toVOs(List<TeamApplication> apps, Long currentUserId) {
        if (apps == null || apps.isEmpty()) {
            return List.of();
        }

        Set<Long> teamIds = apps.stream()
                .map(TeamApplication::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Team> teamMap = teamIds.isEmpty() ? Map.of()
                : teamRepository.findAllById(teamIds).stream()
                        .collect(Collectors.toMap(Team::getId, t -> t, (a, b) -> a));

        Set<Long> userIds = new HashSet<>();
        for (TeamApplication app : apps) {
            if (app.getInitiatorUserId() != null) {
                userIds.add(app.getInitiatorUserId());
            }
            if (app.getTargetUserId() != null) {
                userIds.add(app.getTargetUserId());
            }
        }
        Map<Long, User> userMap = userIds.isEmpty() ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        List<TeamApplicationVO> result = new ArrayList<>();
        for (TeamApplication app : apps) {
            Team team = teamMap.get(app.getTeamId());
            User initiator = userMap.get(app.getInitiatorUserId());
            User target = userMap.get(app.getTargetUserId());
            Long teamCaptainId = team != null ? team.getCaptainId() : null;

            boolean pending = TeamApplication.STATUS_PENDING.equals(app.getStatus());
            boolean canHandle = false;
            boolean canCancel = false;
            if (pending && currentUserId != null) {
                canHandle = TeamApplication.TYPE_APPLY.equals(app.getType())
                        ? currentUserId.equals(teamCaptainId)
                        : currentUserId.equals(app.getTargetUserId());
                canCancel = currentUserId.equals(app.getInitiatorUserId());
            }

            result.add(TeamApplicationVO.builder()
                    .id(app.getId())
                    .type(app.getType())
                    .teamId(app.getTeamId())
                    .teamName(team != null ? team.getName() : null)
                    .teamCaptainId(teamCaptainId)
                    .postId(app.getPostId())
                    .initiatorUserId(app.getInitiatorUserId())
                    .initiatorName(DisplayNameUtil.of(initiator, "未知用户"))
                    .initiatorUsername(initiator != null ? initiator.getUsername() : null)
                    .targetUserId(app.getTargetUserId())
                    .targetName(DisplayNameUtil.of(target, "未知用户"))
                    .targetUsername(target != null ? target.getUsername() : null)
                    .content(app.getContent())
                    .status(app.getStatus())
                    .handledAt(app.getHandledAt())
                    .createdAt(app.getCreatedAt())
                    .canHandle(canHandle)
                    .canCancel(canCancel)
                    .build());
        }
        return result;
    }
}
