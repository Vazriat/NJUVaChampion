package com.NJUChampion.Valorant.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/** 裁判申报赛果请求（也是管理员审核修正时使用的 payload 载体） */
@Data
public class CreateResultSubmissionRequest {
    private Long matchId;
    private Integer boType;
    private Integer team1Wins;
    private Integer team2Wins;
    private String note;
    private List<GameItem> games;

    @Data
    public static class GameItem {
        private Integer gameNumber;
        private Integer team1Score;
        private Integer team2Score;
        /** 新上传截图（base64，含 data URI 前缀也可） */
        private String screenshotBase64;
        /** 已存在截图路径（编辑回传时使用） */
        private String screenshotPath;
        private List<PlayerItem> playerStats;

        @Data
        public static class PlayerItem {
            private Long userId;
            private String playerName;
            private Long teamId;
            private Map<String, Object> stats;
        }
    }
}
