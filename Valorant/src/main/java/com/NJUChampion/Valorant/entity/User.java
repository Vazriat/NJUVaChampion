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
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(name = "game_id", length = 50)
    private String gameId;

    @Column(unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "PLAYER";

    @Column(nullable = false)
    @Builder.Default
    private Integer status = 1;

    @Column(length = 200)
    private String contact;

    @Column(name = "verified_type", length = 20)
    private String verifiedType;

    @Column(name = "verified_rank", length = 50)
    private String verifiedRank;

    @Column(name = "rank_public")
    @Builder.Default
    private Boolean rankPublic = false;

    @Column(name = "display_preference", length = 20)
    @Builder.Default
    private String displayPreference = "GAME_ID";

    @Column(name = "contact_public")
    @Builder.Default
    private Boolean contactPublic = false;

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

    @Transient
    public String getDisplayGameId() {
        if (gameId == null || gameId.isBlank()) return null;
        int idx = gameId.lastIndexOf('#');
        return idx > 0 ? gameId.substring(0, idx) : gameId;
    }
}