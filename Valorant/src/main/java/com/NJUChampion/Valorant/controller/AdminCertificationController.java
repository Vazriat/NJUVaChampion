package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.Certification;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.CertificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/certifications")
@RequiredArgsConstructor
public class AdminCertificationController {

    private final CertificationService certificationService;

    @GetMapping
    public Result<List<Certification>> list(@RequestParam(required = false) String status) {
        return Result.success(certificationService.listByStatus(status));
    }

    @GetMapping("/{id}")
    public Result<Certification> detail(@PathVariable Long id) {
        return Result.success(certificationService.getById(id));
    }

    @PostMapping("/{id}/approve")
    public Result<Void> approve(@PathVariable Long id, @RequestBody(required = false) java.util.Map<String, String> body,
                                @AuthenticationPrincipal User admin) {
        String rank = body != null ? body.get("rank") : null;
        certificationService.approve(id, admin.getId(), rank);
        return Result.success();
    }

    @PostMapping("/{id}/revoke")
    public Result<Void> revoke(@PathVariable Long id, @AuthenticationPrincipal User admin) {
        certificationService.revoke(id, admin.getId());
        return Result.success();
    }

    @PostMapping("/{id}/reject")
    public Result<Void> reject(@PathVariable Long id, @RequestBody Map<String, String> body,
                                @AuthenticationPrincipal User admin) {
        String reason = body.get("reason");
        certificationService.reject(id, admin.getId(), reason != null ? reason : "未说明原因");
        return Result.success();
    }
}
