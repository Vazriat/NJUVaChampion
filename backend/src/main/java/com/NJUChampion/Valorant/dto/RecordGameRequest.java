package com.NJUChampion.Valorant.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class RecordGameRequest {
    private String screenshotBase64;
    private Integer team1Score;
    private Integer team2Score;
    private List<PlayerStatEntry> playerStats;

    @Data
    public static class PlayerStatEntry {
        private Long userId;
        private String playerName;
        private Long teamId;
        private Map<String, Object> stats;
    }
}
