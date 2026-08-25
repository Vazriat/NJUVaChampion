package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamVO {
    private Long id;
    private String name;
    private String logo;
    private String description;
    private Long captainId;
    private String captainName;
    private Integer status;
    private Integer memberCount;
    private LocalDateTime createdAt;
    private List<MemberVO> members;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberVO {
        private Long id;
        private Long userId;
        private String username;
        private String displayName;
        private String role;
        private LocalDateTime joinedAt;
    }
}