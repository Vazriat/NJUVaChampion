package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Announcement;
import com.NJUChampion.Valorant.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {
    private final AnnouncementService announcementService;
    @GetMapping("/latest")
    public Result<List<Announcement>> getLatest() { return Result.success(announcementService.getLatest()); }
    @GetMapping
    public Result<List<Announcement>> listPublished() { return Result.success(announcementService.listPublished()); }
    @GetMapping("/{id}")
    public Result<Announcement> detail(@PathVariable Long id) { return Result.success(announcementService.getById(id)); }
}
