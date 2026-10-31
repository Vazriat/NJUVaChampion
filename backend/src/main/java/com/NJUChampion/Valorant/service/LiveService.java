package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 直播与回放。
 *
 * 设计要点：
 * - 直播起止由裁判手动控制，系统只做兜底（比赛完结关播、6 小时懒过期）
 * - 开播不检查 match.status：系统里比赛没有「进行中」状态，且重赛需要能重新开播
 * - 回放独立于直播：没开播的场次也能传，重赛不覆盖历史
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveService {

    private final RefereeChannelRepository channelRepository;
    private final LiveStreamRepository streamRepository;
    private final TournamentMatchRepository matchRepository;
    private final TournamentRepository tournamentRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final CertificationService certificationService;
    private final LiveUrlResolver urlResolver;

    /** 直播超过这个时长仍未结束，视为裁判遗忘，自动关闭 */
    private static final int STALE_HOURS = 6;

    private static final String LIVE = "LIVE";
    private static final String ENDED = "ENDED";

    // ==================== 频道 ====================

    public Map<String, Object> myChannel(Long userId) {
        return channelRepository.findByUserId(userId).map(this::channelVO).orElse(null);
    }

    @Transactional
    public Map<String, Object> bindChannel(Long userId, String url) {
        requireReferee(userId);
        LiveUrlResolver.ResolvedChannel resolved = urlResolver.resolve(url);

        RefereeChannel channel = channelRepository.findByUserId(userId).orElseGet(
                () -> RefereeChannel.builder().userId(userId).build());
        channel.setPlatform(resolved.platform());
        channel.setRoomId(resolved.roomId());
        channel.setRawUrl(resolved.normalizedUrl());
        channel.setStatus("ACTIVE");
        return channelVO(channelRepository.save(channel));
    }

    @Transactional
    public void unbindChannel(Long userId) {
        streamRepository.findFirstByRefereeIdAndStatus(userId, LIVE).ifPresent(s -> {
            throw new IllegalArgumentException("你正在直播中，请先结束直播再解绑");
        });
        channelRepository.findByUserId(userId).ifPresent(channelRepository::delete);
    }

    // ==================== 开播 / 结束 ====================

    /**
     * 开播确认框数据。除「比赛不存在」外不抛异常，把不可开播的原因放在 canStart / blockReason 里，
     * 前端据此渲染，避免一次点击弹出难懂的错误。
     */
    public Map<String, Object> preview(Long userId, Long matchId) {
        expireStale();

        TournamentMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("比赛不存在"));
        Tournament tournament = tournamentRepository.findById(match.getTournamentId()).orElse(null);

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("matchName", matchName(match));
        vo.put("tournamentName", tournament != null ? tournament.getName() : null);

        RefereeChannel channel = channelRepository.findByUserId(userId).orElse(null);
        vo.put("channel", channel != null ? channelVO(channel) : null);

        String blockReason = null;
        Optional<LiveStream> activeOfMatch = streamRepository.findFirstByMatchIdAndStatus(matchId, LIVE);
        Optional<LiveStream> activeOfReferee = streamRepository.findFirstByRefereeIdAndStatus(userId, LIVE);

        if (channel == null) {
            blockReason = "请先在设置页绑定直播间";
        } else if (tournament == null || !"PROGRESSION".equals(tournament.getStatus())) {
            blockReason = "赛事不在进行中，无法开播";
        } else if (activeOfMatch.isPresent()) {
            // 不管是自己还是别人开的，这一场都已经在播了。
            // 之前只拦别人的，导致自己重复点开播时 preview 说可以、start 却报错。
            blockReason = "该场正在直播中";
        } else if (activeOfReferee.isPresent()
                && !activeOfReferee.get().getMatchId().equals(matchId)) {
            blockReason = "你还有另一场在直播中，请先结束它";
        }

        vo.put("canStart", blockReason == null);
        vo.put("blockReason", blockReason);
        vo.put("activeStreamId", activeOfMatch.map(LiveStream::getId).orElse(null));

        // 软提示：不阻止开播，只是让裁判确认一下
        List<String> warnings = new ArrayList<>();
        if ("COMPLETED".equals(match.getStatus())) {
            warnings.add("该场比赛已完结，确认是重赛并重新开播？");
        }
        if (!streamRepository.findByMatchIdOrderByStartedAtDesc(matchId).isEmpty()
                && activeOfMatch.isEmpty()) {
            warnings.add("该场已有直播记录，本次将新增一条");
        }
        vo.put("warnings", warnings);

        if (channel != null && channel.getRoomId() != null) {
            Optional<LiveUrlResolver.BiliRoomInfo> info = urlResolver.roomInfo(channel.getRoomId());
            vo.put("roomTitle", info.map(LiveUrlResolver.BiliRoomInfo::title).orElse(null));
            vo.put("roomLive", info.map(LiveUrlResolver.BiliRoomInfo::live).orElse(null));
        } else {
            vo.put("roomTitle", null);
            vo.put("roomLive", null);
        }
        return vo;
    }

    @Transactional
    public Map<String, Object> start(Long userId, Long matchId) {
        requireReferee(userId);
        expireStale();

        RefereeChannel channel = channelRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("请先在设置页绑定直播间"));
        TournamentMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("比赛不存在"));
        Tournament tournament = tournamentRepository.findById(match.getTournamentId())
                .orElseThrow(() -> new IllegalArgumentException("赛事不存在"));

        if (!"PROGRESSION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在进行中，无法开播");
        }
        if (streamRepository.findFirstByMatchIdAndStatus(matchId, LIVE).isPresent()) {
            throw new IllegalArgumentException("该场正在直播中");
        }
        if (streamRepository.findFirstByRefereeIdAndStatus(userId, LIVE).isPresent()) {
            throw new IllegalArgumentException("你还有一场在直播中，请先结束");
        }

        LiveStream stream = LiveStream.builder()
                .matchId(matchId)
                .tournamentId(match.getTournamentId())
                .refereeId(userId)
                .channelId(channel.getId())
                .platform(channel.getPlatform())
                .roomId(channel.getRoomId())
                .rawUrl(channel.getRawUrl())
                .status(LIVE)
                .startedAt(LocalDateTime.now())
                .activeKey(matchId)
                .build();
        try {
            stream = streamRepository.saveAndFlush(stream);
        } catch (DataIntegrityViolationException e) {
            // active_key 唯一索引兜底，防并发重复开播
            throw new IllegalArgumentException("该场正在直播中");
        }
        return streamVO(stream, match, tournament, loadTeamNames(List.of(match)));
    }

    @Transactional
    public void end(Long userId, Long streamId, boolean force) {
        LiveStream stream = streamRepository.findById(streamId)
                .orElseThrow(() -> new IllegalArgumentException("直播记录不存在"));
        if (!force && !stream.getRefereeId().equals(userId)) {
            throw new IllegalArgumentException("无权结束该直播");
        }
        endInternal(stream);
    }

    /** 比赛完结时兜底关播 */
    @Transactional
    public void endByMatch(Long matchId) {
        streamRepository.findFirstByMatchIdAndStatus(matchId, LIVE).ifPresent(this::endInternal);
    }

    /** 赛事结束兜底关播 */
    @Transactional
    public void endByTournament(Long tournamentId) {
        streamRepository.findByTournamentIdAndStatus(tournamentId, LIVE)
                .forEach(this::endInternal);
    }

    private void endInternal(LiveStream stream) {
        if (ENDED.equals(stream.getStatus())) {
            return;
        }
        stream.setStatus(ENDED);
        stream.setEndedAt(LocalDateTime.now());
        stream.setActiveKey(null);
        streamRepository.save(stream);
    }

    /** 懒过期：把超时未关闭的直播批量结束，避免僵尸记录 */
    public void expireStale() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(STALE_HOURS);
        List<LiveStream> stale = streamRepository.findByStatusAndStartedAtBefore(LIVE, threshold);
        if (stale.isEmpty()) {
            return;
        }
        stale.forEach(s -> {
            s.setStatus(ENDED);
            s.setEndedAt(s.getStartedAt().plusHours(STALE_HOURS));
            s.setActiveKey(null);
        });
        streamRepository.saveAll(stale);
        log.info("自动结束超时直播 {} 条", stale.size());
    }

    // ==================== 查询 ====================

    /** 正在直播列表 */
    public Map<String, Object> liveList(int page, int size) {
        expireStale();
        int p = Math.max(page, 1);
        int s = Math.min(Math.max(size, 1), 50);
        var pageData = streamRepository.findByStatusOrderByStartedAtDesc(LIVE, PageRequest.of(p - 1, s));

        List<Long> matchIds = pageData.getContent().stream().map(LiveStream::getMatchId).toList();
        Map<Long, TournamentMatch> matches = matchRepository.findAllById(matchIds).stream()
                .collect(Collectors.toMap(TournamentMatch::getId, Function.identity()));
        Map<Long, Tournament> tournaments = loadTournaments(matches.values());
        Map<Long, String> teamNames = loadTeamNames(matches.values());

        // 赛事已结束但仍挂着直播的（例如弃权赛没有走完结钩子），读取时就地关掉
        List<LiveStream> visible = new ArrayList<>();
        for (LiveStream item : pageData.getContent()) {
            Tournament t = tournaments.get(item.getTournamentId());
            if (t != null && "ENDED".equals(t.getStatus())) {
                endInternal(item);
            } else {
                visible.add(item);
            }
        }

        List<Map<String, Object>> list = visible.stream()
                .map(sr -> streamVO(sr,
                        matches.get(sr.getMatchId()),
                        tournaments.get(sr.getTournamentId()),
                        teamNames))
                .collect(Collectors.toList());

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("total", pageData.getTotalElements());
        vo.put("list", list);
        return vo;
    }

    /**
     * 裁判可直接开播的比赛：进行中赛事里尚未开打、且当前没有直播的场次。
     * 只列 PENDING，重赛场景从赛事页单场入口开播，避免列表里堆满已完结比赛。
     */
    public List<Map<String, Object>> startableMatches() {
        expireStale();
        List<Tournament> ongoing = tournamentRepository.findByStatusOrderByCreatedAtDesc("PROGRESSION");
        if (ongoing.isEmpty()) {
            return List.of();
        }
        Map<Long, String> tournamentNames = new LinkedHashMap<>();
        List<TournamentMatch> candidates = new ArrayList<>();
        for (Tournament t : ongoing) {
            tournamentNames.put(t.getId(), t.getName());
            matchRepository.findByTournamentIdOrderByRoundAscPositionAsc(t.getId()).stream()
                    .filter(m -> "PENDING".equals(m.getStatus()))
                    .forEach(candidates::add);
        }
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<Long> matchIds = candidates.stream().map(TournamentMatch::getId).toList();
        Set<Long> living = streamRepository.findByMatchIdInAndStatus(matchIds, LIVE).stream()
                .map(LiveStream::getMatchId)
                .collect(Collectors.toSet());
        Map<Long, String> teamNames = loadTeamNames(candidates);

        return candidates.stream()
                .filter(m -> !living.contains(m.getId()))
                .sorted(Comparator.comparing(TournamentMatch::getTournamentId)
                        .thenComparing(TournamentMatch::getRound, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(TournamentMatch::getPosition, Comparator.nullsLast(Integer::compareTo)))
                // 前端按赛事分组并折叠展示，这里给足余量，避免大赛事把后面的赛事挤掉
                .limit(200)
                .map(m -> {
                    Map<String, Object> vo = new LinkedHashMap<>();
                    vo.put("matchId", m.getId());
                    vo.put("tournamentId", m.getTournamentId());
                    vo.put("tournamentName", tournamentNames.get(m.getTournamentId()));
                    vo.put("team1Name", m.getTeam1Id() != null
                            ? teamNames.getOrDefault(m.getTeam1Id(), "待定") : "待定");
                    vo.put("team2Name", m.getTeam2Id() != null
                            ? teamNames.getOrDefault(m.getTeam2Id(), "待定") : "待定");
                    vo.put("round", m.getRound());
                    vo.put("stage", m.getStage());
                    vo.put("matchStatus", m.getStatus());
                    return vo;
                })
                .collect(Collectors.toList());
    }

    /** 我当前正在直播的场次（用于裁判工作台随时结束） */
    public List<Map<String, Object>> myActiveStreams(Long refereeId) {
        Optional<LiveStream> active = streamRepository.findFirstByRefereeIdAndStatus(refereeId, LIVE);
        if (active.isEmpty()) {
            return List.of();
        }
        LiveStream s = active.get();
        TournamentMatch match = matchRepository.findById(s.getMatchId()).orElse(null);
        Tournament tournament = tournamentRepository.findById(s.getTournamentId()).orElse(null);
        Map<Long, String> teamNames = match != null ? loadTeamNames(List.of(match)) : Map.of();
        return List.of(streamVO(s, match, tournament, teamNames));
    }

    /** 某场的直播历史 */
    public List<Map<String, Object>> matchStreams(Long matchId) {        expireStale();
        List<LiveStream> streams = streamRepository.findByMatchIdOrderByStartedAtDesc(matchId);
        if (streams.isEmpty()) {
            return List.of();
        }
        TournamentMatch match = matchRepository.findById(matchId).orElse(null);
        Map<Long, Tournament> tournaments = match != null
                ? loadTournaments(List.of(match)) : Map.of();
        Map<Long, String> teamNames = match != null
                ? loadTeamNames(List.of(match)) : Map.of();
        return streams.stream()
                .map(s -> streamVO(s, match, tournaments.get(s.getTournamentId()), teamNames))
                .collect(Collectors.toList());
    }

    /** 主播列表：只展示已绑定频道且未被隐藏的裁判 */
    public Map<String, Object> channels(int page, int size) {
        return pageChannels("ACTIVE", page, size);
    }

    /** 管理端频道列表，可按状态筛选（传 null 查全部） */
    public Map<String, Object> adminChannels(String status, int page, int size) {
        return pageChannels(status, page, size);
    }

    @Transactional
    public void setChannelStatus(Long channelId, String status) {
        if (!"ACTIVE".equals(status) && !"HIDDEN".equals(status)) {
            throw new IllegalArgumentException("状态只能是 ACTIVE 或 HIDDEN");
        }
        RefereeChannel ch = channelRepository.findById(channelId)
                .orElseThrow(() -> new IllegalArgumentException("频道不存在"));
        ch.setStatus(status);
        channelRepository.save(ch);
    }

    private Map<String, Object> pageChannels(String status, int page, int size) {
        int p = Math.max(page, 1);
        int s = Math.min(Math.max(size, 1), 50);
        var pageData = status == null
                ? channelRepository.findAll(PageRequest.of(p - 1, s))
                : channelRepository.findByStatusOrderByUpdatedAtDesc(status, PageRequest.of(p - 1, s));

        List<Long> userIds = pageData.getContent().stream().map(RefereeChannel::getUserId).toList();
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        // 是否在播只看本站直播记录，不打 B 站接口（避免高频轮询被限流）
        Map<Long, LiveStream> activeByReferee = userIds.isEmpty()
                ? Map.of()
                : streamRepository.findByRefereeIdInAndStatus(userIds, LIVE).stream()
                        .collect(Collectors.toMap(LiveStream::getRefereeId, Function.identity()));

        List<Map<String, Object>> list = pageData.getContent().stream().map(ch -> {
            User u = users.get(ch.getUserId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", ch.getUserId());
            m.put("username", u != null ? u.getUsername() : null);
            m.put("gameId", u != null ? u.getGameId() : null);
            m.put("platform", ch.getPlatform());
            m.put("roomId", ch.getRoomId());
            m.put("rawUrl", ch.getRawUrl());
            m.put("status", ch.getStatus());
            m.put("channelId", ch.getId());
            LiveStream active = activeByReferee.get(ch.getUserId());
            m.put("live", active != null);
            m.put("liveMatchId", active != null ? active.getMatchId() : null);
            m.put("liveStreamId", active != null ? active.getId() : null);
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("total", pageData.getTotalElements());
        vo.put("list", list);
        return vo;
    }

    // ==================== 内部工具 ====================

    private void requireReferee(Long userId) {
        if (!certificationService.isReferee(userId)) {
            throw new IllegalArgumentException("仅通过裁判认证的用户可以操作直播");
        }
    }

    private Map<Long, Tournament> loadTournaments(Collection<TournamentMatch> matches) {
        List<Long> ids = matches.stream().map(TournamentMatch::getTournamentId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return tournamentRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Tournament::getId, Function.identity()));
    }

    private Map<Long, String> loadTeamNames(Collection<TournamentMatch> matches) {
        Set<Long> ids = new HashSet<>();
        for (TournamentMatch m : matches) {
            if (m.getTeam1Id() != null) ids.add(m.getTeam1Id());
            if (m.getTeam2Id() != null) ids.add(m.getTeam2Id());
        }
        if (ids.isEmpty()) {
            return Map.of();
        }
        return teamRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Team::getId, Team::getName));
    }

    private String matchName(TournamentMatch m) {
        if (m == null) {
            return null;
        }
        String t1 = m.getTeam1Id() != null
                ? teamRepository.findById(m.getTeam1Id()).map(Team::getName).orElse("待定") : "待定";
        String t2 = m.getTeam2Id() != null
                ? teamRepository.findById(m.getTeam2Id()).map(Team::getName).orElse("待定") : "待定";
        return t1 + " vs " + t2;
    }

    private Map<String, Object> channelVO(RefereeChannel ch) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", ch.getId());
        m.put("platform", ch.getPlatform());
        m.put("roomId", ch.getRoomId());
        m.put("rawUrl", ch.getRawUrl());
        m.put("status", ch.getStatus());
        m.put("updatedAt", ch.getUpdatedAt());
        return m;
    }

    private Map<String, Object> streamVO(LiveStream s, TournamentMatch match,
                                         Tournament tournament, Map<Long, String> teamNames) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("matchId", s.getMatchId());
        m.put("tournamentId", s.getTournamentId());
        m.put("refereeId", s.getRefereeId());
        m.put("platform", s.getPlatform());
        m.put("roomId", s.getRoomId());
        m.put("rawUrl", s.getRawUrl() != null ? s.getRawUrl()
                : (s.getRoomId() != null ? "https://live.bilibili.com/" + s.getRoomId() : null));
        m.put("status", s.getStatus());
        m.put("startedAt", s.getStartedAt());
        m.put("endedAt", s.getEndedAt());

        if (match != null) {
            String t1 = match.getTeam1Id() != null && teamNames != null
                    ? teamNames.getOrDefault(match.getTeam1Id(), "待定") : "待定";
            String t2 = match.getTeam2Id() != null && teamNames != null
                    ? teamNames.getOrDefault(match.getTeam2Id(), "待定") : "待定";
            m.put("team1Name", t1);
            m.put("team2Name", t2);
            m.put("team1Id", match.getTeam1Id());
            m.put("team2Id", match.getTeam2Id());
            m.put("round", match.getRound());
            m.put("stage", match.getStage());
            m.put("matchStatus", match.getStatus());
        }
        m.put("tournamentName", tournament != null ? tournament.getName() : null);
        return m;
    }

}
