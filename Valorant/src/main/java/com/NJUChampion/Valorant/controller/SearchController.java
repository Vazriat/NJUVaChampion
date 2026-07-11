package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.Tournament;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.TeamRepository;
import com.NJUChampion.Valorant.repository.TournamentRepository;
import com.NJUChampion.Valorant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TournamentRepository tournamentRepository;

    @GetMapping
    public Result<Map<String, Object>> search(@RequestParam("q") String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return Result.success(Map.of("users", List.of(), "teams", List.of(), "tournaments", List.of()));
        }
        String q = keyword.trim();

        List<Map<String, Object>> users = userRepository.findByUsernameContainingIgnoreCase(q).stream()
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", u.getId());
                    m.put("username", u.getUsername());
                    m.put("gameId", u.getGameId());
                    m.put("role", u.getRole());
                    m.put("status", u.getStatus());
                    return m;
                })
                .toList();

        List<Map<String, Object>> teams = teamRepository.findByNameContainingIgnoreCase(q).stream()
                .map(t -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", t.getId());
                    m.put("name", t.getName());
                    m.put("description", t.getDescription());
                    m.put("status", t.getStatus());
                    m.put("captainId", t.getCaptainId());
                    return m;
                })
                .toList();

        List<Map<String, Object>> tournaments = tournamentRepository.findByNameContainingIgnoreCaseOrderByCreatedAtDesc(q).stream()
                .map(t -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", t.getId());
                    m.put("name", t.getName());
                    m.put("status", t.getStatus());
                    m.put("type", t.getType());
                    m.put("format", t.getFormat());
                    m.put("maxTeams", t.getMaxTeams());
                    return m;
                })
                .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("users", users);
        result.put("teams", teams);
        result.put("tournaments", tournaments);
        return Result.success(result);
    }
}