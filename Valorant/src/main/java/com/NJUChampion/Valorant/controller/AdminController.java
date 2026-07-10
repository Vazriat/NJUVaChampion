package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.TeamMemberRepository;
import com.NJUChampion.Valorant.repository.TeamRepository;
import com.NJUChampion.Valorant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final String DEFAULT_PASSWORD = "123456";

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final PasswordEncoder passwordEncoder;

    // ==================== 用户管理 ====================

    @GetMapping("/users")
    public Result<List<Map<String, Object>>> listUsers() {
        List<Map<String, Object>> list = userRepository.findAll().stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("gameId", u.getGameId());
            m.put("displayGameId", u.getDisplayGameId());
            m.put("email", u.getEmail());
            m.put("role", u.getRole());
            m.put("status", u.getStatus());
            m.put("createdAt", u.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
        return Result.success(list);
    }

    @GetMapping("/users/{id}")
    public Result<Map<String, Object>> getUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId());
        m.put("username", user.getUsername());
        m.put("gameId", user.getGameId());
        m.put("displayGameId", user.getDisplayGameId());
        m.put("email", user.getEmail());
        m.put("role", user.getRole());
        m.put("status", user.getStatus());
        m.put("createdAt", user.getCreatedAt());
        return Result.success(m);
    }

    @PutMapping("/users/{id}")
    public Result<Map<String, Object>> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));

        if (body.containsKey("username")) {
            String newUsername = (String) body.get("username");
            if (!user.getUsername().equals(newUsername) && userRepository.existsByUsername(newUsername)) {
                throw new IllegalArgumentException("用户名已被使用");
            }
            user.setUsername(newUsername);
        }
        if (body.containsKey("email")) {
            user.setEmail((String) body.get("email"));
        }
        if (body.containsKey("gameId")) {
            user.setGameId((String) body.get("gameId"));
        }
        if (body.containsKey("role") && !"ADMIN".equals(user.getRole())) {
            user.setRole((String) body.get("role"));
        }
        if (body.containsKey("status")) {
            user.setStatus((Integer) body.get("status"));
        }

        // 重置密码：固定为 123456
        if (Boolean.TRUE.equals(body.get("resetPassword"))) {
            user.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));
        }

        userRepository.save(user);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getId());
        m.put("username", user.getUsername());
        m.put("email", user.getEmail());
        m.put("gameId", user.getGameId());
        m.put("displayGameId", user.getDisplayGameId());
        m.put("role", user.getRole());
        m.put("status", user.getStatus());
        m.put("passwordReset", Boolean.TRUE.equals(body.get("resetPassword")));
        return Result.success(m);
    }

    @DeleteMapping("/users/{id}")
    public Result<Void> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        user.setStatus(0);
        userRepository.save(user);
        return Result.success();
    }

    // ==================== 战队管理 ====================

    @GetMapping("/teams")
    public Result<List<Map<String, Object>>> listTeams() {
        List<Map<String, Object>> list = teamRepository.findAll().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("name", t.getName());
            m.put("description", t.getDescription());
            m.put("captainId", t.getCaptainId());
            m.put("status", t.getStatus());
            m.put("createdAt", t.getCreatedAt());
            long count = teamMemberRepository.countByTeamId(t.getId());
            m.put("memberCount", count);
            return m;
        }).collect(Collectors.toList());
        return Result.success(list);
    }

    @GetMapping("/teams/{id}")
    public Result<Map<String, Object>> getTeam(@PathVariable Long id) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", team.getId());
        m.put("name", team.getName());
        m.put("description", team.getDescription());
        m.put("captainId", team.getCaptainId());
        m.put("status", team.getStatus());
        m.put("createdAt", team.getCreatedAt());
        return Result.success(m);
    }


    @PostMapping("/teams")
    public Result<Map<String, Object>> createTeam(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return Result.error(400, "战队名不能为空");
        }
        if (teamRepository.existsByName(name.trim())) {
            return Result.error(400, "战队名已被使用");
        }

        Team team = Team.builder()
                .name(name.trim())
                .description((String) body.get("description"))
                .logo((String) body.get("logo"))
                .captainId(0L)
                .build();
        team = teamRepository.save(team);

        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", team.getId());
        m.put("name", team.getName());
        m.put("description", team.getDescription());
        m.put("captainId", team.getCaptainId());
        m.put("status", team.getStatus());
        return Result.success(m);
    }

    @PutMapping("/teams/{id}")
    public Result<Map<String, Object>> updateTeam(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (body.containsKey("name")) {
            String newName = (String) body.get("name");
            if (!team.getName().equals(newName) && teamRepository.existsByName(newName)) {
                throw new IllegalArgumentException("战队名已被使用");
            }
            team.setName(newName);
        }
        if (body.containsKey("description")) {
            team.setDescription((String) body.get("description"));
        }
        if (body.containsKey("status")) {
            team.setStatus((Integer) body.get("status"));
        }

        teamRepository.save(team);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", team.getId());
        m.put("name", team.getName());
        m.put("description", team.getDescription());
        m.put("status", team.getStatus());
        return Result.success(m);
    }

    @DeleteMapping("/teams/{id}")
    public Result<Void> deleteTeam(@PathVariable Long id) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        team.setStatus(0);
        teamRepository.save(team);
        return Result.success();
    }
}