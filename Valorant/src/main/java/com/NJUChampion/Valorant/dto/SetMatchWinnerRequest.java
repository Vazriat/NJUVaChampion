package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SetMatchWinnerRequest {
    @NotNull(message = "获胜队伍ID不能为空")
    private Long winnerTeamId;
}