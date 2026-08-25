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
    private final MatchResultSubmissionRepository submissionRepository;
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

        // 最终比分仅按所选 BO 数校验，不依赖小局记录（与裁判申报/审核修正共用同一规则）
        validateFinalScore(match.getGamesPerMatch(), req.getTeam1Wins(), req.getTeam2Wins());

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
        match.setTeam1Score(req.getTeam1Wins());
        match.setTeam2Score(req.getTeam2Wins());
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

    // ========== 公共规则：BO 总比分校验（管理员录入 / 裁判申报 / 审核修正共用） ==========

    public static int neededWins(int boType) {
        return boType / 2 + 1;
    }

    public static void validateFinalScore(Integer boType, Integer team1Wins, Integer team2Wins) {
        if (boType == null || (boType != 1 && boType != 3 && boType != 5)) {
            throw new IllegalArgumentException("请选择合法的局制（BO1/BO3/BO5）");
        }
        if (team1Wins == null || team2Wins == null) {
            throw new IllegalArgumentException("请填写双方总比分");
        }
        int needed = neededWins(boType);
        if (team1Wins < 0 || team2Wins < 0) {
            throw new IllegalArgumentException("比分不能为负数");
        }
        if (Math.max(team1Wins, team2Wins) != needed || Math.min(team1Wins, team2Wins) >= needed) {
            throw new IllegalArgumentException("无效总比分：BO" + boType + " 需一方达到 " + needed + " 胜（例如 " + needed + "-0 或 " + needed + "-" + (needed - 1) + "）");
        }
    }

    // ========== 申报落库：按 payload 写入正式比赛数据 ==========

    /**
     * 将申报/修正后的赛果写入正式比赛数据（单事务）：
     * games 结构 = [{ gameNumber, team1Score, team2Score, screenshotPath, playerStats: [{userId,playerName,teamId,stats}] }]
     * 随后调用 finalizeMatch 完结比赛并推进赛程。
     */
    @Transactional
    public void applyResultPayload(Long matchId, Integer boType, int team1Wins, int team2Wins,
                                   List<Map<String, Object>> games) {
        TournamentMatch match = getMatch(matchId);

        // 首次落库：写入 BO 并创建空小局占位（已有小局则不重建，避免覆盖历史数据）
        if (match.getGamesPerMatch() == null) {
            match.setGamesPerMatch(boType);
            for (int i = 1; i <= boType; i++) {
                gameRecordRepository.save(GameRecord.builder()
                        .matchId(matchId).gameNumber(i).status("PENDING").build());
            }
            matchRepository.save(match);
        }

        // 按申报内容逐局写入（覆盖该局比分/截图/选手数据）
        if (games != null) {
            for (Map<String, Object> item : games) {
                int gameNumber = item.get("gameNumber") instanceof Number n ? n.intValue() : 1;
                Integer t1 = item.get("team1Score") instanceof Number n ? n.intValue() : null;
                Integer t2 = item.get("team2Score") instanceof Number n ? n.intValue() : null;
                if (t1 == null || t2 == null) {
                    continue; // 未填比分的局不落数据
                }
                GameRecord game = gameRecordRepository.findByMatchIdAndGameNumber(matchId, gameNumber)
                        .orElseGet(() -> gameRecordRepository.save(GameRecord.builder()
                                .matchId(matchId).gameNumber(gameNumber).status("PENDING").build()));
                game.setTeam1Score(t1);
                game.setTeam2Score(t2);
                game.setScreenshotPath(item.get("screenshotPath") != null ? item.get("screenshotPath").toString() : null);
                game.setStatus("RECORDED");
                gameRecordRepository.save(game);

                playerGameStatRepository.deleteByGameId(game.getId());
                Object statsObj = item.get("playerStats");
                if (statsObj instanceof List<?> list) {
                    for (Object o : list) {
                        if (!(o instanceof Map<?, ?> pm)) {
                            continue;
                        }
                        Long userId = pm.get("userId") instanceof Number n ? n.longValue() : null;
                        Long teamId = pm.get("teamId") instanceof Number n ? n.longValue() : null;
                        @SuppressWarnings("unchecked")
                        Map<String, Object> stats = pm.get("stats") instanceof Map<?, ?> sm
                                ? (Map<String, Object>) sm : new HashMap<>();
                        playerGameStatRepository.save(PlayerGameStat.builder()
                                .gameId(game.getId())
                                .userId(userId)
                                .playerName(pm.get("playerName") != null ? pm.get("playerName").toString() : null)
                                .teamId(teamId)
                                .stats(stats)
                                .build());
                    }
                }
            }
        }

        // 完结比赛（唯一赛程推进入口）
        FinalizeMatchRequest req = new FinalizeMatchRequest();
        req.setTeam1Wins(team1Wins);
        req.setTeam2Wins(team2Wins);
        finalizeMatch(matchId, req);
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
        result.put("team1Score", match.getTeam1Score());
        result.put("team2Score", match.getTeam2Score());
        result.put("status", match.getStatus());
        result.put("gamesPerMatch", match.getGamesPerMatch());
        result.put("games", gameVOs);

        // 关联的赛果申报信息（供管理员录入弹窗提示）
        MatchResultSubmission pendingSub = submissionRepository
                .findFirstByMatchIdAndStatus(matchId, "PENDING").orElse(null);
        if (pendingSub != null) {
            Map<String, Object> ps = new LinkedHashMap<>();
            ps.put("id", pendingSub.getId());
            ps.put("refereeId", pendingSub.getRefereeId());
            userRepository.findById(pendingSub.getRefereeId())
                    .ifPresent(u -> ps.put("refereeName", u.getUsername()));
            ps.put("createdAt", pendingSub.getCreatedAt());
            result.put("pendingSubmission", ps);
        } else {
            result.put("pendingSubmission", null);
        }
        MatchResultSubmission approvedSub = submissionRepository
                .findFirstByMatchIdAndStatus(matchId, "APPROVED").orElse(null);
        if (approvedSub != null) {
            Map<String, Object> as = new LinkedHashMap<>();
            as.put("id", approvedSub.getId());
            as.put("refereeId", approvedSub.getRefereeId());
            userRepository.findById(approvedSub.getRefereeId())
                    .ifPresent(u -> as.put("refereeName", u.getUsername()));
            result.put("approvedSubmission", as);
        } else {
            result.put("approvedSubmission", null);
        }

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
