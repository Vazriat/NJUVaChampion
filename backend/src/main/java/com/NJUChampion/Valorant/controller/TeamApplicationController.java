package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateTeamApplicationRequest;
import com.NJUChampion.Valorant.dto.TeamApplicationVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.TeamApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 入队申请与邀请接口。
 * 认证门槛由 CertificationGateFilter 统一把关，不放入白名单。
 */
@RestController
@RequestMapping("/api/team-applications")
@RequiredArgsConstructor
public class TeamApplicationController {

    private final TeamApplicationService applicationService;

    @PostMapping
    public Result<TeamApplicationVO> create(@Valid @RequestBody CreateTeamApplicationRequest req,
                                            @AuthenticationPrincipal User user) {
        return Result.success(applicationService.create(
                user.getId(), req.getType(), req.getTeamId(),
                req.getTargetUserId(), req.getPostId(), req.getContent()));
    }

    @GetMapping("/inbox")
    public Result<List<TeamApplicationVO>> inbox(@AuthenticationPrincipal User user) {
        return Result.success(applicationService.inbox(user.getId()));
    }

    @GetMapping("/mine")
    public Result<List<TeamApplicationVO>> mine(@AuthenticationPrincipal User user) {
        return Result.success(applicationService.mine(user.getId()));
    }

    @PostMapping("/{id}/accept")
    public Result<TeamApplicationVO> accept(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(applicationService.accept(id, user.getId()));
    }

    @PostMapping("/{id}/reject")
    public Result<TeamApplicationVO> reject(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(applicationService.reject(id, user.getId()));
    }

    /** 撤回：选手撤回自己的入队申请 / 队长撤回自己发出的邀请 */
    @DeleteMapping("/{id}")
    public Result<TeamApplicationVO> cancel(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(applicationService.cancel(id, user.getId()));
    }
}
