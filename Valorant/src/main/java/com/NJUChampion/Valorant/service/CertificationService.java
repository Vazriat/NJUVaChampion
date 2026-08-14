package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.common.CertificationType;
import com.NJUChampion.Valorant.common.Rank;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.NJUChampion.Valorant.entity.Certification;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.CertificationRepository;
import com.NJUChampion.Valorant.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CertificationService {

    private final CertificationRepository certificationRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Transactional
    public Certification apply(Long userId, String type, String studentName, String studentId,
                                String description, String xuexinBase64, List<String> evidenceBase64s,
                                String rank) {
        CertificationType certType = CertificationType.fromCode(type);
        if (certType == null) {
            throw new IllegalArgumentException("无效的认证类型");
        }
        Optional<Certification> existing = certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, type, "PENDING");
        if (existing.isPresent()) {
            throw new IllegalArgumentException("\u5df2\u6709\u5f85\u5ba1\u6838\u7684" + type + "\u8ba4\u8bc1\u7533\u8bf7");
        }
        existing = certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, type, "APPROVED");
        if (existing.isPresent()) {
            throw new IllegalArgumentException("\u8be5" + type + "\u8ba4\u8bc1\u5df2\u901a\u8fc7");
        }

        // 同组互斥（如 identity 组的在校生/校友）
        for (CertificationType other : CertificationType.values()) {
            if (other == certType) {
                continue;
            }
            if (certType.getGroup().equals(other.getGroup())) {
                boolean conflict = certificationRepository
                        .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, other.getCode(), "PENDING").isPresent()
                        || certificationRepository
                        .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, other.getCode(), "APPROVED").isPresent();
                if (conflict) {
                    throw new IllegalArgumentException(certType.getLabel() + "与" + other.getLabel() + "认证互斥，只能认证一个");
                }
            }
        }

        Certification cert = Certification.builder()
                .userId(userId).type(type).status("PENDING")
                .studentName(studentName).studentId(studentId).description(description)
                .build();

        if (certType.isRank() && rank != null && !rank.isBlank()) {
            if (!Rank.isValid(rank.trim())) {
                throw new IllegalArgumentException("请选择合法的段位");
            }
            cert.setRank(rank.trim());
        }

        if (xuexinBase64 != null && !xuexinBase64.isBlank()) {
            cert.setXuexinPath(saveFile(xuexinBase64, userId, "xuexin"));
        }
        if (evidenceBase64s != null && !evidenceBase64s.isEmpty()) {
            List<String> paths = new ArrayList<>();
            for (int i = 0; i < evidenceBase64s.size(); i++) {
                paths.add(saveFile(evidenceBase64s.get(i), userId, "evidence_" + i));
            }
            cert.setEvidencePaths(toJson(paths));
        }
        return certificationRepository.save(cert);
    }

    private String toJson(List<String> paths) {
        try {
            return objectMapper.writeValueAsString(paths);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    public List<Certification> getMyCertifications(Long userId) {
        return certificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Certification> listByStatus(String status) {
        if (status != null && !status.isBlank()) {
            return certificationRepository.findByStatusOrderByCreatedAtDesc(status);
        }
        return certificationRepository.findAll();
    }

    public Certification getById(Long id) {
        return certificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("\u8ba4\u8bc1\u8bb0\u5f55\u4e0d\u5b58\u5728"));
    }

    @Transactional
    public void approve(Long id, Long adminId, String rank) {
        Certification cert = getById(id);
        CertificationType certType = CertificationType.fromCode(cert.getType());
        if (certType != null && certType.isRank()) {
            if (rank == null || !Rank.isValid(rank.trim())) {
                throw new IllegalArgumentException("请选择合法的段位");
            }
            rank = rank.trim();
        }
        cert.setStatus("APPROVED");
        cert.setReviewedBy(adminId);
        cert.setReviewedAt(LocalDateTime.now());
        if (rank != null && !rank.isBlank()) {
            cert.setRank(rank);
        }
        certificationRepository.save(cert);

        User user = userRepository.findById(cert.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("\u7528\u6237\u4e0d\u5b58\u5728"));
        if (certType != null && certType.isRank()) {
            user.setVerifiedRank(cert.getRank());
        } else {
            user.setVerifiedType(cert.getType());
        }
        userRepository.save(user);
    }

    @Transactional
    public void reject(Long id, Long adminId, String reason) {
        Certification cert = getById(id);
        cert.setStatus("REJECTED");
        cert.setReviewedBy(adminId);
        cert.setReviewedAt(LocalDateTime.now());
        cert.setRejectReason(reason);
        certificationRepository.save(cert);
    }

    @Transactional
    public void revoke(Long id, Long adminId) {
        Certification cert = getById(id);
        cert.setStatus("REVOKED");
        cert.setReviewedBy(adminId);
        cert.setReviewedAt(LocalDateTime.now());
        certificationRepository.save(cert);
        User user = userRepository.findById(cert.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("\u7528\u6237\u4e0d\u5b58\u5728"));
        user.setVerifiedType(null);
        user.setVerifiedRank(null);
        userRepository.save(user);
    }

    @Transactional
    public void deleteCertification(Long id) {
        Certification cert = getById(id);
        if (!"APPROVED".equals(cert.getStatus())) {
            throw new IllegalArgumentException("\u53ea\u80fd\u5220\u9664\u5df2\u901a\u8fc7\u7684\u8ba4\u8bc1");
        }
        cert.setStatus("DELETED");
        certificationRepository.save(cert);
        User user = userRepository.findById(cert.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("\u7528\u6237\u4e0d\u5b58\u5728"));
        if ("RANK".equals(cert.getType())) {
            user.setVerifiedRank(null);
        } else {
            user.setVerifiedType(null);
        }
        userRepository.save(user);
    }

    public Optional<Certification> getActiveCertification(Long userId) {
        return certificationRepository
                .findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, "APPROVED");
    }

    private String saveFile(String base64Data, Long userId, String prefix) {
        try {
            String data = base64Data;
            if (data.contains(",")) data = data.substring(data.indexOf(",") + 1);
            byte[] bytes = Base64.getDecoder().decode(data);
            Path dir = Paths.get(uploadDir, "certifications", String.valueOf(userId));
            Files.createDirectories(dir);
            Path filePath = dir.resolve(prefix + ".png");
            Files.deleteIfExists(filePath);
            Files.write(filePath, bytes);
            return "/uploads/certifications/" + userId + "/" + prefix + ".png";
        } catch (IOException e) {
            throw new RuntimeException("\u4fdd\u5b58\u6587\u4ef6\u5931\u8d25", e);
        }
    }
}