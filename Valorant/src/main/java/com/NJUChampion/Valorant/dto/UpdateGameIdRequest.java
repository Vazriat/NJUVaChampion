package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateGameIdRequest {
    @Pattern(
        regexp = "^.{1,8}#\\d{4,5}$",
        message = "游戏ID格式：1-8位主体内容 + # + 4-5位数字标记码"
    )
    private String gameId;
}