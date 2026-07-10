package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeamRepository extends JpaRepository<Team, Long> {
    Optional<Team> findByCaptainId(Long captainId);
    boolean existsByName(String name);
}