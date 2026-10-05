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
public class UserNotificationVO {

    private Long id;
    private String type;
    private String title;
    private String content;

    /** 关联对象类型，前端据此决定跳转目标 */
    private String refType;
    private Long refId;

    private Boolean readFlag;
    private LocalDateTime createdAt;
}
