package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.CertificationType;
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
@RequestMapping("/api/certification")
@RequiredArgsConstructor
public class CertificationController {

    private final CertificationService certificationService;

    @PostMapping("/apply")
    public Result<Certification> apply(@RequestBody Map<String, Object> body,
                                        @AuthenticationPrincipal User user) {
        String type = (String) body.get("type");
        String studentName = (String) body.get("studentName");
        String studentId = (String) body.get("studentId");
        String description = (String) body.get("description");
        String xuexinBase64 = (String) body.get("xuexinBase64");
        String rank = (String) body.get("rank");
        @SuppressWarnings("unchecked")
        List<String> evidenceBase64s = (List<String>) body.get("evidenceBase64s");

        CertificationType certType = CertificationType.fromCode(type);
        if (certType == null) {
            return Result.error(400, "无效的认证类型");
        }
        if (certType.isNeedsStudentInfo() && (studentName == null || studentId == null)) {
            return Result.error(400, "在校生认证需填写姓名和学号");
        }

        Certification cert = certificationService.apply(
                user.getId(), type, studentName, studentId, description, xuexinBase64, evidenceBase64s, rank);
        return Result.success(cert);
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        Certification cert = certificationService.getById(id);
        if (!cert.getUserId().equals(user.getId())) {
            return Result.error(403, "\u65e0\u6743\u5220\u9664");
        }
        certificationService.deleteCertification(id);
        return Result.success();
    }

    @GetMapping("/my")
    public Result<List<Certification>> getMy(@AuthenticationPrincipal User user) {
        return Result.success(certificationService.getMyCertifications(user.getId()));
    }
}
