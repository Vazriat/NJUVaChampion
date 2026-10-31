package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 裁判绑定的直播间。一个账号一条，绑一次永久复用。
 * roomId 仅 B 站有值，且必须是**真实房间号**（短号在绑定时已转换）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "referee_channels",
        uniqueConstraints = @UniqueConstraint(name = "uk_channel_user", columnNames = "user_id"))
public class RefereeChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** BILIBILI | HUYA | DOUYU | DOUYIN | OTHER */
    @Column(nullable = false, length = 20)
    private String platform;

    /** 仅 B 站：真实房间号（非短号） */
    @Column(name = "room_id", length = 32)
    private String roomId;

    /** 原始链接，仅用于跳转，不得直接作为 iframe src */
    @Column(name = "raw_url", nullable = false, length = 500)
    private String rawUrl;

    /** ACTIVE | HIDDEN（管理员可隐藏，隐藏后不出现在主播列表） */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

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
