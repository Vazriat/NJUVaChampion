package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 定向通知：发给某一个具体用户的消息。
 *
 * 与 announcements（广播通知）的区别：广播通知是所有人都能看，此处是按 userId 定向投递。
 *
 * 注意字段命名：MySQL 中 READ 是保留字，不能直接作为列名，
 * 因此 Java 字段用 readFlag，映射到列 is_read（参见 AGENTS.md 关于 MySQL 保留字的说明）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "user_notifications", indexes = {
        @Index(name = "idx_notif_user_read", columnList = "user_id,is_read"),
        @Index(name = "idx_notif_user_created", columnList = "user_id,created_at")
})
public class UserNotification {

    /** 收到一条入队申请 */
    public static final String TYPE_APPLICATION_RECEIVED = "APPLICATION_RECEIVED";
    /** 收到一条入队邀请 */
    public static final String TYPE_INVITE_RECEIVED = "INVITE_RECEIVED";
    /** 申请/邀请被同意 */
    public static final String TYPE_APPLICATION_ACCEPTED = "APPLICATION_ACCEPTED";
    /** 申请/邀请被拒绝 */
    public static final String TYPE_APPLICATION_REJECTED = "APPLICATION_REJECTED";
    /** 申请/邀请被对方撤回 */
    public static final String TYPE_APPLICATION_CANCELLED = "APPLICATION_CANCELLED";
    /** 被踢出战队 */
    public static final String TYPE_TEAM_DISMISSED = "TEAM_DISMISSED";
    /** 帖子被管理员下架 */
    public static final String TYPE_POST_TAKEN_DOWN = "POST_TAKEN_DOWN";

    /** 关联对象类型，供前端决定跳转目标 */
    public static final String REF_TEAM_APPLICATION = "TEAM_APPLICATION";
    public static final String REF_RECRUITMENT_POST = "RECRUITMENT_POST";
    public static final String REF_TEAM = "TEAM";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String content;

    @Column(name = "ref_type", length = 40)
    private String refType;

    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean readFlag = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (readFlag == null) {
            readFlag = false;
        }
    }
}
