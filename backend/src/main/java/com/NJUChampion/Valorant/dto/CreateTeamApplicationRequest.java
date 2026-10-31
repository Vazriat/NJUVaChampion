package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTeamApplicationRequest {

    /** APPLY 队员申请入队 / INVITE 队长邀请队员 */
    @NotBlank(message = "请选择类型")
    private String type;

    @NotNull(message = "缺少战队")
    private Long teamId;

    /** INVITE 时必填 */
    private Long targetUserId;

    /** 来源帖子，可为空 */
    private Long postId;

    @Size(max = 300, message = "附言最多 300 字")
    private String content;
}
