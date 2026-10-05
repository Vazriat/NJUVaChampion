package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 人才市场帖子。
 * 队伍招募帖（TEAM）与选手求职帖（PLAYER）结构一致，合并为一张表，用 type 区分。
 *
 * 约束（应用层校验，DB 无法用唯一索引表达，因为同一主体可存在多条 CLOSED 历史帖）：
 * - 同一队伍同时只能有 1 条 OPEN 的 TEAM 帖
 * - 同一用户同时只能有 1 条 OPEN 的 PLAYER 帖
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "recruitment_posts", indexes = {
        @Index(name = "idx_post_type_status", columnList = "type,status"),
        @Index(name = "idx_post_user", columnList = "user_id"),
        @Index(name = "idx_post_team", columnList = "team_id")
})
public class RecruitmentPost {

    /** 帖子类型：队伍招人 */
    public static final String TYPE_TEAM = "TEAM";
    /** 帖子类型：选手求职 */
    public static final String TYPE_PLAYER = "PLAYER";
    /** 状态：开放中 */
    public static final String STATUS_OPEN = "OPEN";
    /** 状态：已关闭 */
    public static final String STATUS_CLOSED = "CLOSED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String type;

    /** 仅 TEAM 类型有值 */
    @Column(name = "team_id")
    private Long teamId;

    /** 发布者（TEAM 类型时即该队队长） */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 唯一的内容字段，自由文本 */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = STATUS_OPEN;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
