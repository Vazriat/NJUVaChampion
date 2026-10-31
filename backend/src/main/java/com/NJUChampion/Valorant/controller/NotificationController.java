package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.UserNotificationVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 定向通知接口（发给当前登录用户本人的消息）。
 * 认证门槛由 CertificationGateFilter 统一把关，不放入白名单。
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public Result<List<UserNotificationVO>> list(@AuthenticationPrincipal User user) {
        return Result.success(notificationService.list(user.getId()));
    }

    @GetMapping("/unread-count")
    public Result<Map<String, Long>> unreadCount(@AuthenticationPrincipal User user) {
        return Result.success(Map.of("count", notificationService.unreadCount(user.getId())));
    }

    @PostMapping("/{id}/read")
    public Result<Void> markRead(@PathVariable Long id, @AuthenticationPrincipal User user) {
        notificationService.markRead(id, user.getId());
        return Result.success();
    }

    @PostMapping("/read-all")
    public Result<Map<String, Integer>> markAllRead(@AuthenticationPrincipal User user) {
        return Result.success(Map.of("updated", notificationService.markAllRead(user.getId())));
    }
}
