package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateRecruitmentPostRequest;
import com.NJUChampion.Valorant.dto.RecruitmentPostVO;
import com.NJUChampion.Valorant.dto.UpdateRecruitmentPostRequest;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.RecruitmentPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 人才市场帖子接口。
 * 认证门槛由 CertificationGateFilter 统一把关，此处不放入白名单——未通过身份认证无法访问。
 */
@RestController
@RequestMapping("/api/recruitment-posts")
@RequiredArgsConstructor
public class RecruitmentPostController {

    private final RecruitmentPostService postService;

    @GetMapping
    public Result<List<RecruitmentPostVO>> list(@RequestParam(required = false) String type,
                                                @RequestParam(required = false) String keyword,
                                                @RequestParam(required = false) Long userId,
                                                @RequestParam(required = false) Long teamId,
                                                @AuthenticationPrincipal User user) {
        return Result.success(postService.list(
                type, keyword, userId, teamId, user != null ? user.getId() : null));
    }

    /** 必须声明在 /{id} 之前语义更清晰；Spring 的 PathPattern 本身也优先匹配字面量段 */
    @GetMapping("/mine")
    public Result<List<RecruitmentPostVO>> mine(@AuthenticationPrincipal User user) {
        return Result.success(postService.mine(user.getId()));
    }

    @GetMapping("/{id}")
    public Result<RecruitmentPostVO> detail(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(postService.detail(id, user != null ? user.getId() : null));
    }

    @PostMapping
    public Result<RecruitmentPostVO> create(@Valid @RequestBody CreateRecruitmentPostRequest req,
                                            @AuthenticationPrincipal User user) {
        return Result.success(postService.create(user.getId(), req.getType(), req.getContent()));
    }

    @PutMapping("/{id}")
    public Result<RecruitmentPostVO> update(@PathVariable Long id,
                                            @Valid @RequestBody UpdateRecruitmentPostRequest req,
                                            @AuthenticationPrincipal User user) {
        return Result.success(postService.update(id, user.getId(), req.getContent()));
    }

    @DeleteMapping("/{id}")
    public Result<Void> close(@PathVariable Long id, @AuthenticationPrincipal User user) {
        postService.close(id, user.getId());
        return Result.success();
    }
}
