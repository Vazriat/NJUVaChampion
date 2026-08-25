package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<User> findByUsernameContainingIgnoreCase(String keyword);
    List<User> findByVerifiedRank(String verifiedRank);
    List<User> findByVerifiedRankIn(List<String> verifiedRanks);
}
