package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserVO {
    private Long id;
    private String username;
    private String gameId;
    private String displayGameId;
    private String role;
    private Integer status;
    private LocalDateTime createdAt;
    private TeamInfo team;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TeamInfo {
        private Long id;
        private String name;
        private String role;
    }
}