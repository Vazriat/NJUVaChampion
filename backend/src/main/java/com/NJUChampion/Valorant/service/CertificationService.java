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
import java.time.Year;
import java.util.*;
import java.util.stream.Collectors;

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
                                String rank, Integer enrollmentYear) {
        CertificationType certType = CertificationType.fromCode(type);
        if (certType == null) {
            throw new IllegalArgumentException("无效的认证类型");
        }
        if (certType.isNeedsEnrollmentYear()
                && (enrollmentYear == null || enrollmentYear < 1900 || enrollmentYear > Year.now().getValue() + 1)) {
            throw new IllegalArgumentException("请填写合法的入学年份");
        }
        Optional<Certification> existing = certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, type, "PENDING");
        if (existing.isPresent()) {
            throw new IllegalArgumentException("\u5df2\u6709\u5f85\u5ba1\u6838\u7684" + type + "\u8ba4\u8bc1\u7533\u8bf7");
        }
        existing = certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, type, "APPROVED");
        if (existing.isPresent() && !"RANK".equals(type)) {
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
                .studentName(studentName).studentId(studentId).enrollmentYear(enrollmentYear)
                .description(description)
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
    /** 是否已通过身份认证（在校生/校友任一 APPROVED 即可） */
    public boolean isIdentityVerified(Long userId) {
        return certificationRepository
                .existsByUserIdAndTypeInAndStatus(userId, List.of("STUDENT", "ALUMNI"), "APPROVED");
    }

    public List<Map<String, Object>> listByStatus(String status) {
        List<Certification> certs = (status != null && !status.isBlank())
                ? certificationRepository.findByStatusOrderByCreatedAtDesc(status)
                : certificationRepository.findAll();
        // 批量取回涉及的用户，避免逐条 findById（N+1）；前端按类型/状态本地筛选，需要一次拿全量
        Set<Long> userIds = certs.stream()
                .map(Certification::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));
        return certs.stream()
                .map(cert -> toMap(cert, userMap.get(cert.getUserId())))
                .collect(Collectors.toList());
    }

    private Map<String, Object> toMap(Certification cert, User user) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", cert.getId());
        m.put("userId", cert.getUserId());
        m.put("type", cert.getType());
        m.put("status", cert.getStatus());
        m.put("studentName", cert.getStudentName());
        m.put("studentId", cert.getStudentId());
        m.put("enrollmentYear", cert.getEnrollmentYear());
        m.put("description", cert.getDescription());
        m.put("xuexinPath", cert.getXuexinPath());
        m.put("evidencePaths", cert.getEvidencePaths());
        m.put("rank", cert.getRank());
        m.put("rejectReason", cert.getRejectReason());
        m.put("reviewedAt", cert.getReviewedAt());
        m.put("createdAt", cert.getCreatedAt());

        m.put("username", user != null ? user.getUsername() : null);
        m.put("gameId", user != null ? user.getGameId() : null);
        m.put("displayGameId", user != null ? user.getDisplayGameId() : null);
        return m;
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
            certificationRepository
                    .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(cert.getUserId(), "RANK", "APPROVED")
                    .filter(old -> !old.getId().equals(cert.getId()))
                    .ifPresent(old -> {
                        old.setStatus("SUPERSEDED");
                        certificationRepository.save(old);
                    });
            user.setVerifiedRank(cert.getRank());
        } else if (certType != null && "identity".equals(certType.getGroup())) {
            // 仅身份认证（在校生/校友）写入 verifiedType；REFEREE 等不覆盖身份标记
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
        CertificationType certType = CertificationType.fromCode(cert.getType());
        if (certType != null && certType.isRank()) {
            user.setVerifiedRank(null);
        } else if (certType != null && "identity".equals(certType.getGroup())) {
            user.setVerifiedType(null);
        }
        // REFEREE 等非身份认证撤销时不影响身份标记
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
        CertificationType certType = CertificationType.fromCode(cert.getType());
        if (certType != null && certType.isRank()) {
            user.setVerifiedRank(null);
        } else if (certType != null && "identity".equals(certType.getGroup())) {
            user.setVerifiedType(null);
        }
        // REFEREE 等非身份认证删除时不影响身份标记
        userRepository.save(user);
    }

    /** 是否通过裁判认证（REFEREE 认证 APPROVED） */
    public boolean isReferee(Long userId) {
        return certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, "REFEREE", "APPROVED")
                .isPresent();
    }

    public Optional<Certification> getActiveCertification(Long userId) {
        return certificationRepository
                .findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, "APPROVED");
    }

    /**
     * 保存 base64 图片。
     *
     * 早前这里固定写 .png，导致上传 JPEG 时文件后缀与真实格式不符：
     * /uploads 由 Spring 静态资源按后缀推断 Content-Type，返回 image/png 给一段 JPEG 数据，
     * 部分浏览器（尤其 Safari）会直接不渲染。这里改为按真实类型落盘。
     */
    private String saveFile(String base64Data, Long userId, String prefix) {
        String mime = null;
        String data = base64Data.trim();
        if (data.startsWith("data:")) {
            int comma = data.indexOf(',');
            if (comma > 0) {
                String header = data.substring(5, comma);
                int semi = header.indexOf(';');
                mime = semi > 0 ? header.substring(0, semi) : header;
                data = data.substring(comma + 1);
            }
        }

        byte[] bytes;
        try {
            // MIME 解码器容忍换行等非 base64 字符；严格解码器遇到换行会抛异常
            bytes = Base64.getMimeDecoder().decode(data.replaceAll("\\s", ""));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("图片编码无法识别，请重新选择文件后重试");
        }
        if (bytes.length == 0) {
            throw new IllegalArgumentException("图片内容为空，请重新选择文件");
        }

        String ext = detectExtension(mime, bytes);
        try {
            Path dir = Paths.get(uploadDir, "certifications", String.valueOf(userId));
            Files.createDirectories(dir);
            Path filePath = dir.resolve(prefix + ext);
            Files.deleteIfExists(filePath);
            Files.write(filePath, bytes);
            return "/uploads/certifications/" + userId + "/" + prefix + ext;
        } catch (IOException e) {
            throw new RuntimeException("\u4fdd\u5b58\u6587\u4ef6\u5931\u8d25", e);
        }
    }

    /** 优先用 data URL 里的 MIME，缺失或不认识时按文件头魔数兜底 */
    private String detectExtension(String mime, byte[] b) {
        if (mime != null) {
            String m = mime.toLowerCase(Locale.ROOT);
            if (m.contains("jpeg") || m.contains("jpg")) return ".jpg";
            if (m.contains("png")) return ".png";
            if (m.contains("webp")) return ".webp";
            if (m.contains("gif")) return ".gif";
            if (m.contains("heic") || m.contains("heif")) return ".heic";
            if (m.contains("pdf")) return ".pdf";
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8) return ".jpg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return ".png";
        if (b.length >= 4 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F') return ".gif";
        if (b.length >= 12 && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return ".webp";
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') return ".pdf";
        return ".png";
    }
}