package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.Tournament;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentRepository extends JpaRepository<Tournament, Long> {
    List<Tournament> findAllByOrderByCreatedAtDesc();
    List<Tournament> findByNameContainingIgnoreCaseOrderByCreatedAtDesc(String keyword);
}