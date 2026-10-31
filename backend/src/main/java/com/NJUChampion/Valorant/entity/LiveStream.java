package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 一场比赛的直播记录。开一次播一条，结束后保留历史。
 *
 * activeKey：LIVE 时等于 matchId，结束时置 null。
 * 配合唯一索引即可保证「一场同时只有一路直播」，同时允许多条历史记录
 * （MySQL 唯一索引允许多个 NULL）。
 *
 * platform / roomId 是开播时的快照，不随裁判之后修改频道而变化。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "live_streams",
        uniqueConstraints = @UniqueConstraint(name = "uk_live_active", columnNames = "active_key"),
        indexes = {
                @Index(name = "idx_live_match", columnList = "match_id"),
                @Index(name = "idx_live_referee", columnList = "referee_id,status"),
                @Index(name = "idx_live_status", columnList = "status,started_at")
        })
public class LiveStream {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(name = "referee_id", nullable = false)
    private Long refereeId;

    /** 频道被删除后置空，不影响历史记录的展示 */
    @Column(name = "channel_id")
    private Long channelId;

    @Column(nullable = false, length = 20)
    private String platform;

    @Column(name = "room_id", length = 32)
    private String roomId;

    /** 开播时的原始链接快照，仅用于跳转（iframe 只用 roomId 拼） */
    @Column(name = "raw_url", length = 500)
    private String rawUrl;

    /** LIVE | ENDED */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "active_key")
    private Long activeKey;

    @PrePersist
    protected void onCreate() {
        if (startedAt == null) {
            startedAt = LocalDateTime.now();
        }
    }
}
