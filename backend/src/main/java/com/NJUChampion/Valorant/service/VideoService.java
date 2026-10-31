package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.MatchVideo;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.Tournament;
import com.NJUChampion.Valorant.entity.TournamentMatch;
import com.NJUChampion.Valorant.repository.MatchVideoRepository;
import com.NJUChampion.Valorant.repository.TeamMemberRepository;
import com.NJUChampion.Valorant.repository.TeamRepository;
import com.NJUChampion.Valorant.repository.TournamentMatchRepository;
import com.NJUChampion.Valorant.repository.TournamentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 赛事视频：回放 / 精彩集锦。
 *
 * 只存链接，视频本体在 B 站等平台。封面与时长在提交时抓一次，抓不到就留空。
 *
 * 上传权限：管理员、认证裁判、以及该场比赛的参赛队成员（选手）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VideoService {

    private final MatchVideoRepository videoRepository;
    private final TournamentMatchRepository matchRepository;
    private final TournamentRepository tournamentRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final CertificationService certificationService;
    private final VideoMetaResolver metaResolver;

    private static final Set<String> CATEGORIES = Set.of("REPLAY", "HIGHLIGHT", "OTHER");
    private static final String ACTIVE = "ACTIVE";

    // ==================== 查询 ====================

    public List<Map<String, Object>> listByMatch(Long matchId) {
        return videoRepository.findByMatchIdAndStatusOrderByCreatedAtDesc(matchId, ACTIVE).stream()
                .map(v -> videoVO(v, null, null))
                .collect(Collectors.toList());
    }

    /**
     * 全站最新视频，供直播页的「赛事视频」分区用。
     * 带上赛事名与场次名，前端按赛事分组展示。
     */
    public List<Map<String, Object>> recent(int limit) {
        int n = Math.min(Math.max(limit, 1), 60);
        List<MatchVideo> videos = videoRepository
                .findByStatusOrderByCreatedAtDesc(ACTIVE, PageRequest.of(0, n))
                .getContent();
        if (videos.isEmpty()) {
            return List.of();
        }
        Map<Long, String> matchNames = loadMatchNames(videos);
        Map<Long, String> tournamentNames = loadTournamentNames(videos);
        return videos.stream()
                .map(v -> videoVO(v, matchNames.get(v.getMatchId()),
                        tournamentNames.get(v.getTournamentId())))
                .collect(Collectors.toList());
    }

    /** 赛事视频聚合页：按分类筛选、分页 */
    public Map<String, Object> listByTournament(Long tournamentId, String category, int page, int size) {
        int p = Math.max(page, 1);
        int s = Math.min(Math.max(size, 1), 60);
        var pageable = PageRequest.of(p - 1, s);

        Page<MatchVideo> pageData = (category != null && !category.isBlank())
                ? videoRepository.findByTournamentIdAndStatusAndCategoryOrderByCreatedAtDesc(
                        tournamentId, ACTIVE, category, pageable)
                : videoRepository.findByTournamentIdAndStatusOrderByCreatedAtDesc(
                        tournamentId, ACTIVE, pageable);

        Map<Long, String> matchNames = loadMatchNames(pageData.getContent());
        String tournamentName = tournamentNameOf(tournamentId);
        List<Map<String, Object>> list = pageData.getContent().stream()
                .map(v -> videoVO(v, matchNames.get(v.getMatchId()), tournamentName))
                .collect(Collectors.toList());

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("total", pageData.getTotalElements());
        vo.put("list", list);
        return vo;
    }

    /** 该赛事下已完结、可用于标注视频的比赛（上传时选） */
    public List<Map<String, Object>> selectableMatches(Long tournamentId) {
        return matchRepository.findByTournamentIdOrderByRoundAscPositionAsc(tournamentId).stream()
                .filter(m -> "COMPLETED".equals(m.getStatus()))
                .map(m -> {
                    String t1 = teamName(m.getTeam1Id());
                    String t2 = teamName(m.getTeam2Id());
                    Map<String, Object> vo = new LinkedHashMap<>();
                    vo.put("matchId", m.getId());
                    vo.put("name", t1 + " vs " + t2);
                    vo.put("round", m.getRound());
                    return vo;
                })
                .collect(Collectors.toList());
    }

    // ==================== 写入 ====================

    @Transactional
    public Map<String, Object> create(Long userId, boolean admin, Long matchId,
                                      String url, String title, String category) {
        TournamentMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("比赛不存在"));

        String role = requireUploadPermission(userId, admin, match);
        String cleanUrl = normalizeHttpsUrl(url);
        String cat = normalizeCategory(category);

        videoRepository.findFirstByMatchIdAndUrl(matchId, cleanUrl).ifPresent(v -> {
            throw new IllegalArgumentException("该链接已经提交过了");
        });

        VideoMetaResolver.VideoMeta meta = metaResolver.resolve(cleanUrl);
        String finalTitle = (title != null && !title.isBlank()) ? title.trim() : meta.title();

        MatchVideo video = MatchVideo.builder()
                .matchId(matchId)
                .tournamentId(match.getTournamentId())
                .url(cleanUrl)
                .bvid(meta.bvid())
                .platform(meta.platform())
                .title(finalTitle)
                .category(cat)
                .coverUrl(meta.coverUrl())
                .durationSec(meta.durationSec())
                .uploadedBy(userId)
                .uploaderRole(role)
                .status(ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();
        return videoVO(videoRepository.save(video),
                teamName(match.getTeam1Id()) + " vs " + teamName(match.getTeam2Id()),
                tournamentNameOf(match.getTournamentId()));
    }

    @Transactional
    public void delete(Long userId, boolean admin, Long videoId) {
        MatchVideo video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("视频不存在"));
        if (!admin && !video.getUploadedBy().equals(userId)) {
            throw new IllegalArgumentException("无权删除该视频");
        }
        videoRepository.delete(video);
    }

    @Transactional
    public void setStatus(Long videoId, String status) {
        if (!"ACTIVE".equals(status) && !"HIDDEN".equals(status)) {
            throw new IllegalArgumentException("状态只能是 ACTIVE 或 HIDDEN");
        }
        MatchVideo video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("视频不存在"));
        video.setStatus(status);
        videoRepository.save(video);
    }

    // ==================== 权限 ====================

    /** 返回本次上传者身份，用于展示与追溯 */
    private String requireUploadPermission(Long userId, boolean admin, TournamentMatch match) {
        if (admin) {
            return "ADMIN";
        }
        if (certificationService.isReferee(userId)) {
            return "REFEREE";
        }
        Long t1 = match.getTeam1Id();
        Long t2 = match.getTeam2Id();
        boolean participant =
                (t1 != null && teamMemberRepository.existsByTeamIdAndUserId(t1, userId))
                        || (t2 != null && teamMemberRepository.existsByTeamIdAndUserId(t2, userId));
        if (participant) {
            return "PLAYER";
        }
        throw new IllegalArgumentException("只有该场比赛的参赛队员、裁判或管理员可以上传视频");
    }

    // ==================== 内部工具 ====================

    private Map<Long, String> loadMatchNames(List<MatchVideo> videos) {
        List<Long> matchIds = videos.stream().map(MatchVideo::getMatchId).distinct().toList();
        if (matchIds.isEmpty()) {
            return Map.of();
        }
        List<TournamentMatch> matches = matchRepository.findAllById(matchIds);
        Set<Long> teamIds = new HashSet<>();
        for (TournamentMatch m : matches) {
            if (m.getTeam1Id() != null) teamIds.add(m.getTeam1Id());
            if (m.getTeam2Id() != null) teamIds.add(m.getTeam2Id());
        }
        Map<Long, String> names = teamIds.isEmpty() ? Map.of()
                : teamRepository.findAllById(teamIds).stream()
                        .collect(Collectors.toMap(Team::getId, Team::getName));
        return matches.stream().collect(Collectors.toMap(
                TournamentMatch::getId,
                m -> nameOf(names, m.getTeam1Id()) + " vs " + nameOf(names, m.getTeam2Id())
        ));
    }

    private String nameOf(Map<Long, String> names, Long teamId) {
        return teamId == null ? "待定" : names.getOrDefault(teamId, "待定");
    }

    private String teamName(Long teamId) {
        return teamId == null ? "待定"
                : teamRepository.findById(teamId).map(Team::getName).orElse("待定");
    }

    private String tournamentNameOf(Long tournamentId) {
        if (tournamentId == null) {
            return null;
        }
        return tournamentRepository.findById(tournamentId).map(Tournament::getName).orElse(null);
    }

    private Map<Long, String> loadTournamentNames(List<MatchVideo> videos) {
        List<Long> ids = videos.stream().map(MatchVideo::getTournamentId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return tournamentRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Tournament::getId, Tournament::getName));
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "REPLAY";
        }
        String c = category.trim().toUpperCase();
        if (!CATEGORIES.contains(c)) {
            throw new IllegalArgumentException("分类只能是 REPLAY / HIGHLIGHT / OTHER");
        }
        return c;
    }

    private String normalizeHttpsUrl(String url) {
        String s = url == null ? "" : url.trim();
        if (s.isEmpty()) {
            throw new IllegalArgumentException("请填写视频链接");
        }
        if (s.length() > 500) {
            throw new IllegalArgumentException("链接过长");
        }
        if (s.startsWith("//")) {
            s = "https:" + s;
        }
        String lower = s.toLowerCase();
        if (lower.startsWith("http://")) {
            s = "https://" + s.substring(7);
            lower = s.toLowerCase();
        }
        if (!lower.startsWith("https://")) {
            throw new IllegalArgumentException("视频链接必须是 https 地址");
        }
        try {
            URI uri = URI.create(s);
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("链接格式不正确");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("链接格式不正确");
        }
        return s;
    }

    private Map<String, Object> videoVO(MatchVideo v, String matchName, String tournamentName) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("matchId", v.getMatchId());
        m.put("tournamentId", v.getTournamentId());
        m.put("url", v.getUrl());
        m.put("bvid", v.getBvid());
        m.put("platform", v.getPlatform());
        m.put("title", v.getTitle());
        m.put("category", v.getCategory());
        m.put("coverUrl", v.getCoverUrl());
        m.put("durationSec", v.getDurationSec());
        m.put("uploadedBy", v.getUploadedBy());
        m.put("uploaderRole", v.getUploaderRole());
        m.put("status", v.getStatus());
        m.put("createdAt", v.getCreatedAt());
        if (matchName != null) {
            m.put("matchName", matchName);
        }
        if (tournamentName != null) {
            m.put("tournamentName", tournamentName);
        }
        return m;
    }
}
