package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.BindLiveChannelRequest;
import com.NJUChampion.Valorant.dto.StartLiveRequest;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.LiveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 直播与回放：裁判端。所有接口内部都会校验裁判资格。
 */
@RestController
@RequiredArgsConstructor
public class RefereeLiveController {

    private final LiveService liveService;

    // ===== 我的直播间 =====

    @GetMapping("/api/referee/live/channel")
    public Result<Object> myChannel(@AuthenticationPrincipal User user) {
        return Result.success(liveService.myChannel(user.getId()));
    }

    @PutMapping("/api/referee/live/channel")
    public Result<Map<String, Object>> bindChannel(@AuthenticationPrincipal User user,
                                                   @Valid @RequestBody BindLiveChannelRequest req) {
        return Result.success(liveService.bindChannel(user.getId(), req.getUrl()));
    }

    @DeleteMapping("/api/referee/live/channel")
    public Result<Void> unbindChannel(@AuthenticationPrincipal User user) {
        liveService.unbindChannel(user.getId());
        return Result.success();
    }

    // ===== 开播 / 结束 =====

    /** 可开播的比赛列表（进行中赛事里尚未开打的场次） */
    @GetMapping("/api/referee/live/matches")
    public Result<Object> startableMatches() {
        return Result.success(liveService.startableMatches());
    }

    /** 我当前正在直播的场次 */
    @GetMapping("/api/referee/live/mine")
    public Result<Object> myActiveStreams(@AuthenticationPrincipal User user) {
        return Result.success(liveService.myActiveStreams(user.getId()));
    }

    /** 开播确认框数据：房间标题、是否在播、能否开播、软提示 */
    @GetMapping("/api/referee/live/preview")
    public Result<Map<String, Object>> preview(@AuthenticationPrincipal User user,
                                               @RequestParam Long matchId) {
        return Result.success(liveService.preview(user.getId(), matchId));
    }

    @PostMapping("/api/referee/live/streams")
    public Result<Map<String, Object>> start(@AuthenticationPrincipal User user,
                                             @Valid @RequestBody StartLiveRequest req) {
        return Result.success(liveService.start(user.getId(), req.getMatchId()));
    }

    @PatchMapping("/api/referee/live/streams/{id}/end")
    public Result<Void> end(@AuthenticationPrincipal User user, @PathVariable Long id) {
        liveService.end(user.getId(), id, false);
        return Result.success();
    }
}
