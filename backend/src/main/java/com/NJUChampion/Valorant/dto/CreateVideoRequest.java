package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateVideoRequest {

    @NotNull(message = "请选择比赛")
    private Long matchId;

    @NotBlank(message = "请填写视频链接")
    @Size(max = 500, message = "链接过长")
    private String url;

    @Size(max = 100, message = "标题最多 100 字")
    private String title;

    /** REPLAY 赛事回放 | HIGHLIGHT 精彩集锦 | OTHER 其他 */
    private String category;
}
