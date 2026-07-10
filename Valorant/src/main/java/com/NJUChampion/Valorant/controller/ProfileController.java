package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.*;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class ProfileController {

    private final UserService userService;

    @GetMapping("/profile")
    public Result<Map<String, Object>> profile(@AuthenticationPrincipal User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("gameId", user.getGameId());
        map.put("displayGameId", user.getDisplayGameId());
        map.put("password", null);
        map.put("email", user.getEmail());
        map.put("role", user.getRole());
        map.put("status", user.getStatus());
        map.put("createdAt", user.getCreatedAt());
        map.put("updatedAt", user.getUpdatedAt());
        return Result.success(map);
    }

    @PutMapping("/username")
    public Result<Map<String, Object>> updateUsername(@Valid @RequestBody UpdateUsernameRequest req,
                                                       @AuthenticationPrincipal User user) {
        if ("ADMIN".equals(user.getRole())) {
            return Result.error(403, "管理员不能修改用户名");
        }
        User updated = userService.updateUsername(user.getId(), req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("username", updated.getUsername());
        return Result.success(map);
    }

    @PutMapping("/email")
    public Result<Map<String, Object>> updateEmail(@Valid @RequestBody UpdateEmailRequest req,
                                                    @AuthenticationPrincipal User user) {
        if ("ADMIN".equals(user.getRole())) {
            return Result.error(403, "管理员不能修改邮箱");
        }
        User updated = userService.updateEmail(user.getId(), req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("email", updated.getEmail());
        return Result.success(map);
    }

    @PutMapping("/game-id")
    public Result<Map<String, Object>> updateGameId(@Valid @RequestBody UpdateGameIdRequest req,
                                                     @AuthenticationPrincipal User user) {
        if ("ADMIN".equals(user.getRole())) {
            return Result.error(403, "管理员不能修改游戏ID");
        }
        User updated = userService.updateGameId(user.getId(), req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("gameId", updated.getGameId());
        map.put("displayGameId", updated.getDisplayGameId());
        return Result.success(map);
    }

    @PutMapping("/password")
    public Result<Void> updatePassword(@Valid @RequestBody UpdatePasswordRequest req,
                                       @AuthenticationPrincipal User user) {
        if ("ADMIN".equals(user.getRole())) {
            return Result.error(403, "管理员请使用后台管理修改密码");
        }
        userService.updatePassword(user.getId(), req);
        return Result.success();
    }
}