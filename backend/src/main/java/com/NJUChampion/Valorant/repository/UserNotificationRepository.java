package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.UserNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    List<UserNotification> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndReadFlagFalse(Long userId);

    long countByUserId(Long userId);

    @Modifying
    @Query("update UserNotification n set n.readFlag = true where n.userId = :userId and n.readFlag = false")
    int markAllReadByUserId(@Param("userId") Long userId);
}
