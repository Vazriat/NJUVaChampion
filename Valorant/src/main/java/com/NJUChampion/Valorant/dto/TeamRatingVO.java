package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamRatingVO {
    private Long teamId;
    private String teamName;
    private Integer memberCount;
    /** 段位最高的5人（降序），不足5人补"黑铁" */
    private List<String> topRanks;
    /** 5人段位分值之和 */
    private Integer score;
}
