package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.RefereeChannel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefereeChannelRepository extends JpaRepository<RefereeChannel, Long> {

    Optional<RefereeChannel> findByUserId(Long userId);

    List<RefereeChannel> findByStatus(String status);

    Page<RefereeChannel> findByStatusOrderByUpdatedAtDesc(String status, Pageable pageable);

    long countByStatus(String status);

    List<RefereeChannel> findByUserIdIn(List<Long> userIds);
}
