package com.NJUChampion.Valorant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 直播链接解析器。
 *
 * 职责：把裁判粘贴的任意文本，解析成「平台 + 房间号 + 规范化链接」。
 *
 * 只有 B 站需要精确解析房间号（站内要嵌播放器）；虎牙/斗鱼/抖音只做域名识别，
 * 原始链接直接用于跳转。
 *
 * 两个实测坑（务必保留对应处理）：
 * 1. B 站短号与真实 room_id 不是一回事。room_id=6 的真实房间是 7734200，
 *    用短号拼 iframe 会黑屏（video 元素都不存在）。必须调 get_info 换真实号。
 * 2. 调 get_info 时不能带 Origin 头，带了直接 403。
 */
@Slf4j
@Component
public class LiveUrlResolver {

    public record ResolvedChannel(String platform, String roomId, String normalizedUrl) {}

    public record BiliRoomInfo(String roomId, String title, boolean live) {}

    private static final Pattern BILI_LIVE = Pattern.compile("live\\.bilibili\\.com/(\\d+)");
    private static final Pattern BILI_SHORT = Pattern.compile("b23\\.tv/[A-Za-z0-9]+");
    private static final Pattern PURE_DIGITS = Pattern.compile("^\\d{1,20}$");

    /** 短链跟随只允许这些域名，防止被当成 SSRF 跳板 */
    private static final Set<String> SHORT_LINK_HOSTS = Set.of("b23.tv", "www.b23.tv");
    private static final int MAX_REDIRECTS = 3;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);

    private static final String UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private static final String ROOM_INFO_API =
            "https://api.live.bilibili.com/room/v1/Room/get_info?room_id=";
    private static final long INFO_TTL_MS = 30_000L;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final ObjectMapper objectMapper;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public LiveUrlResolver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private record Cached(BiliRoomInfo info, long expireAt) {}

    // ==================== 对外入口 ====================

    /**
     * 解析用户粘贴的链接。
     *
     * @throws IllegalArgumentException 链接为空、协议不合法、平台不支持、B 站房间不存在或无法校验
     */
    public ResolvedChannel resolve(String input) {
        String raw = input == null ? "" : input.trim();
        if (raw.isEmpty()) {
            throw new IllegalArgumentException("请填写直播链接");
        }
        if (raw.length() > 500) {
            throw new IllegalArgumentException("链接过长");
        }

        // 只接受完整链接。纯房间号有歧义（B 站/虎牙/斗鱼的房间号格式都是数字），
        // 且用户容易把「短号」和「真实 room_id」搞混，统一要求粘贴完整链接。
        if (PURE_DIGITS.matcher(raw).matches()) {
            throw new IllegalArgumentException("请填写完整的直播间链接，例如 https://live.bilibili.com/12345");
        }

        String url = withScheme(raw);
        URI uri = parseUri(url);
        String host = uri.getHost().toLowerCase();

        // 短链：手动跟随，逐跳校验域名
        if (SHORT_LINK_HOSTS.contains(host)) {
            uri = followShortLink(uri);
            host = uri.getHost().toLowerCase();
        }

        if (host.endsWith("live.bilibili.com")) {
            Matcher m = BILI_LIVE.matcher(uri.toString());
            if (!m.find()) {
                throw new IllegalArgumentException("无法从链接中识别 B 站直播间号");
            }
            BiliRoomInfo info = requireRoomInfo(m.group(1));
            return new ResolvedChannel("BILIBILI", info.roomId(),
                    "https://live.bilibili.com/" + info.roomId());
        }
        if (host.endsWith("bilibili.com")) {
            throw new IllegalArgumentException("这是 B 站视频链接，请填写直播间链接");
        }
        if (host.endsWith("huya.com")) {
            return new ResolvedChannel("HUYA", firstNumber(uri.getPath()), url);
        }
        if (host.endsWith("douyu.com")) {
            return new ResolvedChannel("DOUYU", firstNumber(uri.getPath()), url);
        }
        if (host.endsWith("douyin.com")) {
            return new ResolvedChannel("DOUYIN", firstNumber(uri.getPath()), url);
        }

        throw new IllegalArgumentException("暂不支持该平台，请使用 B 站 / 虎牙 / 斗鱼 / 抖音的直播间链接");
    }

    /**
     * 查询 B 站房间信息（含短号转真实号）。结果缓存 30 秒。
     * 供开播确认框展示房间标题用，失败返回 empty 由调用方降级。
     */
    public Optional<BiliRoomInfo> roomInfo(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return Optional.empty();
        }
        Cached hit = cache.get(roomId);
        if (hit != null && hit.expireAt() > Instant.now().toEpochMilli()) {
            return Optional.of(hit.info());
        }
        try {
            BiliRoomInfo info = callRoomInfo(roomId);
            if (info != null) {
                cache.put(roomId, new Cached(info, Instant.now().toEpochMilli() + INFO_TTL_MS));
                cache.put(info.roomId(), new Cached(info, Instant.now().toEpochMilli() + INFO_TTL_MS));
            }
            return Optional.ofNullable(info);
        } catch (Exception e) {
            log.warn("查询 B 站房间信息失败 roomId={} : {}", roomId, e.getMessage());
            return Optional.empty();
        }
    }

    // ==================== 内部实现 ====================

    private BiliRoomInfo requireRoomInfo(String roomIdOrShort) {
        BiliRoomInfo info;
        try {
            info = callRoomInfo(roomIdOrShort);
        } catch (Exception e) {
            log.warn("校验 B 站直播间失败 roomId={} : {}", roomIdOrShort, e.getMessage());
            throw new IllegalArgumentException("暂时无法校验该直播间，请稍后重试");
        }
        if (info == null) {
            throw new IllegalArgumentException("该 B 站直播间不存在");
        }
        cache.put(roomIdOrShort, new Cached(info, Instant.now().toEpochMilli() + INFO_TTL_MS));
        cache.put(info.roomId(), new Cached(info, Instant.now().toEpochMilli() + INFO_TTL_MS));
        return info;
    }

    /** 调 B 站接口。房间不存在返回 null；网络异常向上抛。 */
    private BiliRoomInfo callRoomInfo(String roomId) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(ROOM_INFO_API + roomId))
                // 不设置 Origin：带上会被 B 站直接 403
                .header("User-Agent", UA)
                .header("Referer", "https://live.bilibili.com/")
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();
        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new IllegalStateException("B 站接口返回 " + resp.statusCode());
        }
        JsonNode root = objectMapper.readTree(resp.body());
        if (root.path("code").asInt(-1) != 0) {
            return null;
        }
        JsonNode data = root.path("data");
        String realRoomId = data.path("room_id").asText("");
        if (realRoomId.isEmpty()) {
            return null;
        }
        return new BiliRoomInfo(
                realRoomId,
                data.path("title").asText(""),
                data.path("live_status").asInt(0) == 1
        );
    }

    private URI followShortLink(URI start) {
        URI current = start;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(current)
                        .header("User-Agent", UA)
                        .timeout(REQUEST_TIMEOUT)
                        .GET()
                        .build();
                HttpResponse<Void> resp = http.send(req, HttpResponse.BodyHandlers.discarding());
                if (resp.statusCode() < 300 || resp.statusCode() >= 400) {
                    return current;
                }
                Optional<String> location = resp.headers().firstValue("Location");
                if (location.isEmpty()) {
                    return current;
                }
                URI next = current.resolve(location.get());
                String nextHost = next.getHost() == null ? "" : next.getHost().toLowerCase();
                // 只允许跳到 B 站自家域名，防止被构造成任意跳转
                if (!(nextHost.endsWith("bilibili.com") || SHORT_LINK_HOSTS.contains(nextHost))) {
                    throw new IllegalArgumentException("短链指向了不受支持的站点");
                }
                current = next;
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                throw new IllegalArgumentException("短链解析失败，请直接粘贴直播间链接");
            }
        }
        return current;
    }

    private String withScheme(String raw) {
        String s = raw.trim();
        if (s.startsWith("//")) {
            return "https:" + s;
        }
        String lower = s.toLowerCase();
        if (lower.startsWith("https://")) {
            return s;
        }
        if (lower.startsWith("http://")) {
            return "https://" + s.substring(7);
        }
        // 形如 xxx: 的前缀一律拒绝（javascript: / data: / file: 等）
        if (lower.matches("^[a-z][a-z0-9+.\\-]*:.*")) {
            throw new IllegalArgumentException("链接格式不正确");
        }
        return "https://" + s;
    }

    private URI parseUri(String url) {
        try {
            URI uri = URI.create(url);
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("链接格式不正确");
            }
            return uri;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("链接格式不正确");
        }
    }

    private String firstNumber(String path) {
        if (path == null) {
            return null;
        }
        Matcher m = Pattern.compile("(\\d{1,20})").matcher(path);
        return m.find() ? m.group(1) : null;
    }
}
