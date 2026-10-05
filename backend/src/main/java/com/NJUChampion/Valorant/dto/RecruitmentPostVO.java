package com.NJUChampion.Valorant.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecruitmentPostVO {

    private Long id;

    /** TEAM 队伍招人 / PLAYER 选手求职 */
    private String type;

    /** 仅 TEAM 类型有值 */
    private Long teamId;
    private String teamName;

    /** 发布者 */
    private Long userId;
    private String displayName;
    private String username;

    private String content;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 是否为当前用户发布 */
    private Boolean mine;

    /** 当前用户能否对该帖发起（申请或邀请） */
    private Boolean canApply;

    /** 当前用户与该帖相关的待处理记录状态，无则为 null */
    private String applicationStatus;

    /** 对应记录 id，便于前端直接撤回 */
    private Long applicationId;
}
