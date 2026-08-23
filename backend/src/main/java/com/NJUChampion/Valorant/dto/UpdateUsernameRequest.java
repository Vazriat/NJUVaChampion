package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateUsernameRequest {
    @NotBlank(message = "新用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度3-50个字符")
    private String newUsername;
}