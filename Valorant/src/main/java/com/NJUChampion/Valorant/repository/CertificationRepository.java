package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.Certification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CertificationRepository extends JpaRepository<Certification, Long> {
    List<Certification> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<Certification> findFirstByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
    Optional<Certification> findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(Long userId, String type, String status);
    List<Certification> findByStatusOrderByCreatedAtDesc(String status);
}
