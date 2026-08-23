package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.FinalizeMatchRequest;
import com.NJUChampion.Valorant.dto.RecordGameRequest;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final TournamentMatchRepository matchRepository;
    private final GameRecordRepository gameRecordRepository;
    private final PlayerGameStatRepository playerGameStatRepository;
    private final TournamentRepository tournamentRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TournamentService tournamentService;

    @Value("${app.upload.dir:uploads/screenshots}")
    private String uploadDir;

    // ========== Step 1: Initialize BO games ==========

    @Transactional
    public List<Long> initGames(Long matchId, int boType) {
        TournamentMatch match = getMatch(matchId);
        if (!"PENDING".equals(match.getStatus())) {
            throw new IllegalArgumentException("Match is not pending, current status: " + match.getStatus());
        }
        if (match.getTeam1Id() == null || match.getTeam2Id() == null) {
            throw new IllegalArgumentException("Both teams must be assigned before initializing games");
        }

        // Clear any existing game records for this match
        List<GameRecord> existing = gameRecordRepository.findByMatchIdOrderByGameNumberAsc(matchId);
        for (GameRecord g : existing) {
            playerGameStatRepository.deleteByGameId(g.getId());
            gameRecordRepository.delete(g);
        }

        List<Long> gameIds = new ArrayList<>();
        for (int i = 1; i <= boType; i++) {
            GameRecord game = GameRecord.builder()
                    .matchId(matchId)
                    .gameNumber(i)
                    .status("PENDING")
                    .build();
            game = gameRecordRepository.save(game);
            gameIds.add(game.getId());
        }
        match.setGamesPerMatch(boType);
        matchRepository.save(match);
        return gameIds;
    }

    // ========== Step 2: Record a single game ==========

    @Transactional
    public void recordGame(Long matchId, Long gameId, RecordGameRequest req) {
        TournamentMatch match = getMatch(matchId);
        if (!"PENDING".equals(match.getStatus()) && !"COMPLETED".equals(match.getStatus())) {
            throw new IllegalArgumentException("Match is not editable");
        }

        GameRecord game = gameRecordRepository.findById(gameId)
                .orElseThrow(() -> new IllegalArgumentException("Game record not found"));
        if (!game.getMatchId().equals(matchId)) {
            throw new IllegalArgumentException("Game does not belong to this match");
        }

        // Save screenshot if provided
        String screenshotPath = null;
        if (req.getScreenshotBase64() != null && !req.getScreenshotBase64().isBlank()) {
            screenshotPath = saveScreenshot(req.getScreenshotBase64(), matchId, gameId);
        }

        // Update game record
        game.setTeam1Score(req.getTeam1Score());
        game.setTeam2Score(req.getTeam2Score());
        game.setScreenshotPath(screenshotPath);
        game.setStatus("RECORDED");
        gameRecordRepository.save(game);

        // Replace player stats for this game
        playerGameStatRepository.deleteByGameId(gameId);
        if (req.getPlayerStats() != null) {
            for (RecordGameRequest.PlayerStatEntry entry : req.getPlayerStats()) {
                Map<String, Object> stats = entry.getStats();
                if (stats == null) stats = new HashMap<>();
                PlayerGameStat stat = PlayerGameStat.builder()
                        .gameId(gameId)
                        .userId(entry.getUserId())
                        .playerName(entry.getPlayerName())
                        .teamId(entry.getTeamId())
                        .stats(stats)
                        .build();
                playerGameStatRepository.save(stat);
            }
        }
    }

    // ========== Step 3: Finalize match with total score ==========

    @Transactional
    public void finalizeMatch(Long matchId, FinalizeMatchRequest req) {
        TournamentMatch match = getMatch(matchId);
        Long tournamentId = match.getTournamentId();
        Tournament tournament = tournamentRepository.findById(tournamentId)
                .orElseThrow(() -> new IllegalArgumentException("Tournament not found"));
        // Allow re-finalize for COMPLETED matches (re-editing)
        if (!"PENDING".equals(match.getStatus()) && !"COMPLETED".equals(match.getStatus())) {
            throw new IllegalArgumentException("Match cannot be finalized, current status: " + match.getStatus());
        }

        // Verify enough games to determine winner (BO3 can end at 2-0, BO5 at 3-0/3-1)
        List<GameRecord> allGames = gameRecordRepository.findByMatchIdOrderByGameNumberAsc(matchId);
        List<GameRecord> recorded = allGames.stream().filter(g -> "RECORDED".equals(g.getStatus())).toList();
        long team1WinsInGames = recorded.stream().filter(g ->
            g.getTeam1Score() != null && g.getTeam2Score() != null && g.getTeam1Score() > g.getTeam2Score()
        ).count();
        long team2WinsInGames = recorded.stream().filter(g ->
            g.getTeam1Score() != null && g.getTeam2Score() != null && g.getTeam2Score() > g.getTeam1Score()
        ).count();
        int needed = match.getGamesPerMatch() / 2 + 1;
        if (team1WinsInGames < needed && team2WinsInGames < needed) {
            int totalRecorded = recorded.size();
            if (totalRecorded < match.getGamesPerMatch()) {
                throw new IllegalArgumentException("Not enough games to determine winner: need " + needed + " wins, have " + team1WinsInGames + "-" + team2WinsInGames);
            }
        }

        // Determine winner from total score
        Long winnerId;
        if (req.getTeam1Wins() > req.getTeam2Wins()) {
            winnerId = match.getTeam1Id();
        } else if (req.getTeam2Wins() > req.getTeam1Wins()) {
            winnerId = match.getTeam2Id();
        } else {
            throw new IllegalArgumentException("Total score cannot be a tie in elimination format");
        }

        match.setWinnerId(winnerId);
        match.setStatus("COMPLETED");
        matchRepository.save(match);

        // Trigger progression / Swiss round / league regular season completion
        if ("REGULAR".equals(match.getStage())) {
            tournamentService.completeRegularMatch(tournament, match);
        } else if ("SWISS".equals(match.getStage()) && "SWISS_ELIM".equals(tournament.getFormat())) {
            tournamentService.completeSwissMatch(tournament, match);
        } else {
            tournamentService.processCompletedMatch(tournament, match);
        }
    }

    // ========== Query: Match detail with games and player stats ==========

    public Map<String, Object> getMatchDetail(Long matchId) {
        TournamentMatch match = getMatch(matchId);

        List<GameRecord> games = gameRecordRepository.findByMatchIdOrderByGameNumberAsc(matchId);
        List<Map<String, Object>> gameVOs = new ArrayList<>();

        for (GameRecord game : games) {
            Map<String, Object> gameVO = new LinkedHashMap<>();
            gameVO.put("id", game.getId());
            gameVO.put("gameNumber", game.getGameNumber());
            gameVO.put("team1Score", game.getTeam1Score());
            gameVO.put("team2Score", game.getTeam2Score());
            gameVO.put("screenshotPath", game.getScreenshotPath());
            gameVO.put("status", game.getStatus());
            gameVO.put("createdAt", game.getCreatedAt());

            // Player stats for this game
            List<PlayerGameStat> stats = playerGameStatRepository.findByGameId(game.getId());
            List<Map<String, Object>> statVOs = new ArrayList<>();
            for (PlayerGameStat stat : stats) {
                Map<String, Object> statVO = new LinkedHashMap<>();
                statVO.put("id", stat.getId());
                statVO.put("userId", stat.getUserId());
                statVO.put("teamId", stat.getTeamId());
                // Look up user name (userId may be null for OCR-only players)
                String userName = null;
                if (stat.getUserId() != null) {
                    userName = userRepository.findById(stat.getUserId())
                            .map(User::getUsername).orElse(null);
                }
                statVO.put("userName", userName);
                statVO.put("playerName", stat.getPlayerName());
                statVO.put("stats", stat.getStats());
                statVOs.add(statVO);
            }
            gameVO.put("playerStats", statVOs);
            gameVOs.add(gameVO);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", match.getId());
        result.put("tournamentId", match.getTournamentId());
        result.put("stage", match.getStage());
        result.put("round", match.getRound());
        result.put("position", match.getPosition());
        result.put("team1Id", match.getTeam1Id());
        result.put("team1Name", teamRepository.findById(match.getTeam1Id()).map(Team::getName).orElse(null));
        result.put("team2Id", match.getTeam2Id());
        result.put("team2Name", teamRepository.findById(match.getTeam2Id()).map(Team::getName).orElse(null));
        result.put("winnerId", match.getWinnerId());
        result.put("status", match.getStatus());
        result.put("gamesPerMatch", match.getGamesPerMatch());
        result.put("games", gameVOs);

        return result;
    }

    // ========== Helpers ==========

    private String saveScreenshot(String base64Data, Long matchId, Long gameId) {
        try {
            // Strip data URI prefix if present
            String data = base64Data;
            if (data.contains(",")) {
                data = data.substring(data.indexOf(",") + 1);
            }
            byte[] imageBytes = Base64.getDecoder().decode(data);

            Path dir = Paths.get(uploadDir, String.valueOf(matchId));
            Files.createDirectories(dir);

            String fileName = "game_" + gameId + ".png";
            Path filePath = dir.resolve(fileName);

            // Delete old file if re-uploading
            Files.deleteIfExists(filePath);

            Files.write(filePath, imageBytes);

            return "/uploads/screenshots/" + matchId + "/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to save screenshot", e);
        }
    }


    private TournamentMatch getMatch(Long matchId) {
        return matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Match not found"));
    }
}
