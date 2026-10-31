package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 入队申请 / 邀请，统一承载三条入口：
 * 1. 人才市场里队员对招募帖发起申请（APPLY，postId 指向招募帖）
 * 2. 人才市场里队长对求职帖发起邀请（INVITE，postId 指向求职帖）
 * 3. 战队页直接点"申请加入"（APPLY，postId 为 null）
 *
 * 处理权限判定（见 TeamApplicationService）：
 * - APPLY：实时判定 caller.id == team.captainId。targetUserId 仅存创建时的队长快照，
 *   避免队长转让后申请卡在旧队长名下无法处理。
 * - INVITE：判定 caller.id == targetUserId。
 *
 * 约束（应用层校验）：
 * - 队员同时只能有 1 条 PENDING 的 APPLY
 * - 同一（用户, 队伍）组合同时只能有 1 条 PENDING（不分 type）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "team_applications", indexes = {
        @Index(name = "idx_app_target_status", columnList = "target_user_id,status"),
        @Index(name = "idx_app_initiator_status", columnList = "initiator_user_id,status"),
        @Index(name = "idx_app_team_status", columnList = "team_id,status")
})
public class TeamApplication {

    /** 队员申请入队 */
    public static final String TYPE_APPLY = "APPLY";
    /** 队长邀请队员 */
    public static final String TYPE_INVITE = "INVITE";

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_ACCEPTED = "ACCEPTED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    /** 来源帖子；为 null 表示来自战队页直接申请 */
    @Column(name = "post_id")
    private Long postId;

    /** 发起方：APPLY 时是队员，INVITE 时是队长 */
    @Column(name = "initiator_user_id", nullable = false)
    private Long initiatorUserId;

    /** 接收方：APPLY 时为创建时的队长快照，INVITE 时为被邀请的队员 */
    @Column(name = "target_user_id", nullable = false)
    private Long targetUserId;

    /** 附言，自由文本 */
    @Column(length = 300)
    private String content;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = STATUS_PENDING;

    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
