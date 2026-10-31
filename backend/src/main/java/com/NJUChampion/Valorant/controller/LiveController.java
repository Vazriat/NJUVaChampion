package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.LiveService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 直播与回放：公开只读。
 *
 * 访问门槛与 /api/tournaments/** 一致（需登录，未通过身份认证会被
 * CertificationGateFilter 拦截），故不放入任何白名单。
 */
@RestController
@RequiredArgsConstructor
public class LiveController {

    private final LiveService liveService;

    /**
     * 不带 matchId：正在直播列表（分页）
     * 带 matchId：某场的直播历史
     */
    @GetMapping("/api/live/streams")
    public Result<Object> streams(@RequestParam(required = false) Long matchId,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        if (matchId != null) {
            return Result.success(liveService.matchStreams(matchId));
        }
        return Result.success(liveService.liveList(page, size));
    }

    @GetMapping("/api/live/replays")
    public Result<List<Map<String, Object>>> replays(@RequestParam Long matchId) {
        return Result.success(liveService.replays(matchId));
    }

    /** 主播列表：已绑定直播间且未被隐藏的裁判 */
    @GetMapping("/api/live/channels")
    public Result<Map<String, Object>> channels(@RequestParam(defaultValue = "1") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return Result.success(liveService.channels(page, size));
    }
}
