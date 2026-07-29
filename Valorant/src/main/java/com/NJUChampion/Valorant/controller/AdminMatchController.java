package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateGamesRequest;
import com.NJUChampion.Valorant.dto.FinalizeMatchRequest;
import com.NJUChampion.Valorant.dto.RecordGameRequest;
import com.NJUChampion.Valorant.service.MatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/matches")
@RequiredArgsConstructor
public class AdminMatchController {

    private final MatchService matchService;

    @PostMapping("/{matchId}/games/init")
    public Result<List<Long>> initGames(@PathVariable Long matchId,
                                         @Valid @RequestBody CreateGamesRequest req) {
        List<Long> gameIds = matchService.initGames(matchId, req.getBoType());
        return Result.success(gameIds);
    }

    @PutMapping("/{matchId}/games/{gameId}")
    public Result<Void> recordGame(@PathVariable Long matchId,
                                    @PathVariable Long gameId,
                                    @Valid @RequestBody RecordGameRequest req) {
        matchService.recordGame(matchId, gameId, req);
        return Result.success();
    }

    @PostMapping("/{matchId}/finalize")
    public Result<Void> finalizeMatch(@PathVariable Long matchId,
                                       @Valid @RequestBody FinalizeMatchRequest req) {
        matchService.finalizeMatch(matchId, req);
        return Result.success();
    }

    @GetMapping("/{matchId}/detail")
    public Result<Map<String, Object>> getMatchDetail(@PathVariable Long matchId) {
        return Result.success(matchService.getMatchDetail(matchId));
    }
}
