package com.NJUChampion.Valorant.entity;

import com.NJUChampion.Valorant.common.JsonMapConverter;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "player_game_stats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"game_id", "user_id"}))
public class PlayerGameStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "player_name", length = 50)
    private String playerName;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "stats_json", columnDefinition = "TEXT")
    @Convert(converter = JsonMapConverter.class)
    @Builder.Default
    private Map<String, Object> stats = new java.util.HashMap<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
