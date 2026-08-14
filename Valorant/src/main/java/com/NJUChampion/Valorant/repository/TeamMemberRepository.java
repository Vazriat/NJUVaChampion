package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    List<TeamMember> findByTeamId(Long teamId);
    Optional<TeamMember> findByTeamIdAndUserId(Long teamId, Long userId);
    boolean existsByTeamIdAndUserId(Long teamId, Long userId);
    List<TeamMember> findByUserId(Long userId);
    long countByTeamId(Long teamId);
    void deleteByTeamIdAndUserId(Long teamId, Long userId);
    void deleteByTeamId(Long teamId);
}