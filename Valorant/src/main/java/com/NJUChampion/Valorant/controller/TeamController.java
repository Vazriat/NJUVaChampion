package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateTeamRequest;
import com.NJUChampion.Valorant.dto.TeamVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.TeamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @PostMapping
    public Result<TeamVO> create(@Valid @RequestBody CreateTeamRequest req,
                                 @AuthenticationPrincipal User user) {
        TeamVO team = teamService.create(req, user.getId());
        return Result.success(team);
    }

    @GetMapping
    public Result<List<TeamVO>> list() {
        return Result.success(teamService.listAll());
    }

    @GetMapping("/my")
    public Result<TeamVO> myTeam(@AuthenticationPrincipal User user) {
        TeamVO team = teamService.getMyTeam(user.getId());
        return Result.success(team);
    }

    @GetMapping("/{id}")
    public Result<TeamVO> detail(@PathVariable Long id) {
        return Result.success(teamService.getById(id));
    }

    @PostMapping("/{id}/join")
    public Result<Void> join(@PathVariable Long id, @AuthenticationPrincipal User user) {
        teamService.join(id, user.getId());
        return Result.success();
    }

    @PostMapping("/{id}/leave")
    public Result<Void> leave(@PathVariable Long id, @AuthenticationPrincipal User user) {
        teamService.leave(id, user.getId());
        return Result.success();
    }
}