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
public class TeamApplicationVO {

    private Long id;

    /** APPLY 队员申请入队 / INVITE 队长邀请队员 */
    private String type;

    private Long teamId;
    private String teamName;
    private Long teamCaptainId;

    /** 来源帖子，为 null 表示来自战队页直接申请 */
    private Long postId;

    private Long initiatorUserId;
    private String initiatorName;
    private String initiatorUsername;

    /** APPLY 时为创建时的队长快照；处理权限看 teamCaptainId */
    private Long targetUserId;
    private String targetName;
    private String targetUsername;

    private String content;
    private String status;
    private LocalDateTime handledAt;
    private LocalDateTime createdAt;

    /** 当前用户能否同意/拒绝 */
    private Boolean canHandle;
    /** 当前用户能否撤回 */
    private Boolean canCancel;
}
