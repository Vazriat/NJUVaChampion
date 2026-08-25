package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SwissStandingVO {
    private Long teamId;
    private String teamName;
    private Integer wins;
    private Integer losses;
    private Double buchholz;
    private Integer roundDiff;
    /** ACTIVE=继续参赛 / QUALIFIED=晋级 / ELIMINATED=淘汰 */
    private String status;
}
