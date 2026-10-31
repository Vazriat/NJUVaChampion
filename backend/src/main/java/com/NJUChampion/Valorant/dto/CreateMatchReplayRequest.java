package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateMatchReplayRequest {

    @NotNull(message = "缺少比赛")
    private Long matchId;

    @NotBlank(message = "请填写回放链接")
    @Size(max = 500, message = "链接过长")
    private String url;

    @Size(max = 100, message = "标题最多 100 字")
    private String title;
}
