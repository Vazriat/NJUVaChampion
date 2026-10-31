package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateVideoRequest;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 赛事视频：回放 / 精彩集锦。
 *
 * 只存外链不存文件；上传权限在 Service 内校验（管理员 / 裁判 / 参赛队员）。
 */
@RestController
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    /** 某场比赛的视频 */
    @GetMapping("/api/videos")
    public Result<List<Map<String, Object>>> listByMatch(@RequestParam Long matchId) {
        return Result.success(videoService.listByMatch(matchId));
    }

    /** 全站最新视频（直播页的赛事视频分区），带赛事名与场次名，前端按赛事分组 */
    @GetMapping("/api/videos/recent")
    public Result<List<Map<String, Object>>> recent(@RequestParam(defaultValue = "40") int limit) {
        return Result.success(videoService.recent(limit));
    }

    /** 某赛事的视频聚合（按分类筛选、分页） */
    @GetMapping("/api/videos/tournament/{tournamentId}")
    public Result<Map<String, Object>> listByTournament(@PathVariable Long tournamentId,
                                                        @RequestParam(required = false) String category,
                                                        @RequestParam(defaultValue = "1") int page,
                                                        @RequestParam(defaultValue = "24") int size) {
        return Result.success(videoService.listByTournament(tournamentId, category, page, size));
    }

    /** 上传时可选的比赛：该赛事下已完结的场次 */
    @GetMapping("/api/videos/selectable-matches")
    public Result<List<Map<String, Object>>> selectableMatches(@RequestParam Long tournamentId) {
        return Result.success(videoService.selectableMatches(tournamentId));
    }

    @PostMapping("/api/videos")
    public Result<Map<String, Object>> create(@AuthenticationPrincipal User user,
                                              @Valid @RequestBody CreateVideoRequest req) {
        boolean admin = "ADMIN".equals(user.getRole());
        return Result.success(videoService.create(
                user.getId(), admin, req.getMatchId(), req.getUrl(), req.getTitle(), req.getCategory()));
    }

    @DeleteMapping("/api/videos/{id}")
    public Result<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        videoService.delete(user.getId(), "ADMIN".equals(user.getRole()), id);
        return Result.success();
    }
}
