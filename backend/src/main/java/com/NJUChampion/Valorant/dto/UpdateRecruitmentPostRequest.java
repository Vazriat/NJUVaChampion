package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateRecruitmentPostRequest {

    @NotBlank(message = "请填写内容")
    @Size(max = 2000, message = "内容最多 2000 字")
    private String content;
}
