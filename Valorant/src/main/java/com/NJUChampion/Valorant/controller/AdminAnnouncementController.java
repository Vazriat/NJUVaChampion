package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Announcement;
import com.NJUChampion.Valorant.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/announcements")
@RequiredArgsConstructor
public class AdminAnnouncementController {
    private final AnnouncementService announcementService;
    @GetMapping
    public Result<List<Announcement>> list() { return Result.success(announcementService.listAll()); }
    @GetMapping("/{id}")
    public Result<Announcement> detail(@PathVariable Long id) { return Result.success(announcementService.getById(id)); }
    @PostMapping
    public Result<Announcement> create(@RequestBody Announcement a) { return Result.success(announcementService.save(a)); }
    @PutMapping("/{id}")
    public Result<Announcement> update(@PathVariable Long id, @RequestBody Announcement a) { a.setId(id); return Result.success(announcementService.save(a)); }
    @PostMapping("/{id}/publish")
    public Result<Announcement> publish(@PathVariable Long id) { return Result.success(announcementService.publish(id)); }
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) { announcementService.delete(id); return Result.success(); }
}
