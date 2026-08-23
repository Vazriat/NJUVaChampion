package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.entity.TournamentMatch;
import com.NJUChampion.Valorant.repository.*;
import com.NJUChampion.Valorant.repository.TournamentMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScreenshotService {

    private final GameRecordRepository gameRecordRepository;
    private final TournamentMatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final TournamentRepository tournamentRepository;

    @Value("${app.upload.dir:uploads/screenshots}")
    private String uploadDir;

    public List<Map<String, Object>> listAll() {
        List<GameRecord> allGamesWithScreenshots = gameRecordRepository.findAll().stream()
                .filter(g -> g.getScreenshotPath() != null && !g.getScreenshotPath().isBlank())
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();

        return buildScreenshotList(allGamesWithScreenshots);
    }

    public List<Map<String, Object>> listByMatchIds(List<Long> matchIds) {
        List<GameRecord> games = gameRecordRepository.findAll().stream()
                .filter(g -> matchIds.contains(g.getMatchId()))
                .filter(g -> g.getScreenshotPath() != null && !g.getScreenshotPath().isBlank())
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();

        return buildScreenshotList(games);
    }

    public List<Map<String, Object>> listByTournamentId(Long tournamentId) {
        // Find all match IDs for this tournament
        List<TournamentMatch> matches = matchRepository.findByTournamentId(tournamentId);
        Set<Long> matchIds = matches.stream().map(TournamentMatch::getId).collect(Collectors.toSet());

        List<GameRecord> games = gameRecordRepository.findAll().stream()
                .filter(g -> matchIds.contains(g.getMatchId()))
                .filter(g -> g.getScreenshotPath() != null && !g.getScreenshotPath().isBlank())
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();

        return buildScreenshotList(games);
    }

    private List<Map<String, Object>> buildScreenshotList(List<GameRecord> records) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (GameRecord game : records) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("gameId", game.getId());
            entry.put("matchId", game.getMatchId());
            entry.put("gameNumber", game.getGameNumber());
            entry.put("screenshotPath", game.getScreenshotPath());
            entry.put("team1Score", game.getTeam1Score());
            entry.put("team2Score", game.getTeam2Score());
            entry.put("createdAt", game.getCreatedAt());

            Path filePath = Paths.get(uploadDir, String.valueOf(game.getMatchId()), "game_" + game.getId() + ".png");
            try {
                entry.put("fileSize", Files.size(filePath));
            } catch (IOException e) {
                entry.put("fileSize", -1);
            }

            TournamentMatch match = matchRepository.findById(game.getMatchId()).orElse(null);
            if (match != null) {
                entry.put("tournamentId", match.getTournamentId());
                entry.put("stage", match.getStage());
                entry.put("round", match.getRound());
                Team team1 = teamRepository.findById(match.getTeam1Id()).orElse(null);
                Team team2 = teamRepository.findById(match.getTeam2Id()).orElse(null);
                entry.put("team1Name", team1 != null ? team1.getName() : null);
                entry.put("team2Name", team2 != null ? team2.getName() : null);
                Tournament tournament = tournamentRepository.findById(match.getTournamentId()).orElse(null);
                entry.put("tournamentName", tournament != null ? tournament.getName() : null);
            }

            result.add(entry);
        }
        return result;
    }

    public List<Map<String, Object>> searchByTournamentName(String name) {
        List<Tournament> tournaments = tournamentRepository.findByNameContainingIgnoreCaseOrderByCreatedAtDesc(name);
        if (tournaments.isEmpty()) return new ArrayList<>();
        Set<Long> tournamentIds = tournaments.stream().map(Tournament::getId).collect(Collectors.toSet());

        // Find all matches for these tournaments
        List<Map<String, Object>> allResults = new ArrayList<>();
        for (Long tid : tournamentIds) {
            allResults.addAll(listByTournamentId(tid));
        }
        allResults.sort((a, b) -> {
            Comparable ca = (Comparable) a.getOrDefault("createdAt", "");
            Comparable cb = (Comparable) b.getOrDefault("createdAt", "");
            return cb.compareTo(ca);
        });
        return allResults;
    }

    @Transactional
    public void batchDelete(List<Long> gameIds) {
        for (Long gameId : gameIds) {
            delete(gameId);
        }
    }

    public Map<String, Object> getStats() {
        long totalFiles = 0;
        long totalBytes = 0;
        Path dir = Paths.get(uploadDir);
        if (Files.exists(dir)) {
            try {
                totalBytes = Files.walk(dir)
                        .filter(Files::isRegularFile)
                        .mapToLong(f -> {
                            try { return Files.size(f); } catch (IOException e) { return 0; }
                        })
                        .sum();
                totalFiles = Files.walk(dir)
                        .filter(Files::isRegularFile)
                        .count();
            } catch (IOException ignored) {}
        }
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalFiles", totalFiles);
        stats.put("totalBytes", totalBytes);
        stats.put("totalMB", Math.round(totalBytes / 1048576.0 * 100) / 100.0);
        return stats;
    }

    @Transactional
    public void delete(Long gameId) {
        GameRecord game = gameRecordRepository.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found"));

        // Delete file
        Path filePath = Paths.get(uploadDir, String.valueOf(game.getMatchId()), "game_" + game.getId() + ".png");
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            throw new RuntimeException("Failed to delete screenshot file", e);
        }

        // Clear path in DB
        game.setScreenshotPath(null);
        gameRecordRepository.save(game);
    }
}
