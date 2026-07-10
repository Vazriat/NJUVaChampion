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
    private Integer maxTeams = 8;

    @Column(name = "bracket_type", nullable = false, length = 30)
    @Builder.Default
    private String bracketType = "SINGLE_ELIMINATION";

    @Column(name = "champion_team_id")
    private Long championTeamId;

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