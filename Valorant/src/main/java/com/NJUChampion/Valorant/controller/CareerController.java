package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.service.CareerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
}
