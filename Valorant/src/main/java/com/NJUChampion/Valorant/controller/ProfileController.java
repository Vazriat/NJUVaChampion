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
    private final com.NJUChampion.Valorant.repository.UserRepository userRepository;

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
        map.put("contact", user.getContact());
        map.put("contactPublic", user.getContactPublic());
        String displayName = "GAME_ID".equals(user.getDisplayPreference()) && user.getGameId() != null ? user.getDisplayGameId() : user.getUsername();
        map.put("displayName", displayName);
        map.put("displayPreference", user.getDisplayPreference());
        map.put("rankPublic", user.getRankPublic());
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

    @PutMapping("/contact")
    public Result<Map<String, Object>> updateContact(@RequestBody java.util.Map<String, Object> body,
                                                      @AuthenticationPrincipal User user) {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        if (body.containsKey("rankPublic")) {
            user.setRankPublic((Boolean) body.get("rankPublic"));
            userRepository.save(user);
            map.put("rankPublic", user.getRankPublic());
        }
        if (body.containsKey("contact") || body.containsKey("contactPublic")) {
            com.NJUChampion.Valorant.dto.UpdateContactRequest req = new com.NJUChampion.Valorant.dto.UpdateContactRequest();
            if (body.containsKey("contact")) req.setContact((String) body.get("contact"));
            if (body.containsKey("contactPublic")) req.setContactPublic((Boolean) body.get("contactPublic"));
            User updated = userService.updateContact(user.getId(), req);
            map.put("contact", updated.getContact());
            map.put("contactPublic", updated.getContactPublic());
        }
        return Result.success(map);
    }

    @PutMapping("/display-preference")
    public Result<Map<String, Object>> updateDisplayPreference(@Valid @RequestBody com.NJUChampion.Valorant.dto.UpdateDisplayPreferenceRequest req,
                                                               @AuthenticationPrincipal User user) {
        User updated = userService.updateDisplayPreference(user.getId(), req.getDisplayPreference());
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("displayPreference", updated.getDisplayPreference());
        return Result.success(map);
    }
}