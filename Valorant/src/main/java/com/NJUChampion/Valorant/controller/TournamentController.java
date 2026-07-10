package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.TournamentVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.TournamentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tournaments")
@RequiredArgsConstructor
public class TournamentController {

    private final TournamentService tournamentService;

    @GetMapping
    public Result<List<TournamentVO>> list() {
        return Result.success(tournamentService.listAll());
    }

    @GetMapping("/{id}")
    public Result<TournamentVO> detail(@PathVariable Long id) {
        return Result.success(tournamentService.getById(id));
    }

    @PostMapping("/{id}/register")
    public Result<Void> registerTeam(@PathVariable Long id, @RequestBody Map<String, Long> body,
                                      @AuthenticationPrincipal User user) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        tournamentService.registerTeam(id, teamId, user.getId());
        return Result.success();
    }

    @PostMapping("/{id}/unregister")
    public Result<Void> unregisterTeam(@PathVariable Long id, @RequestBody Map<String, Long> body,
                                        @AuthenticationPrincipal User user) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        tournamentService.unregisterTeam(id, teamId);
        return Result.success();
    }
}