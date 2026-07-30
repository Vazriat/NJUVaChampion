package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findTop5ByStatusOrderByPublishedAtDesc(String status);
    List<Announcement> findByStatusOrderByPublishedAtDesc(String status);
}
