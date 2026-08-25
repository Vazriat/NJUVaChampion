package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CompetitionVO;
import com.NJUChampion.Valorant.dto.CreateCompetitionRequest;
import com.NJUChampion.Valorant.dto.GroupRequest;
import com.NJUChampion.Valorant.service.CompetitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/competitions")
@RequiredArgsConstructor
public class AdminCompetitionController {

    private final CompetitionService competitionService;

    @PostMapping
    public Result<CompetitionVO> create(@Valid @RequestBody CreateCompetitionRequest req) {
        return Result.success(competitionService.create(req));
    }

    @PostMapping("/{id}/publish")
    public Result<CompetitionVO> publish(@PathVariable Long id) {
        return Result.success(competitionService.publish(id));
    }

    @PostMapping("/{id}/group")
    public Result<Void> group(@PathVariable Long id, @Valid @RequestBody GroupRequest req) {
        competitionService.group(id, req);
        return Result.success();
    }

    @PostMapping("/{id}/register")
    public Result<Void> registerTeam(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        competitionService.registerTeamByAdmin(id, teamId);
        return Result.success();
    }

    @PostMapping("/{id}/batch-register")
    public Result<Void> batchRegisterTeam(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> teamIds = body.get("teamIds");
        if (teamIds == null || teamIds.isEmpty()) {
            return Result.error(400, "请提供战队ID列表");
        }
        competitionService.batchRegisterTeamByAdmin(id, teamIds);
        return Result.success();
    }

    @PostMapping("/{id}/unregister")
    public Result<Void> unregisterTeam(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        competitionService.unregisterTeamByAdmin(id, teamId);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        competitionService.delete(id);
        return Result.success();
    }
}
