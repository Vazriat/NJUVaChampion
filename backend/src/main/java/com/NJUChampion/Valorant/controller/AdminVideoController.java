package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 赛事视频：管理端。ADMIN 鉴权由 SecurityConfig 的 /api/admin/** 规则统一处理。
 */
@RestController
@RequiredArgsConstructor
public class AdminVideoController {

    private final VideoService videoService;

    /** HIDDEN 下架 / ACTIVE 恢复 */
    @PatchMapping("/api/admin/videos/{id}/status")
    public Result<Void> setStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        videoService.setStatus(id, body.get("status"));
        return Result.success();
    }
}
