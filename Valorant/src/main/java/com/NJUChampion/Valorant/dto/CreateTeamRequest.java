package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTeamRequest {
    @NotBlank(message = "战队名不能为空")
    @Size(min = 2, max = 50, message = "战队名长度2-50个字符")
    private String name;

    private String logo;

    @Size(max = 500, message = "简介不能超过500个字符")
    private String description;
}