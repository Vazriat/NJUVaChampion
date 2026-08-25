package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.CreateResultSubmissionRequest;
import com.NJUChampion.Valorant.dto.ReviewResultSubmissionRequest;
import com.NJUChampion.Valorant.entity.MatchResultSubmission;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.Tournament;
import com.NJUChampion.Valorant.entity.TournamentMatch;
import com.NJUChampion.Valorant.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 赛果申报：裁判完整录入赛果草稿 → 管理员审核（可修正）→ 通过后落库到正式比赛数据。
 * 申报单与比赛正式数据分离，payload 为 JSON 快照，通过 payloadVersion 支持结构演进。
 */
@Service
@RequiredArgsConstructor
public class ResultSubmissionService {

    private final MatchResultSubmissionRepository submissionRepository;
    private final CertificationRepository certificationRepository;
    private final TournamentMatchRepository matchRepository;
    private final TournamentRepository tournamentRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final MatchService matchService;
    private final ObjectMapper objectMapper;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    // ===== 裁判资格（集中判定，未来指派制只改这里） =====

    public boolean isReferee(Long userId) {
        return certificationRepository
                .findFirstByUserIdAndTypeAndStatusOrderByCreatedAtDesc(userId, "REFEREE", "APPROVED")
                .isPresent();
    }

    // ===== 裁判端：申报 =====

    @Transactional
    public MatchResultSubmission create(Long refereeId, CreateResultSubmissionRequest req) {
        if (!isReferee(refereeId)) {
            throw new IllegalArgumentException("仅通过裁判认证的用户可以申报赛果");
        }
        TournamentMatch match = getMatch(req.getMatchId());
        Tournament tournament = getTournament(match.getTournamentId());
        if (!"PROGRESSION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在进行中，无法申报赛果");
        }
        if (!"PENDING".equals(match.getStatus()) && !"COMPLETED".equals(match.getStatus())) {
            throw new IllegalArgumentException("该比赛当前状态不可申报");
        }
        if (submissionRepository.findFirstByMatchIdAndStatus(match.getId(), "PENDING").isPresent()) {
            throw new IllegalArgumentException("该比赛已有待审核的申报");
        }
        MatchService.validateFinalScore(req.getBoType(), req.getTeam1Wins(), req.getTeam2Wins());

        MatchResultSubmission sub = MatchResultSubmission.builder()
                .matchId(match.getId())
                .tournamentId(tournament.getId())
                .refereeId(refereeId)
                .status("PENDING")
                .boType(req.getBoType())
                .team1Wins(req.getTeam1Wins())
                .team2Wins(req.getTeam2Wins())
                .note(req.getNote())
                .payload("{}")
                .payloadVersion(1)
                .build();
        sub = submissionRepository.save(sub);

        List<Map<String, Object>> gameVOs = saveGamesWithScreenshots(sub.getId(), req.getGames());
        sub.setPayload(toJson(buildPayload(req.getBoType(), req.getTeam1Wins(), req.getTeam2Wins(), req.getNote(), gameVOs)));
        return submissionRepository.save(sub);
    }

    @Transactional
    public MatchResultSubmission update(Long refereeId, Long id, CreateResultSubmissionRequest req) {
        MatchResultSubmission sub = getById(id);
        if (!sub.getRefereeId().equals(refereeId)) {
            throw new IllegalArgumentException("无权修改该申报");
        }
        if (!"PENDING".equals(sub.getStatus())) {
            throw new IllegalArgumentException("该申报已处理，无法修改");
        }
        MatchService.validateFinalScore(req.getBoType(), req.getTeam1Wins(), req.getTeam2Wins());

        List<Map<String, Object>> gameVOs = saveGamesWithScreenshots(sub.getId(), req.getGames());
        sub.setBoType(req.getBoType());
        sub.setTeam1Wins(req.getTeam1Wins());
        sub.setTeam2Wins(req.getTeam2Wins());
        sub.setNote(req.getNote());
        sub.setPayload(toJson(buildPayload(req.getBoType(), req.getTeam1Wins(), req.getTeam2Wins(), req.getNote(), gameVOs)));
        return submissionRepository.save(sub);
    }

    public List<Map<String, Object>> listMine(Long refereeId) {
        return submissionRepository.findByRefereeIdOrderByCreatedAtDesc(refereeId).stream()
                .map(s -> toVO(s, false))
                .collect(Collectors.toList());
    }

    public Map<String, Object> getMine(Long refereeId, Long id) {
        MatchResultSubmission sub = getById(id);
        if (!sub.getRefereeId().equals(refereeId)) {
            throw new IllegalArgumentException("无权查看该申报");
        }
        return toVO(sub, true);
    }

    @Transactional
    public void cancel(Long refereeId, Long id) {
        MatchResultSubmission sub = getById(id);
        if (!sub.getRefereeId().equals(refereeId)) {
            throw new IllegalArgumentException("无权撤销该申报");
        }
        if (!"PENDING".equals(sub.getStatus())) {
            throw new IllegalArgumentException("仅待审核的申报可以撤销");
        }
        sub.setStatus("CANCELLED");
        submissionRepository.save(sub);
    }

    // ===== 管理端：审核 =====

    public List<Map<String, Object>> listByStatus(String status, Long tournamentId) {
        List<MatchResultSubmission> list;
        if (tournamentId != null) {
            list = (status != null && !status.isBlank())
                    ? submissionRepository.findByStatusAndTournamentIdOrderByCreatedAtDesc(status, tournamentId)
                    : submissionRepository.findByTournamentIdOrderByCreatedAtDesc(tournamentId);
        } else {
            list = (status != null && !status.isBlank())
                    ? submissionRepository.findByStatusOrderByCreatedAtDesc(status)
                    : submissionRepository.findAllByOrderByCreatedAtDesc();
        }
        return list.stream().map(s -> toVO(s, false)).collect(Collectors.toList());
    }

    public Map<String, Object> getDetail(Long id) {
        return toVO(getById(id), true);
    }

    @Transactional
    public MatchResultSubmission approve(Long adminId, Long id, ReviewResultSubmissionRequest req) {
        MatchResultSubmission sub = getById(id);
        if (!"PENDING".equals(sub.getStatus())) {
            throw new IllegalArgumentException("该申报已处理");
        }
        // 最终内容：管理员修正优先，缺省用申报原稿
        Integer boType = req.getBoType() != null ? req.getBoType() : sub.getBoType();
        Integer w1 = req.getTeam1Wins() != null ? req.getTeam1Wins() : sub.getTeam1Wins();
        Integer w2 = req.getTeam2Wins() != null ? req.getTeam2Wins() : sub.getTeam2Wins();
        MatchService.validateFinalScore(boType, w1, w2);

        List<Map<String, Object>> games;
        if (req.getGames() != null) {
            // 管理员修正：新上传的 base64 截图落盘到本申报目录
            games = saveGamesWithScreenshots(sub.getId(), req.getGames());
        } else {
            games = parsePayloadGames(sub.getPayload());
        }

        // 落库到正式比赛数据（唯一赛程推进入口在 MatchService.finalizeMatch 内）
        matchService.applyResultPayload(sub.getMatchId(), boType, w1, w2, games);

        sub.setStatus("APPROVED");
        sub.setReviewedBy(adminId);
        sub.setReviewedAt(LocalDateTime.now());
        sub.setReviewNote(req.getReviewNote());
        if (req.getGames() != null || req.getBoType() != null) {
            String note = req.getNote() != null ? req.getNote() : sub.getNote();
            sub.setBoType(boType);
            sub.setTeam1Wins(w1);
            sub.setTeam2Wins(w2);
            sub.setNote(note);
            sub.setPayload(toJson(buildPayload(boType, w1, w2, note, games)));
        }
        return submissionRepository.save(sub);
    }

    @Transactional
    public MatchResultSubmission reject(Long adminId, Long id, String reviewNote) {
        MatchResultSubmission sub = getById(id);
        if (!"PENDING".equals(sub.getStatus())) {
            throw new IllegalArgumentException("该申报已处理");
        }
        sub.setStatus("REJECTED");
        sub.setReviewedBy(adminId);
        sub.setReviewedAt(LocalDateTime.now());
        sub.setRejectReason(reviewNote);
        return submissionRepository.save(sub);
    }

    // ===== 内部工具 =====

    private Map<String, Object> toVO(MatchResultSubmission s, boolean includePayload) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("matchId", s.getMatchId());
        m.put("tournamentId", s.getTournamentId());
        m.put("refereeId", s.getRefereeId());
        userRepository.findById(s.getRefereeId()).ifPresent(u -> m.put("refereeName", u.getUsername()));
        m.put("boType", s.getBoType());
        m.put("team1Wins", s.getTeam1Wins());
        m.put("team2Wins", s.getTeam2Wins());
        m.put("status", s.getStatus());
        m.put("note", s.getNote());
        m.put("rejectReason", s.getRejectReason());
        m.put("reviewNote", s.getReviewNote());
        m.put("createdAt", s.getCreatedAt());
        m.put("reviewedAt", s.getReviewedAt());

        TournamentMatch match = matchRepository.findById(s.getMatchId()).orElse(null);
        if (match != null) {
            m.put("matchStatus", match.getStatus());
            m.put("team1Id", match.getTeam1Id());
            m.put("team2Id", match.getTeam2Id());
            m.put("team1Name", match.getTeam1Id() != null
                    ? teamRepository.findById(match.getTeam1Id()).map(Team::getName).orElse(null) : null);
            m.put("team2Name", match.getTeam2Id() != null
                    ? teamRepository.findById(match.getTeam2Id()).map(Team::getName).orElse(null) : null);
        }

        List<Map<String, Object>> games = parsePayloadGames(s.getPayload());
        m.put("gameCount", games.size());
        m.put("screenshotPaths", games.stream()
                .map(g -> g.get("screenshotPath"))
                .filter(Objects::nonNull)
                .collect(Collectors.toList()));
        if (includePayload) {
            m.put("payload", parsePayload(s.getPayload()));
        }
        return m;
    }

    private Map<String, Object> buildPayload(Integer boType, Integer team1Wins, Integer team2Wins, String note, List<Map<String, Object>> games) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("boType", boType);
        payload.put("team1Wins", team1Wins);
        payload.put("team2Wins", team2Wins);
        payload.put("note", note);
        payload.put("games", games);
        return payload;
    }

    /** 保存 base64 截图并生成 games 的 payload 形态（含 screenshotPath） */
    private List<Map<String, Object>> saveGamesWithScreenshots(Long submissionId, List<CreateResultSubmissionRequest.GameItem> games) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (games == null) {
            return out;
        }
        for (CreateResultSubmissionRequest.GameItem g : games) {
            Map<String, Object> game = new LinkedHashMap<>();
            game.put("gameNumber", g.getGameNumber());
            game.put("team1Score", g.getTeam1Score());
            game.put("team2Score", g.getTeam2Score());
            if (g.getScreenshotBase64() != null && !g.getScreenshotBase64().isBlank()) {
                game.put("screenshotPath", saveScreenshot(submissionId, g.getGameNumber(), g.getScreenshotBase64()));
            } else {
                game.put("screenshotPath", g.getScreenshotPath());
            }
            List<Map<String, Object>> stats = new ArrayList<>();
            if (g.getPlayerStats() != null) {
                for (CreateResultSubmissionRequest.GameItem.PlayerItem p : g.getPlayerStats()) {
                    Map<String, Object> pm = new LinkedHashMap<>();
                    pm.put("userId", p.getUserId());
                    pm.put("playerName", p.getPlayerName());
                    pm.put("teamId", p.getTeamId());
                    pm.put("stats", p.getStats());
                    stats.add(pm);
                }
            }
            game.put("playerStats", stats);
            out.add(game);
        }
        return out;
    }

    private String saveScreenshot(Long submissionId, Integer gameNumber, String base64Data) {
        try {
            String data = base64Data;
            if (data.contains(",")) {
                data = data.substring(data.indexOf(",") + 1);
            }
            byte[] bytes = Base64.getDecoder().decode(data);
            Path dir = Paths.get(uploadDir, "submissions", String.valueOf(submissionId));
            Files.createDirectories(dir);
            Path filePath = dir.resolve("game_" + gameNumber + ".png");
            Files.deleteIfExists(filePath);
            Files.write(filePath, bytes);
            return "/uploads/submissions/" + submissionId + "/game_" + gameNumber + ".png";
        } catch (IOException e) {
            throw new RuntimeException("保存截图失败", e);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("序列化申报内容失败", e);
        }
    }

    private Map<String, Object> parsePayload(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parsePayloadGames(String json) {
        Object games = parsePayload(json).get("games");
        return games instanceof List ? (List<Map<String, Object>>) games : new ArrayList<>();
    }

    private MatchResultSubmission getById(Long id) {
        return submissionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("申报不存在"));
    }

    private TournamentMatch getMatch(Long matchId) {
        return matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("比赛不存在"));
    }

    private Tournament getTournament(Long tournamentId) {
        return tournamentRepository.findById(tournamentId)
                .orElseThrow(() -> new IllegalArgumentException("赛事不存在"));
    }
}
