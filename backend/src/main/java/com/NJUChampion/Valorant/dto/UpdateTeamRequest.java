package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 队长修改战队资料。字段为 null 表示不修改。
 * 目前只开放简介，战队名涉及唯一性与赛事展示，仍由管理员修改。
 */
@Data
public class UpdateTeamRequest {

    @Size(max = 500, message = "简介不能超过500个字符")
    private String description;
}
