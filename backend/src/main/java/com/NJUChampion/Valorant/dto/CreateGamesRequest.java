package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class CreateGamesRequest {
    @Min(value = 1, message = "BO must be at least 1")
    @Max(value = 5, message = "BO max 5")
    private int boType = 1;
}
