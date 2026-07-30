package com.NJUChampion.Valorant.entity;

import com.NJUChampion.Valorant.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "swiss_standings",
       uniqueConstraints = @UniqueConstraint(columnNames = {"tournament_id", "team_id"}))
public class SwissStanding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tournament_id", nullable = false)
    private Long tournamentId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Column(nullable = false)
    @Builder.Default
    private Integer wins = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer losses = 0;

    @Column(nullable = false)
    @Builder.Default
    private Double buchholz = 0.0;

    @Column(name = "round_diff", nullable = false)
    @Builder.Default
    private Integer roundDiff = 0;

    @Column(name = "opponent_ids", columnDefinition = "TEXT")
    @Builder.Default
    private String opponentIds = "[]";
}
