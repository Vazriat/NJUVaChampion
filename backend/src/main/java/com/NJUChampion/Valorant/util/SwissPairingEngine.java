package com.NJUChampion.Valorant.util;

import com.NJUChampion.Valorant.entity.SwissStanding;

import java.util.*;
import java.util.stream.Collectors;

public class SwissPairingEngine {

    public static List<TeamPair> generatePairings(List<SwissStanding> standings,
                                                   int round,
                                                   long seed,
                                                   String mode) {
        Random rng = new Random(seed * 31L + (long) round * 17L);
        boolean buchholzMode = "BUCHHOLZ".equals(mode);

        List<SwissStanding> pool = new ArrayList<>(standings);
        // 防御：队伍总数为奇数时，战绩最差的队伍本轮轮空（16 队制正常不会出现）
        if (pool.size() % 2 != 0) {
            pool.sort(Comparator.comparingInt(SwissStanding::getWins).reversed()
                    .thenComparing(Comparator.comparingDouble(SwissStanding::getBuchholz).reversed()));
            pool.remove(pool.size() - 1);
        }

        // 16 队瑞士轮只做同战绩组内配对：组大小恒为偶数，无需跨组顺延
        Map<Integer, List<SwissStanding>> byWins = pool.stream()
                .sorted(Comparator.comparingInt(SwissStanding::getWins).reversed())
                .collect(Collectors.groupingBy(SwissStanding::getWins, LinkedHashMap::new, Collectors.toList()));

        List<TeamPair> result = new ArrayList<>();
        List<SwissStanding> leftover = new ArrayList<>();

        for (Integer wins : byWins.keySet()) {
            List<SwissStanding> group = new ArrayList<>(byWins.get(wins));

            // 组内多次洗牌重试，选"未配对最少"的方案（已交手对可通过换序回避）
            PairResult best = null;
            for (int attempt = 0; attempt < 30; attempt++) {
                PairResult r = tryPair(group, rng, buchholzMode);
                if (best == null || r.unpaired().size() < best.unpaired().size()) {
                    best = r;
                    if (r.unpaired().isEmpty()) {
                        break;
                    }
                }
            }
            result.addAll(best.pairs());
            leftover.addAll(best.unpaired());
        }

        // 兜底：组内实在无法配对的队伍（16 队制下几乎不会触发），尽力避免重复对阵
        if (leftover.size() >= 2) {
            boolean[] used = new boolean[leftover.size()];
            for (int i = 0; i < leftover.size(); i++) {
                if (used[i]) continue;
                for (int j = i + 1; j < leftover.size(); j++) {
                    if (used[j]) continue;
                    if (!havePlayed(leftover.get(i), leftover.get(j))) {
                        result.add(new TeamPair(leftover.get(i).getTeamId(), leftover.get(j).getTeamId()));
                        used[i] = used[j] = true;
                        break;
                    }
                }
            }
            List<SwissStanding> rest = new ArrayList<>();
            for (int i = 0; i < leftover.size(); i++) {
                if (!used[i]) rest.add(leftover.get(i));
            }
            for (int i = 0; i < rest.size() - 1; i += 2) {
                result.add(new TeamPair(rest.get(i).getTeamId(), rest.get(i + 1).getTeamId()));
            }
        }

        return result;
    }

    /** 一次组内配对尝试：返回配对与未配对队伍（不修改传入列表） */
    private static PairResult tryPair(List<SwissStanding> group, Random rng, boolean buchholzMode) {
        List<SwissStanding> g = new ArrayList<>(group);
        List<TeamPair> pairs = new ArrayList<>();
        List<SwissStanding> unpaired = new ArrayList<>();

        if (buchholzMode) {
            // 同组内按 BU 排序：上半区 vs 下半区（从最弱开始找未交手对手）
            g.sort(Comparator.comparingDouble(SwissStanding::getBuchholz).reversed());
            int half = g.size() / 2;
            List<SwissStanding> top = new ArrayList<>(g.subList(0, half));
            List<SwissStanding> bottom = new ArrayList<>(g.subList(half, g.size()));
            boolean[] used = new boolean[bottom.size()];
            for (SwissStanding a : top) {
                SwissStanding b = null;
                for (int j = bottom.size() - 1; j >= 0; j--) {
                    if (used[j]) continue;
                    if (!havePlayed(a, bottom.get(j))) {
                        b = bottom.get(j);
                        used[j] = true;
                        break;
                    }
                }
                if (b == null) {
                    unpaired.add(a);
                } else {
                    pairs.add(new TeamPair(a.getTeamId(), b.getTeamId()));
                }
            }
            for (int j = 0; j < bottom.size(); j++) {
                if (!used[j]) unpaired.add(bottom.get(j));
            }
        } else {
            Collections.shuffle(g, rng);
            int i = 0;
            while (i < g.size()) {
                SwissStanding a = g.get(i);
                if (i + 1 >= g.size()) {
                    unpaired.add(a);
                    break;
                }
                SwissStanding b = g.get(i + 1);
                if (!havePlayed(a, b)) {
                    pairs.add(new TeamPair(a.getTeamId(), b.getTeamId()));
                    i += 2;
                } else {
                    unpaired.add(a);
                    i += 1;
                }
            }
        }
        return new PairResult(pairs, unpaired);
    }

    private record PairResult(List<TeamPair> pairs, List<SwissStanding> unpaired) {}

    // ========== Top 8 draw (random mode) ==========

    public static List<TeamPair> generateKnockoutPairings(List<SwissStanding> top8, long seed, String knockoutFormat) {
        Random rng = new Random(seed * 31L + 999L);

        // 按胜场、BU 降序（晋级队战绩为 3-0 / 3-1 / 3-2）
        List<SwissStanding> sorted = top8.stream()
                .sorted(Comparator.comparingInt(SwissStanding::getWins).reversed()
                        .thenComparing(Comparator.comparingDouble(SwissStanding::getBuchholz).reversed()))
                .collect(Collectors.toList());

        if (sorted.size() < 8) {
            // 不足 8 队时按序两两配对
            List<TeamPair> fallback = new ArrayList<>();
            for (int i = 0; i < sorted.size() - 1; i += 2) {
                fallback.add(new TeamPair(sorted.get(i).getTeamId(), sorted.get(i + 1).getTeamId()));
            }
            return fallback;
        }

        // 前两名为最高战绩（如 3-0），其余 6 队随机抽取与他们对阵，剩下的两两配对
        List<SwissStanding> rest = new ArrayList<>(sorted.subList(2, sorted.size()));
        Collections.shuffle(rest, rng);
        List<TeamPair> pairs = new ArrayList<>();
        pairs.add(new TeamPair(sorted.get(0).getTeamId(), rest.get(0).getTeamId()));
        pairs.add(new TeamPair(sorted.get(1).getTeamId(), rest.get(1).getTeamId()));
        for (int i = 2; i < rest.size() - 1; i += 2) {
            pairs.add(new TeamPair(rest.get(i).getTeamId(), rest.get(i + 1).getTeamId()));
        }
        return pairs;
    }

    public static boolean havePlayed(SwissStanding a, SwissStanding b) {
        // 解析为数字列表后比较，避免 JSON 子串匹配把 1 和 12 之类的 ID 误判为已交手
        return parseOpponentIds(a.getOpponentIds()).contains(b.getTeamId());
    }

    public static List<Long> parseOpponentIds(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            json = json.trim();
            if (json.startsWith("[")) json = json.substring(1);
            if (json.endsWith("]")) json = json.substring(0, json.length() - 1);
            if (json.isBlank()) return new ArrayList<>();
            return Arrays.stream(json.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(s -> s.replaceAll("\"", ""))
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public static String appendOpponent(String existingJson, Long opponentId) {
        List<Long> ids = parseOpponentIds(existingJson);
        ids.add(opponentId);
        return ids.toString();
    }

    public static class TeamPair {
        private final long team1Id;
        private final long team2Id;

        public TeamPair(long team1Id, long team2Id) {
            this.team1Id = team1Id;
            this.team2Id = team2Id;
        }

        public long getTeam1Id() { return team1Id; }
        public long getTeam2Id() { return team2Id; }
    }
}
