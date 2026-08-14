package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCompetitionRequest {
    @NotBlank(message = "活动名称不能为空")
    @Size(min = 2, max = 50, message = "活动名称长度2-50个字符")
    private String name;

    @Size(max = 500, message = "简介不超过500个字符")
    private String description;
}
