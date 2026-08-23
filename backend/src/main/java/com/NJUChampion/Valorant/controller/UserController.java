package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.LoginRequest;
import com.NJUChampion.Valorant.dto.RegisterRequest;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public Result<User> register(@Valid @RequestBody RegisterRequest req) {
        User user = userService.register(req);
        user.setPassword(null);
        return Result.success(user);
    }

    @PostMapping("/login")
    public Result<Map<String, String>> login(@Valid @RequestBody LoginRequest req) {
        String token = userService.login(req);
        return Result.success(Map.of("token", token));
    }
}
