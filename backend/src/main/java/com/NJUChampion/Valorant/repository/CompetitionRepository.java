package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.Competition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompetitionRepository extends JpaRepository<Competition, Long> {
    List<Competition> findAllByOrderByCreatedAtDesc();
}
