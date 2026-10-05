package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateRecruitmentPostRequest {

    /** TEAM 队伍招人 / PLAYER 选手求职 */
    @NotBlank(message = "请选择帖子类型")
    private String type;

    /** 唯一的内容字段，自由文本 */
    @NotBlank(message = "请填写内容")
    @Size(max = 2000, message = "内容最多 2000 字")
    private String content;
}
