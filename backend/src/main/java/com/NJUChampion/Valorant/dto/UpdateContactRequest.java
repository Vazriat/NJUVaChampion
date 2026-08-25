package com.NJUChampion.Valorant.dto;

import lombok.Data;

@Data
public class UpdateContactRequest {
    private String contact;
    private Boolean contactPublic;
}