package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CompetitionVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.CompetitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
public class CompetitionController {

    private final CompetitionService competitionService;

    @GetMapping
    public Result<List<CompetitionVO>> list() {
        return Result.success(competitionService.list());
    }

    @GetMapping("/{id}")
    public Result<CompetitionVO> detail(@PathVariable Long id) {
        return Result.success(competitionService.getById(id));
    }

    @PostMapping("/{id}/register")
    public Result<Void> register(@PathVariable Long id, @RequestBody Map<String, Long> body,
                                 @AuthenticationPrincipal User user) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        competitionService.registerTeam(id, teamId, user.getId());
        return Result.success();
    }

    @PostMapping("/{id}/unregister")
    public Result<Void> unregister(@PathVariable Long id, @RequestBody Map<String, Long> body,
                                   @AuthenticationPrincipal User user) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        competitionService.unregisterTeam(id, teamId, user.getId());
        return Result.success();
    }
}
