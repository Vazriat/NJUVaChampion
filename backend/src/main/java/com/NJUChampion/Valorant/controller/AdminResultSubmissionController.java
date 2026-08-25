package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.ReviewResultSubmissionRequest;
import com.NJUChampion.Valorant.entity.MatchResultSubmission;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.ResultSubmissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 管理端：赛果申报审核（ADMIN 角色） */
@RestController
@RequestMapping("/api/admin/result-submissions")
@RequiredArgsConstructor
public class AdminResultSubmissionController {

    private final ResultSubmissionService resultSubmissionService;

    @GetMapping
    public Result<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                  @RequestParam(required = false) Long tournamentId) {
        return Result.success(resultSubmissionService.listByStatus(status, tournamentId));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        return Result.success(resultSubmissionService.getDetail(id));
    }

    @PostMapping("/{id}/approve")
    public Result<MatchResultSubmission> approve(@PathVariable Long id,
                                                 @RequestBody ReviewResultSubmissionRequest req,
                                                 @AuthenticationPrincipal User admin) {
        return Result.success(resultSubmissionService.approve(admin.getId(), id, req));
    }

    @PostMapping("/{id}/reject")
    public Result<MatchResultSubmission> reject(@PathVariable Long id,
                                                @RequestBody ReviewResultSubmissionRequest req,
                                                @AuthenticationPrincipal User admin) {
        return Result.success(resultSubmissionService.reject(admin.getId(), id, req.getReviewNote()));
    }
}
