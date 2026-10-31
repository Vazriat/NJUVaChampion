package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StartLiveRequest {

    @NotNull(message = "缺少比赛")
    private Long matchId;
}
