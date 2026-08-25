package com.NJUChampion.Valorant.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "certifications")
public class Certification {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "student_name", length = 50)
    private String studentName;

    @Column(name = "student_id", length = 50)
    private String studentId;

    @Column(name = "enrollment_year")
    private Integer enrollmentYear;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "xuexin_path", length = 500)
    private String xuexinPath;

    @Column(name = "evidence_paths", columnDefinition = "TEXT")
    private String evidencePaths;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "rank_value", length = 50)
    private String rankValue;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @JsonProperty("rank")
    public String getRank() { return rankValue; }

    @JsonProperty("rank")
    public void setRank(String rank) { this.rankValue = rank; }

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}