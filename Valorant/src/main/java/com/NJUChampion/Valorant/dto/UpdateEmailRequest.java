package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateEmailRequest {
    @Email(message = "邮箱格式不正确")
    private String newEmail;
}