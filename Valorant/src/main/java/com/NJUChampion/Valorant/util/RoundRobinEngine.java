package com.NJUChampion.Valorant.util;

import java.util.ArrayList;
import java.util.List;

/**
 * 循环赛对阵生成器（circle method 轮转法）。
 * 单循环：N 队各交手一次；双循环：两阶段，第二阶段主客对调。
 * N 为奇数时插入轮空位（team1/team2 为 null 表示轮空）。
 */
public class RoundRobinEngine {

    public static class Pair {
        public final Long team1;
        public final Long team2;
        public final int round;
        public final int position;

        public Pair(Long team1, Long team2, int round, int position) {
            this.team1 = team1;
            this.team2 = team2;
            this.round = round;
            this.position = position;
        }
    }

    public static List<Pair> generate(List<Long> teamIds, boolean doubleRoundRobin) {
        List<Pair> first = generateSingle(teamIds);
        if (!doubleRoundRobin) {
            return first;
        }
        int totalRounds = roundCount(teamIds.size());
        List<Pair> second = new ArrayList<>();
        for (Pair p : first) {
            second.add(new Pair(p.team2, p.team1, p.round + totalRounds, p.position));
        }
        List<Pair> all = new ArrayList<>(first);
        all.addAll(second);
        return all;
    }

    private static int roundCount(int teamCount) {
        return teamCount % 2 == 0 ? teamCount - 1 : teamCount;
    }

    private static List<Pair> generateSingle(List<Long> teamIds) {
        List<Long> teams = new ArrayList<>(teamIds);
        int n = teams.size();
        if (n % 2 != 0) {
            teams.add(null); // 轮空位
            n++;
        }
        List<Pair> pairs = new ArrayList<>();
        int rounds = n - 1;
        int half = n / 2;
        for (int round = 0; round < rounds; round++) {
            for (int i = 0; i < half; i++) {
                Long a = teams.get(i);
                Long b = teams.get(n - 1 - i);
                pairs.add(new Pair(a, b, round, i));
            }
            // 轮转：固定第 0 位，其余循环右移
            Long last = teams.get(n - 1);
            for (int i = n - 1; i > 1; i--) {
                teams.set(i, teams.get(i - 1));
            }
            teams.set(1, last);
        }
        return pairs;
    }
}
