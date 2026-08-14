package com.NJUChampion.Valorant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "tournaments")
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SETUP";

    @Column(name = "max_teams", nullable = false)
    @Builder.Default
    private Integer maxTeams = 2;

    @Column(name = "bracket_type", nullable = false, length = 30)
    @Builder.Default
    private String bracketType = "SINGLE_ELIMINATION";

    /** CUP / LEAGUE */
    @Column(nullable = false, length = 10)
    @Builder.Default
    private String type = "CUP";

    /**
     * CUP: SINGLE_ELIM / DOUBLE_ELIM / SWISS_ELIM
     * LEAGUE: SINGLE_RR / DOUBLE_RR
     */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String format = "SINGLE_ELIM";

    /** 多阶段赛事当前阶段（0=瑞士轮, 1=淘汰赛） */
    @Column(name = "current_stage")
    private Integer currentStage;

    @Column(name = "swiss_rounds")
    @Builder.Default
    private Integer swissRounds = 5;

    @Column(name = "knockout_format", length = 20)
    @Builder.Default
    private String knockoutFormat = "SINGLE_ELIM";

    @Column(name = "swiss_pairing_mode", length = 20)
    @Builder.Default
    private String swissPairingMode = "RANDOM";

    @Column(name = "swiss_seed")
    private Long swissSeed;

    @Column(name = "current_swiss_round")
    @Builder.Default
    private Integer currentSwissRound = 0;

@Column(name = "champion_team_id")
    private Long championTeamId;

    /** 派生自某个报名活动（Competition）的子赛事；独立赛事为 null */
    @Column(name = "competition_id")
    private Long competitionId;

    @Column(name = "group_name", length = 50)
    private String groupName;

    /** 联赛是否打季后赛 */
    @Column(name = "has_playoffs")
    @Builder.Default
    private Boolean hasPlayoffs = false;

    /** 季后赛赛制：SINGLE_ELIM / DOUBLE_ELIM */
    @Column(name = "playoff_format", length = 20)
    private String playoffFormat;

    /** 季后赛规模：2 / 4 / 8 */
    @Column(name = "playoff_size")
    private Integer playoffSize;

    @Column(nullable = false)
    @Builder.Default
    private Integer statusFlag = 1;

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