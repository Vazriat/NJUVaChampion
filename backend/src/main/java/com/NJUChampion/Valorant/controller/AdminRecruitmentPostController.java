package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.RecruitmentPostVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.RecruitmentPostService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 管理员人才市场管理。
 * 访问受 SecurityConfig 的 /api/admin/** hasRole("ADMIN") 保护。
 */
@RestController
@RequestMapping("/api/admin/recruitment-posts")
@RequiredArgsConstructor
public class AdminRecruitmentPostController {

    private final RecruitmentPostService postService;

    /** 全部帖子（含已关闭），可按类型/状态/关键词过滤 */
    @GetMapping
    public Result<List<RecruitmentPostVO>> list(@RequestParam(required = false) String type,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String keyword,
                                                @AuthenticationPrincipal User user) {
        return Result.success(postService.listForAdmin(
                type, status, keyword, user != null ? user.getId() : null));
    }

    /**
     * 下架帖子：置为 CLOSED 并通知作者。
     * 用 POST /take-down 而不是 DELETE，是因为这里不做物理删除，语义上更准确。
     * 下架后作者可以重新发布一条新帖（旧帖已 CLOSED，不占用"一队一帖"的名额）。
     */
    @PostMapping("/{id}/take-down")
    public Result<Void> takeDown(@PathVariable Long id, @AuthenticationPrincipal User user) {
        postService.takeDown(id, user.getId());
        return Result.success();
    }
}
