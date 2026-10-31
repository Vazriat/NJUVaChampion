package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.LiveService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 直播与回放：管理端。ADMIN 鉴权由 SecurityConfig 的 /api/admin/** 规则统一处理。
 */
@RestController
@RequiredArgsConstructor
public class AdminLiveController {

    private final LiveService liveService;

    @GetMapping("/api/admin/live/channels")
    public Result<Map<String, Object>> channels(@RequestParam(required = false) String status,
                                                @RequestParam(defaultValue = "1") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return Result.success(liveService.adminChannels(status, page, size));
    }

    /** 隐藏 / 恢复某个直播间（对外展示的内容需要能一键下架） */
    @PatchMapping("/api/admin/live/channels/{id}/status")
    public Result<Void> setChannelStatus(@PathVariable Long id,
                                         @RequestBody Map<String, String> body) {
        liveService.setChannelStatus(id, body.get("status"));
        return Result.success();
    }

    /** 强制结束某场直播 */
    @PatchMapping("/api/admin/live/streams/{id}/end")
    public Result<Void> endStream(@AuthenticationPrincipal User user, @PathVariable Long id) {
        liveService.end(user.getId(), id, true);
        return Result.success();
    }
}
