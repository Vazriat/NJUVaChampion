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
public class CompetitionVO {
    private Long id;
    private String name;
    private String description;
    private String status;
    private Integer registeredCount;
    private LocalDateTime createdAt;
    private List<RegisteredTeamInfo> registeredTeams;
    private List<ChildTournament> childTournaments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegisteredTeamInfo {
        private Long teamId;
        private String teamName;
        private Long captainId;
        private String captainName;
        private Integer memberCount;
        private LocalDateTime registeredAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChildTournament {
        private Long tournamentId;
        private String name;
        private String groupName;
        private String format;
        private Integer maxTeams;
        private String status;
    }
}
