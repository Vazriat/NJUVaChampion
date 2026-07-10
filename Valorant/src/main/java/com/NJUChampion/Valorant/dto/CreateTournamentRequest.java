package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTournamentRequest {
    @NotBlank(message = "赛事名称不能为空")
    @Size(min = 2, max = 50, message = "赛事名称长度2-50个字符")
    private String name;

    @Size(max = 500, message = "简介不超过500个字符")
    private String description;

    @Min(value = 2, message = "参赛队伍数最少为2")
    @Max(value = 8, message = "参赛队伍数最多为8")
    private Integer maxTeams = 2;
}