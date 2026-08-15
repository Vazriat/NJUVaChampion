package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.CareerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/career")
@RequiredArgsConstructor
public class CareerController {

    private final CareerService careerService;

    @GetMapping("/{userId}")
    public Result<Map<String, Object>> getCareer(@PathVariable Long userId) {
        return Result.success(careerService.getCareer(userId));
    }

    @GetMapping("/{userId}/matches")
    public Result<List<Map<String, Object>>> getMatchHistory(@PathVariable Long userId) {
        return Result.success(careerService.getMatchHistory(userId));
    }

    @GetMapping("/{userId}/analysis")
    public Result<Map<String, Object>> getCareerAnalysis(@PathVariable Long userId,
                                                         @RequestParam String ranks,
                                                         @RequestParam(required = false) String tournaments) {
        List<String> majorList = Arrays.stream(ranks.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());

        Set<Long> tournamentIds = null;
        if (tournaments != null && !tournaments.isBlank()) {
            tournamentIds = Arrays.stream(tournaments.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(Long::parseLong)
                    .collect(Collectors.toSet());
        }

        return Result.success(careerService.getCareerAnalysis(userId, majorList, tournamentIds));
    }
}
