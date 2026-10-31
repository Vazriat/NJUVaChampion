package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 赛事视频：回放、精彩集锦等。
 *
 * 只存外链，不存文件——视频本体托管在 B 站等平台，站内只保留元数据与封面。
 * 封面/时长由 VideoMetaResolver 在提交时抓取，抓不到就留空，不阻塞提交。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "match_videos",
        indexes = {
                @Index(name = "idx_video_match", columnList = "match_id,created_at"),
                @Index(name = "idx_video_tournament", columnList = "tournament_id,created_at")
        })
public class MatchVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    /** 冗余一份赛事 ID：赛事视频聚合页要用，避免每次连表 */
    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(nullable = false, length = 500)
    private String url;

    /** B 站稿件号，非 B 站为空。站内播放与封面抓取都依赖它 */
    @Column(length = 100)
    private String bvid;

    /** BILIBILI | OTHER */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String platform = "OTHER";

    @Column(length = 100)
    private String title;

    /** REPLAY 赛事回放 | HIGHLIGHT 精彩集锦 | OTHER 其他 */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String category = "REPLAY";

    @Column(name = "cover_url", length = 500)
    private String coverUrl;

    @Column(name = "duration_sec")
    private Integer durationSec;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    /** REFEREE | PLAYER | ADMIN */
    @Column(name = "uploader_role", length = 20)
    private String uploaderRole;

    /** ACTIVE | HIDDEN（管理员可下架） */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
