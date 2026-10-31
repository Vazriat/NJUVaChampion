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
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 视频链接元数据解析：识别平台、提取 B 站稿件号、抓标题/封面/时长。
 *
 * 只负责“尽量补全信息”，失败不影响提交——封面抓不到就留空，前端用占位块。
 */
@Slf4j
@Component
public class VideoMetaResolver {

    public record VideoMeta(String platform, String bvid, String title, String coverUrl, Integer durationSec) {}

    private static final Pattern BVID = Pattern.compile("(BV[0-9A-Za-z]{10})");
    private static final Set<String> SHORT_LINK_HOSTS = Set.of("b23.tv", "www.b23.tv");
    private static final int MAX_REDIRECTS = 3;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final String UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private static final String VIEW_API = "https://api.bilibili.com/x/web-interface/view?bvid=";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final ObjectMapper objectMapper;

    public VideoMetaResolver(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 解析链接。任何失败都只降级，不抛异常——视频能否提交不依赖外部接口。
     */
    public VideoMeta resolve(String input) {
        String raw = input == null ? "" : input.trim();
        if (raw.isEmpty()) {
            return new VideoMeta("OTHER", null, null, null, null);
        }

        String url = raw.toLowerCase().startsWith("http") ? raw : "https://" + raw;
        String bvid = null;

        Matcher direct = BVID.matcher(url);
        if (direct.find()) {
            bvid = direct.group(1);
        } else if (SHORT_LINK_HOSTS.contains(hostOf(url))) {
            String expanded = followShortLink(url);
            Matcher m = BVID.matcher(expanded);
            if (m.find()) {
                bvid = m.group(1);
            }
        }

        if (bvid == null) {
            return new VideoMeta("OTHER", null, null, null, null);
        }
        return fetchBiliMeta(bvid);
    }

    private VideoMeta fetchBiliMeta(String bvid) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(VIEW_API + bvid))
                    // 不设 Origin：B 站对带 Origin 的请求直接 403
                    .header("User-Agent", UA)
                    .header("Referer", "https://www.bilibili.com/")
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                return new VideoMeta("BILIBILI", bvid, null, null, null);
            }
            JsonNode root = objectMapper.readTree(resp.body());
            if (root.path("code").asInt(-1) != 0) {
                return new VideoMeta("BILIBILI", bvid, null, null, null);
            }
            JsonNode data = root.path("data");
            String cover = data.path("pic").asText("");
            if (cover.startsWith("http://")) {
                // 页面是 https 的，http 图片会被浏览器按混合内容拦掉
                cover = "https://" + cover.substring(7);
            }
            int duration = data.path("duration").asInt(0);
            return new VideoMeta(
                    "BILIBILI",
                    bvid,
                    data.path("title").asText(null),
                    cover.isEmpty() ? null : cover,
                    duration > 0 ? duration : null
            );
        } catch (Exception e) {
            log.warn("抓取 B 站视频信息失败 bvid={} : {}", bvid, e.getMessage());
            return new VideoMeta("BILIBILI", bvid, null, null, null);
        }
    }

    private String followShortLink(String url) {
        String current = url;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(current))
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
                URI next = URI.create(current).resolve(location.get());
                String host = next.getHost() == null ? "" : next.getHost().toLowerCase();
                // 只允许跳到 B 站自家域名，防止被构造成任意跳转
                if (!host.endsWith("bilibili.com") && !SHORT_LINK_HOSTS.contains(host)) {
                    return current;
                }
                current = next.toString();
            } catch (Exception e) {
                return current;
            }
        }
        return current;
    }

    private String hostOf(String url) {
        try {
            String h = URI.create(url).getHost();
            return h == null ? "" : h.toLowerCase();
        } catch (Exception e) {
            return "";
        }
    }
}
