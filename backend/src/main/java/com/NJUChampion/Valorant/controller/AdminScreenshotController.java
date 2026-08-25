package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.ScreenshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/screenshots")
@RequiredArgsConstructor
public class AdminScreenshotController {

    private final ScreenshotService screenshotService;

    @GetMapping
    public Result<List<Map<String, Object>>> list(
            @RequestParam(required = false) Long tournamentId,
            @RequestParam(required = false) String matchIds) {
        if (tournamentId != null) {
            return Result.success(screenshotService.listByTournamentId(tournamentId));
        }
        if (matchIds != null && !matchIds.isBlank()) {
            List<Long> ids = java.util.Arrays.stream(matchIds.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty()).map(Long::parseLong).toList();
            return Result.success(screenshotService.listByMatchIds(ids));
        }
        return Result.success(screenshotService.listAll());
    }

    @GetMapping("/search-by-tournament")
    public Result<List<Map<String, Object>>> searchByTournament(@RequestParam String q) {
        return Result.success(screenshotService.searchByTournamentName(q));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> stats() {
        return Result.success(screenshotService.getStats());
    }

    @DeleteMapping("/batch")
    public Result<Void> batchDelete(@RequestBody Map<String, List<Long>> body) {
        List<Long> gameIds = body.get("gameIds");
        if (gameIds == null || gameIds.isEmpty()) {
            return Result.error(400, "gameIds is required");
        }
        screenshotService.batchDelete(gameIds);
        return Result.success();
    }

    @DeleteMapping("/{gameId}")
    public Result<Void> delete(@PathVariable Long gameId) {
        screenshotService.delete(gameId);
        return Result.success();
    }
}
