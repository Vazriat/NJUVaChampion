package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.common.DisplayNameUtil;
import com.NJUChampion.Valorant.dto.RecruitmentPostVO;
import com.NJUChampion.Valorant.entity.RecruitmentPost;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.TeamApplication;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 人才市场帖子服务。
 *
 * 队伍招募帖（TEAM）与选手求职帖（PLAYER）合并为一张表，用 type 区分；内容只有一个自由文本字段。
 * 这里同时负责计算"当前用户对该帖能否发起"，避免前端重复推导规则。
 */
@Service
@RequiredArgsConstructor
public class RecruitmentPostService {

    private static final int MAX_CONTENT_LENGTH = 2000;

    private final RecruitmentPostRepository postRepository;
    private final TeamApplicationRepository applicationRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // ==================== 查询 ====================

    /**
     * 帖子列表。
     *
     * @param userId 个人主页用：只看某个用户的帖子
     * @param teamId 队伍页用：只看某个队伍的招募帖
     */
    public List<RecruitmentPostVO> list(String type, String keyword, Long userId, Long teamId,
                                        Long currentUserId) {
        String normalizedType = normalizeType(type, false);
        String normalizedKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();

        List<RecruitmentPost> posts;
        if (userId != null) {
            posts = postRepository.findByUserIdAndStatusOrderByCreatedAtDesc(
                    userId, RecruitmentPost.STATUS_OPEN);
        } else if (teamId != null) {
            posts = postRepository.findByTeamIdAndStatusOrderByCreatedAtDesc(
                    teamId, RecruitmentPost.STATUS_OPEN);
        } else if (normalizedType != null) {
            posts = normalizedKeyword == null
                    ? postRepository.findByTypeAndStatusOrderByCreatedAtDesc(
                            normalizedType, RecruitmentPost.STATUS_OPEN)
                    : postRepository.findByTypeAndStatusAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            normalizedType, RecruitmentPost.STATUS_OPEN, normalizedKeyword);
        } else {
            posts = normalizedKeyword == null
                    ? postRepository.findByStatusOrderByCreatedAtDesc(RecruitmentPost.STATUS_OPEN)
                    : postRepository.findByStatusAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
                            RecruitmentPost.STATUS_OPEN, normalizedKeyword);
        }

        // 按 userId / teamId 取回的结果通常只有 0~1 条，类型与关键词过滤放内存里做即可
        if (userId != null || teamId != null) {
            String kw = normalizedKeyword == null ? null : normalizedKeyword.toLowerCase();
            posts = posts.stream()
                    .filter(p -> normalizedType == null || normalizedType.equals(p.getType()))
                    .filter(p -> kw == null
                            || (p.getContent() != null && p.getContent().toLowerCase().contains(kw)))
                    .collect(Collectors.toList());
        }

        return enrich(posts, currentUserId, true);
    }

    public RecruitmentPostVO detail(Long postId, Long currentUserId) {
        RecruitmentPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        List<RecruitmentPostVO> vos = enrich(List.of(post), currentUserId, true);
        if (vos.isEmpty()) {
            throw new IllegalArgumentException("所属战队已解散，该招募帖不可用");
        }
        return vos.get(0);
    }

    /** 我发布的帖子。自己的帖子始终可见，不过滤已关闭或队伍已解散的。 */
    public List<RecruitmentPostVO> mine(Long currentUserId) {
        return enrich(postRepository.findByUserIdOrderByCreatedAtDesc(currentUserId), currentUserId, false);
    }

    // ==================== 写入 ====================

    @Transactional
    public RecruitmentPostVO create(Long currentUserId, String type, String content) {
        String normalizedType = normalizeType(type, true);
        String normalizedContent = normalizeContent(content);

        RecruitmentPost post = RecruitmentPost.builder()
                .type(normalizedType)
                .userId(currentUserId)
                .content(normalizedContent)
                .status(RecruitmentPost.STATUS_OPEN)
                .build();

        if (RecruitmentPost.TYPE_TEAM.equals(normalizedType)) {
            // 队长身份以 Team.captainId 为准，不要用 TeamMember.role
            Team team = teamRepository.findByCaptainId(currentUserId)
                    .filter(t -> t.getStatus() != null && t.getStatus() == 1)
                    .orElseThrow(() -> new IllegalArgumentException("只有队长可以发布队伍招募"));
            if (postRepository.findFirstByTeamIdAndTypeAndStatus(
                    team.getId(), normalizedType, RecruitmentPost.STATUS_OPEN).isPresent()) {
                throw new IllegalArgumentException("你的战队已有招募帖，请先关闭后再发布");
            }
            post.setTeamId(team.getId());
        } else {
            if (!teamMemberRepository.findByUserId(currentUserId).isEmpty()) {
                throw new IllegalArgumentException("你已加入战队，无法发布求职帖");
            }
            if (postRepository.findFirstByUserIdAndTypeAndStatus(
                    currentUserId, normalizedType, RecruitmentPost.STATUS_OPEN).isPresent()) {
                throw new IllegalArgumentException("你已有求职帖，请先关闭后再发布");
            }
        }

        return toVO(postRepository.save(post), currentUserId);
    }

    @Transactional
    public RecruitmentPostVO update(Long postId, Long currentUserId, String content) {
        RecruitmentPost post = requireOwnPost(postId, currentUserId);
        post.setContent(normalizeContent(content));
        return toVO(postRepository.save(post), currentUserId);
    }

    @Transactional
    public void close(Long postId, Long currentUserId) {
        RecruitmentPost post = requireOwnPost(postId, currentUserId);
        post.setStatus(RecruitmentPost.STATUS_CLOSED);
        postRepository.save(post);
    }

    // ==================== 管理员 ====================

    /**
     * 管理员视图：不过滤状态（含已关闭），可按类型/状态/关键词过滤。
     * 数据量小，直接在内存里过滤，避免为每种组合写一个派生查询。
     */
    public List<RecruitmentPostVO> listForAdmin(String type, String status, String keyword, Long currentUserId) {
        String normalizedType = normalizeType(type, false);
        String normalizedStatus = normalizeStatus(status);
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim().toLowerCase();

        List<RecruitmentPost> filtered = postRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(p -> normalizedType == null || normalizedType.equals(p.getType()))
                .filter(p -> normalizedStatus == null || normalizedStatus.equals(p.getStatus()))
                .filter(p -> kw == null
                        || (p.getContent() != null && p.getContent().toLowerCase().contains(kw)))
                .collect(Collectors.toList());

        return enrich(filtered, currentUserId, false);
    }

    /** 管理员下架：置 CLOSED 并通知作者 */
    @Transactional
    public void takeDown(Long postId, Long adminUserId) {
        RecruitmentPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        if (RecruitmentPost.STATUS_CLOSED.equals(post.getStatus())) {
            throw new IllegalArgumentException("该帖子已处于关闭状态");
        }
        post.setStatus(RecruitmentPost.STATUS_CLOSED);
        postRepository.save(post);

        notificationService.notifyOther(adminUserId, post.getUserId(),
                UserNotification.TYPE_POST_TAKEN_DOWN,
                "你的信息已被管理员下架",
                "你发布在人才市场的信息已被管理员下架。如有疑问请联系赛事管理方。",
                UserNotification.REF_RECRUITMENT_POST, post.getId());
    }

    // ==================== 内部 ====================

    private RecruitmentPost requireOwnPost(Long postId, Long currentUserId) {
        RecruitmentPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        if (!post.getUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("无权操作他人的帖子");
        }
        return post;
    }

    private String normalizeType(String type, boolean required) {
        if (type == null || type.isBlank()) {
            if (required) {
                throw new IllegalArgumentException("请选择帖子类型");
            }
            return null;
        }
        String normalized = type.trim().toUpperCase();
        if (!RecruitmentPost.TYPE_TEAM.equals(normalized) && !RecruitmentPost.TYPE_PLAYER.equals(normalized)) {
            throw new IllegalArgumentException("帖子类型不合法：" + type);
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        if (!RecruitmentPost.STATUS_OPEN.equals(normalized)
                && !RecruitmentPost.STATUS_CLOSED.equals(normalized)) {
            throw new IllegalArgumentException("帖子状态不合法：" + status);
        }
        return normalized;
    }

    private String normalizeContent(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("请填写内容");
        }
        String normalized = content.trim();
        if (normalized.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("内容最多 " + MAX_CONTENT_LENGTH + " 字");
        }
        return normalized;
    }

    private RecruitmentPostVO toVO(RecruitmentPost post, Long currentUserId) {
        List<RecruitmentPostVO> vos = enrich(List.of(post), currentUserId, false);
        return vos.isEmpty() ? null : vos.get(0);
    }

    private List<RecruitmentPostVO> enrich(List<RecruitmentPost> posts, Long currentUserId, boolean filterUnavailable) {
        if (posts == null || posts.isEmpty()) {
            return List.of();
        }

        // 批量取队伍与用户，避免逐条查询
        Set<Long> teamIds = posts.stream()
                .map(RecruitmentPost::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Team> teamMap = teamIds.isEmpty() ? Map.of()
                : teamRepository.findAllById(teamIds).stream()
                        .collect(Collectors.toMap(Team::getId, t -> t, (a, b) -> a));

        Set<Long> userIds = posts.stream()
                .map(RecruitmentPost::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userIds.isEmpty() ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        MyState state = loadMyState(currentUserId);

        List<RecruitmentPostVO> result = new ArrayList<>();
        for (RecruitmentPost post : posts) {
            Team team = post.getTeamId() == null ? null : teamMap.get(post.getTeamId());
            boolean teamGone = RecruitmentPost.TYPE_TEAM.equals(post.getType())
                    && (team == null || team.getStatus() == null || team.getStatus() != 1);
            if (teamGone && filterUnavailable) {
                continue;
            }
            result.add(buildVO(post, team, userMap.get(post.getUserId()), currentUserId, state));
        }
        return result;
    }

    private RecruitmentPostVO buildVO(RecruitmentPost post, Team team, User author,
                                      Long currentUserId, MyState state) {
        boolean mine = currentUserId != null && currentUserId.equals(post.getUserId());
        boolean open = RecruitmentPost.STATUS_OPEN.equals(post.getStatus());

        TeamApplication related = null;
        boolean canApply = false;

        if (!mine && open) {
            if (RecruitmentPost.TYPE_TEAM.equals(post.getType())) {
                // 队伍帖：看"我"与该队伍之间有没有待处理记录；且队员同时只能申请一支战队
                related = post.getTeamId() == null ? null : state.pendingByTeam.get(post.getTeamId());
                canApply = related == null && !state.inAnyTeam && !state.hasPendingApply;
            } else {
                // 求职帖：看"我"作为队长有没有已经邀请/已被该选手申请
                related = state.pendingInviteToUser.get(post.getUserId());
                if (related == null) {
                    related = state.pendingApplyFromUser.get(post.getUserId());
                }
                canApply = related == null && !state.captainedTeamIds.isEmpty();
            }
        }

        return RecruitmentPostVO.builder()
                .id(post.getId())
                .type(post.getType())
                .teamId(post.getTeamId())
                .teamName(team != null ? team.getName() : null)
                .userId(post.getUserId())
                .displayName(DisplayNameUtil.of(author, "未知用户"))
                .username(author != null ? author.getUsername() : null)
                .content(post.getContent())
                .status(post.getStatus())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .mine(mine)
                .canApply(canApply)
                .applicationStatus(related != null ? related.getStatus() : null)
                .applicationId(related != null ? related.getId() : null)
                .build();
    }

    /** 当前用户在人才市场里的关系状态，用于推导 canApply */
    private MyState loadMyState(Long currentUserId) {
        MyState state = new MyState();
        if (currentUserId == null) {
            return state;
        }

        state.inAnyTeam = !teamMemberRepository.findByUserId(currentUserId).isEmpty();
        state.captainedTeamIds = teamRepository.findByCaptainId(currentUserId)
                .filter(t -> t.getStatus() != null && t.getStatus() == 1)
                .map(t -> (Set<Long>) new HashSet<>(Set.of(t.getId())))
                .orElseGet(HashSet::new);

        for (TeamApplication app : applicationRepository.findByInitiatorUserIdAndStatus(
                currentUserId, TeamApplication.STATUS_PENDING)) {
            if (TeamApplication.TYPE_APPLY.equals(app.getType())) {
                state.hasPendingApply = true;
                state.pendingByTeam.put(app.getTeamId(), app);
            } else {
                state.pendingInviteToUser.put(app.getTargetUserId(), app);
            }
        }
        for (TeamApplication app : applicationRepository.findByTargetUserIdAndStatus(
                currentUserId, TeamApplication.STATUS_PENDING)) {
            if (TeamApplication.TYPE_APPLY.equals(app.getType())) {
                state.pendingApplyFromUser.put(app.getInitiatorUserId(), app);
                state.pendingByTeam.put(app.getTeamId(), app);
            } else {
                state.pendingByTeam.put(app.getTeamId(), app);
            }
        }
        return state;
    }

    private static final class MyState {
        private boolean inAnyTeam;
        /** 我作为队员发出的、待处理的入队申请（全局同时只能 1 条） */
        private boolean hasPendingApply;
        private Set<Long> captainedTeamIds = new HashSet<>();
        /** key: teamId —— 我与该队伍的待处理关系 */
        private final Map<Long, TeamApplication> pendingByTeam = new HashMap<>();
        /** key: targetUserId —— 我发出的待处理邀请 */
        private final Map<Long, TeamApplication> pendingInviteToUser = new HashMap<>();
        /** key: initiatorUserId —— 我收到的待处理申请 */
        private final Map<Long, TeamApplication> pendingApplyFromUser = new HashMap<>();
    }
}
