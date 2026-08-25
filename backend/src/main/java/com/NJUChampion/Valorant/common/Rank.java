package com.NJUChampion.Valorant.common;

/**
 * 规范化段位枚举，按段位由低到高排序。
 * label 即数据库存储值（User.verifiedRank / Certification.rankValue）。
 *
 * 段位体系（共 23 级）：
 * 黑铁（最低，不分小段）→ 青铜/白银/黄金/铂金/钻石/超凡/神话 各分 1、2、3
 * → 源能战魂（最高，不分小段）。
 *
 * 评分规则：黑铁 1 分；每个大段 base = 2 * 4^k，段内三小段为 base / base*1.5 / base*2。
 * 即 青铜1=2, 白银1=8, 黄金1=32, 铂金1=128, 钻石1=512, 超凡1=2048, 神话1=8192, 源能战魂=32768。
 */
public enum Rank {
    IRON("黑铁", 1, 1),
    BRONZE_1("青铜1", 2, 2),
    BRONZE_2("青铜2", 3, 3),
    BRONZE_3("青铜3", 4, 4),
    SILVER_1("白银1", 5, 8),
    SILVER_2("白银2", 6, 12),
    SILVER_3("白银3", 7, 16),
    GOLD_1("黄金1", 8, 32),
    GOLD_2("黄金2", 9, 48),
    GOLD_3("黄金3", 10, 64),
    PLATINUM_1("铂金1", 11, 128),
    PLATINUM_2("铂金2", 12, 192),
    PLATINUM_3("铂金3", 13, 256),
    DIAMOND_1("钻石1", 14, 512),
    DIAMOND_2("钻石2", 15, 768),
    DIAMOND_3("钻石3", 16, 1024),
    ASCENDANT_1("超凡1", 17, 2048),
    ASCENDANT_2("超凡2", 18, 3072),
    ASCENDANT_3("超凡3", 19, 4096),
    IMMORTAL_1("神话1", 20, 8192),
    IMMORTAL_2("神话2", 21, 12288),
    IMMORTAL_3("神话3", 22, 16384),
    RADIANT("源能战魂", 23, 32768);

    private final String label;
    private final int order;
    private final int score;

    Rank(String label, int order, int score) {
        this.label = label;
        this.order = order;
        this.score = score;
    }

    public String getLabel() {
        return label;
    }

    /** 段位顺序值，1 最低，23 最高，用于字典序排序。 */
    public int getOrder() {
        return order;
    }

    /** 段位评分，1 最低，32768 最高。 */
    public int getScore() {
        return score;
    }

    public static Rank fromLabel(String label) {
        if (label == null) {
            return null;
        }
        for (Rank r : values()) {
            if (r.label.equals(label)) {
                return r;
            }
        }
        return null;
    }

    public static boolean isValid(String label) {
        return fromLabel(label) != null;
    }

    /** 返回段位顺序值，非法段位返回 0。 */
    public static int orderOf(String label) {
        Rank r = fromLabel(label);
        return r == null ? 0 : r.order;
    }

    /** 返回段位评分，非法/未认证段位按最低段位（黑铁）计分。 */
    public static int scoreOf(String label) {
        Rank r = fromLabel(label);
        return r == null ? IRON.score : r.score;
    }
}
