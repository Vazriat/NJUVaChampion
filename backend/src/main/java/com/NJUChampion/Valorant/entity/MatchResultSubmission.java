package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 赛果申报单：裁判或参赛队队长完整录入的"赛果草稿"，管理员审核通过后才落库到正式比赛数据。
 * payload 为 JSON 快照（boType/team1Wins/team2Wins/note/games[]），payloadVersion 支持结构演进。
 *
 * 提交人统一存在 refereeId 字段（历史列名），真实身份由 submitterRole 区分：
 * REFEREE = 通过裁判认证的用户，CAPTAIN = 该场比赛参赛队的队长。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "match_result_submissions")
public class MatchResultSubmission {

    /** 申报人是认证裁判 */
    public static final String ROLE_REFEREE = "REFEREE";
    /** 申报人是本场参赛队队长 */
    public static final String ROLE_CAPTAIN = "CAPTAIN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private Long matchId;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    /** 提交人 userId（裁判或队长），列名为历史遗留的 referee_id */
    @Column(name = "referee_id", nullable = false)
    private Long refereeId;

    /** REFEREE / CAPTAIN */
    @Column(name = "submitter_role", length = 20)
    private String submitterRole;

    /** PENDING / APPROVED / REJECTED / CANCELLED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "bo_type")
    private Integer boType;

    @Column(name = "team1_wins")
    private Integer team1Wins;

    @Column(name = "team2_wins")
    private Integer team2Wins;

    @Column(length = 500)
    private String note;

    /** 完整赛果快照 JSON */
    @Column(columnDefinition = "TEXT")
    private String payload;

    @Column(name = "payload_version")
    @Builder.Default
    private Integer payloadVersion = 1;

    @Column(name = "review_note", length = 500)
    private String reviewNote;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

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
