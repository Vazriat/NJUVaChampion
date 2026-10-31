package com.NJUChampion.Valorant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BindLiveChannelRequest {

    /** 直播链接，支持 B 站 / 虎牙 / 斗鱼 / 抖音 */
    @NotBlank(message = "请填写直播链接")
    @Size(max = 500, message = "链接过长")
    private String url;
}
