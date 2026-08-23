package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class GroupRequest {
    @NotEmpty(message = "至少需要一组")
    private List<GroupItem> groups;

    @Data
    public static class GroupItem {
        @NotBlank(message = "组名不能为空")
        private String name;

        @NotBlank(message = "赛制不能为空")
        private String format;

        @NotEmpty(message = "每组至少一支队伍")
        private List<Long> teamIds;
    }
}
