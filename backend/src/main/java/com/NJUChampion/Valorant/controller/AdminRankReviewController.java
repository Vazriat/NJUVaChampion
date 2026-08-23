package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.RankReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminRankReviewController {

    private final RankReviewService rankReviewService;

    @GetMapping("/tournaments/{tournamentId}/rank-review")
    public Result<List<Map<String, Object>>> tournamentReview(@PathVariable Long tournamentId) {
        return Result.success(rankReviewService.listTournamentReview(tournamentId));
    }

    @PostMapping("/tournaments/{tournamentId}/rank-review/pass")
    public Result<Void> passTournamentUser(@PathVariable Long tournamentId,
                                           @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return Result.error(400, "请提供 userId");
        }
        rankReviewService.passTournamentUser(tournamentId, userId);
        return Result.success();
    }

    @DeleteMapping("/tournaments/{tournamentId}/rank-review/pass")
    public Result<Void> unpassTournamentUser(@PathVariable Long tournamentId,
                                             @RequestParam Long userId) {
        rankReviewService.unpassTournamentUser(tournamentId, userId);
        return Result.success();
    }

    @GetMapping("/competitions/{competitionId}/rank-review")
    public Result<List<Map<String, Object>>> competitionReview(@PathVariable Long competitionId) {
        return Result.success(rankReviewService.listCompetitionReview(competitionId));
    }

    @PostMapping("/competitions/{competitionId}/rank-review/pass")
    public Result<Void> passCompetitionUser(@PathVariable Long competitionId,
                                            @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return Result.error(400, "请提供 userId");
        }
        rankReviewService.passCompetitionUser(competitionId, userId);
        return Result.success();
    }

    @DeleteMapping("/competitions/{competitionId}/rank-review/pass")
    public Result<Void> unpassCompetitionUser(@PathVariable Long competitionId,
                                              @RequestParam Long userId) {
        rankReviewService.unpassCompetitionUser(competitionId, userId);
        return Result.success();
    }
}
