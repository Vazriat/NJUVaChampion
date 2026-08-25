package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateTournamentRequest;
import com.NJUChampion.Valorant.dto.TournamentVO;
import com.NJUChampion.Valorant.service.TournamentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import java.util.Map;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/tournaments")
@RequiredArgsConstructor
public class AdminTournamentController {

    private final TournamentService tournamentService;

    @PostMapping
    public Result<TournamentVO> create(@Valid @RequestBody CreateTournamentRequest req) {
        return Result.success(tournamentService.create(req));
    }

    @PostMapping("/{id}/publish")
    public Result<TournamentVO> publish(@PathVariable Long id) {
        return Result.success(tournamentService.publish(id));
    }

    @PostMapping("/{id}/start")
    public Result<TournamentVO> start(@PathVariable Long id) {
        return Result.success(tournamentService.start(id));
    }

    @PostMapping("/{id}/register")
    public Result<Void> registerTeam(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        tournamentService.registerTeamByAdmin(id, teamId);
        return Result.success();
    }

    @PostMapping("/{id}/batch-register")
    public Result<Void> batchRegisterTeam(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> teamIds = body.get("teamIds");
        if (teamIds == null || teamIds.isEmpty()) {
            return Result.error(400, "请提供战队ID列表");
        }
        tournamentService.batchRegisterTeamByAdmin(id, teamIds);
        return Result.success();
    }

    @PostMapping("/{id}/unregister")
    public Result<Void> unregisterTeam(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long teamId = body.get("teamId");
        if (teamId == null) {
            return Result.error(400, "请提供战队ID");
        }
        tournamentService.unregisterTeamByAdmin(id, teamId);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        tournamentService.deleteTournament(id);
        return Result.success();
    }

    @GetMapping("/{id}/swiss/standings")
    public Result<List<com.NJUChampion.Valorant.dto.SwissStandingVO>> getSwissStandings(@PathVariable Long id) {
        return Result.success(tournamentService.getSwissStandingVOs(id));
    }

    @GetMapping("/{id}/league/standings")
    public Result<List<com.NJUChampion.Valorant.entity.LeagueStanding>> getLeagueStandings(@PathVariable Long id) {
        return Result.success(tournamentService.getLeagueStandings(id));
    }

    @PostMapping("/{id}/swiss/generate-knockout")
    public Result<Void> generateKnockout(@PathVariable Long id) {
        com.NJUChampion.Valorant.entity.Tournament tournament = tournamentService.getTournament(id);
        tournamentService.generateKnockoutBracket(tournament);
        return Result.success();
    }
}
