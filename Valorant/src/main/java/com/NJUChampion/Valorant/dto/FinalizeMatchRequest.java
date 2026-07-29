package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class FinalizeMatchRequest {
    @Min(value = 0, message = "Wins must be >= 0")
    private int team1Wins;

    @Min(value = 0, message = "Wins must be >= 0")
    private int team2Wins;
}
