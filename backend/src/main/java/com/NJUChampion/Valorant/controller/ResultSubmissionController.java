package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateResultSubmissionRequest;
import com.NJUChampion.Valorant.entity.MatchResultSubmission;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.ResultSubmissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 裁判端：赛果申报（需通过裁判认证；接口在身份认证门槛内） */
@RestController
@RequestMapping("/api/result-submissions")
@RequiredArgsConstructor
public class ResultSubmissionController {

    private final ResultSubmissionService resultSubmissionService;

    @PostMapping
    public Result<MatchResultSubmission> create(@RequestBody CreateResultSubmissionRequest req,
                                                @AuthenticationPrincipal User user) {
        return Result.success(resultSubmissionService.create(user.getId(), req));
    }

    @PutMapping("/{id}")
    public Result<MatchResultSubmission> update(@PathVariable Long id,
                                                @RequestBody CreateResultSubmissionRequest req,
                                                @AuthenticationPrincipal User user) {
        return Result.success(resultSubmissionService.update(user.getId(), id, req));
    }

    @GetMapping("/my")
    public Result<List<Map<String, Object>>> my(@AuthenticationPrincipal User user) {
        return Result.success(resultSubmissionService.listMine(user.getId()));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(resultSubmissionService.getMine(user.getId(), id));
    }

    @DeleteMapping("/{id}")
    public Result<Void> cancel(@PathVariable Long id, @AuthenticationPrincipal User user) {
        resultSubmissionService.cancel(user.getId(), id);
        return Result.success();
    }
}
