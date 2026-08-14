package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TournamentVO {
    private Long id;
    private String name;
    private String description;
    private String status;
    private Integer maxTeams;
    private String bracketType;
    private String type;
    private String format;
    private Integer currentStage;
    private Integer swissRounds;
    private String knockoutFormat;
    private String swissPairingMode;
    private Integer currentSwissRound;
    private Boolean hasPlayoffs;
    private String playoffFormat;
    private Integer playoffSize;
    private Integer registeredCount;
    private Long championTeamId;
    private String championTeamName;
    private LocalDateTime createdAt;

    private List<RegisteredTeamInfo> registeredTeams;
    private List<MatchVO> matches;
    private List<LeagueStandingVO> leagueStandings;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisteredTeamInfo {
        private Long id;
        private Long teamId;
        private String teamName;
        private String teamLogo;
        private String captainName;
        private String description;
        private Integer memberCount;
        private Integer seed;
        private LocalDateTime registeredAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MatchVO {
        private Long id;
        private String stage;
        private Integer round;
        private Integer position;
        private Long team1Id;
        private String team1Name;
        private Long team2Id;
        private String team2Name;
        private Long winnerId;
        private String status;
        private Integer gamesPerMatch;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LeagueStandingVO {
        private Long teamId;
        private String teamName;
        private Integer wins;
        private Integer losses;
        private Integer roundDiff;
    }
}
