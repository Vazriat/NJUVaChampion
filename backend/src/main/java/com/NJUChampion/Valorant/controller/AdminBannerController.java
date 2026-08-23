package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Banner;
import com.NJUChampion.Valorant.service.BannerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/banners")
@RequiredArgsConstructor
public class AdminBannerController {
    private final BannerService bannerService;
    @GetMapping
    public Result<List<Banner>> list() { return Result.success(bannerService.listAll()); }
    @GetMapping("/{id}")
    public Result<Banner> detail(@PathVariable Long id) { return Result.success(bannerService.getById(id)); }
    @PostMapping
    public Result<Banner> create(@RequestBody Banner banner) { return Result.success(bannerService.save(banner)); }
    @PutMapping("/{id}")
    public Result<Banner> update(@PathVariable Long id, @RequestBody Banner banner) { banner.setId(id); return Result.success(bannerService.save(banner)); }
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) { bannerService.delete(id); return Result.success(); }
}
