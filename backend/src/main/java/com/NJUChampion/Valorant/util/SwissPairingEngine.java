package com.NJUChampion.Valorant.util;

import com.NJUChampion.Valorant.entity.SwissStanding;

import java.util.*;
import java.util.stream.Collectors;

public class SwissPairingEngine {

    public static List<TeamPair> generatePairings(List<SwissStanding> standings,
                                                   int round,
                                                   long seed,
                                                   String mode) {
        if ("BUCHHOLZ".equals(mode)) {
            return buchholzPair(standings, round, seed);
        }
        return randomPair(standings, round, seed);
    }

    // ========== Random pairing ==========

    private static List<TeamPair> randomPair(List<SwissStanding> standings, int round, long seed) {
        Random rng = new Random(seed * 31L + (long) round * 17L);
        List<SwissStanding> pool = new ArrayList<>(standings);
        // Shuffle entire pool by wins group
        Map<Integer, List<SwissStanding>> byWins = pool.stream()
                .collect(Collectors.groupingBy(SwissStanding::getWins, LinkedHashMap::new, Collectors.toList()));

        List<TeamPair> result = new ArrayList<>();
        List<SwissStanding> carryOver = new ArrayList<>();

        for (Integer wins : byWins.keySet()) {
            List<SwissStanding> group = new ArrayList<>(byWins.get(wins));
            group.addAll(carryOver);
            carryOver.clear();

            Collections.shuffle(group, rng);

            List<SwissStanding> paired = new ArrayList<>();
            for (int i = 0; i < group.size() - 1; i += 2) {
                SwissStanding a = group.get(i);
                SwissStanding b = group.get(i + 1);
                // Skip if already played
                if (havePlayed(a, b)) {
                    // Try neighbor
                    if (i + 2 < group.size()) {
                        b = group.get(i + 2);
                        group.remove(i + 2);
                        paired.add(a);
                        paired.add(b);
                        result.add(new TeamPair(a.getTeamId(), b.getTeamId()));
                        // put the skipped back
                        group.add(group.size() - 1, group.get(i + 1));
                    } else {
                        carryOver.add(a);
                        carryOver.add(b);
                    }
                } else {
                    paired.add(a);
                    paired.add(b);
                    result.add(new TeamPair(a.getTeamId(), b.getTeamId()));
                }
            }
            // Odd one out
            if (group.size() % 2 != 0) {
                carryOver.add(group.get(group.size() - 1));
            }
        }

        // Handle leftover
        if (carryOver.size() == 2) {
            result.add(new TeamPair(carryOver.get(0).getTeamId(), carryOver.get(1).getTeamId()));
        } else if (carryOver.size() > 2) {
            // Pair within leftover
            Collections.shuffle(carryOver, rng);
            for (int i = 0; i < carryOver.size() - 1; i += 2) {
                result.add(new TeamPair(carryOver.get(i).getTeamId(), carryOver.get(i + 1).getTeamId()));
            }
        }

        return result;
    }

    // ========== Buchholz pairing ==========

    private static List<TeamPair> buchholzPair(List<SwissStanding> standings, int round, long seed) {
        Random rng = new Random(seed * 31L + (long) round * 17L);

        // Sort by wins desc, then buchholz desc
        List<SwissStanding> sorted = standings.stream()
                .sorted(Comparator.comparingInt(SwissStanding::getWins).reversed()
                        .thenComparing(Comparator.comparingDouble(SwissStanding::getBuchholz).reversed()))
                .collect(Collectors.toList());

        Map<Integer, List<SwissStanding>> byWins = sorted.stream()
                .collect(Collectors.groupingBy(SwissStanding::getWins, LinkedHashMap::new, Collectors.toList()));

        List<TeamPair> result = new ArrayList<>();
        List<SwissStanding> carryOver = new ArrayList<>();

        for (Integer wins : byWins.keySet()) {
            List<SwissStanding> group = new ArrayList<>(byWins.get(wins));
            group.addAll(carryOver);
            carryOver.clear();

            // Swiss system: top half vs bottom half within group
            int half = group.size() / 2;
            List<SwissStanding> topHalf = group.subList(0, half);
            List<SwissStanding> bottomHalf = group.subList(half, group.size());

            Set<Integer> used = new HashSet<>();
            for (int i = 0; i < topHalf.size(); i++) {
                SwissStanding a = topHalf.get(i);
                SwissStanding b = null;
                // Find best opponent that hasn't played
                for (int j = bottomHalf.size() - 1; j >= 0; j--) {
                    if (used.contains(j)) continue;
                    if (!havePlayed(a, bottomHalf.get(j))) {
                        b = bottomHalf.get(j);
                        used.add(j);
                        break;
                    }
                }
                if (b == null) {
                    // Fallback: any not-played
                    for (int j = 0; j < bottomHalf.size(); j++) {
                        if (used.contains(j)) continue;
                        b = bottomHalf.get(j);
                        used.add(j);
                        break;
                    }
                }
                if (b != null) {
                    result.add(new TeamPair(a.getTeamId(), b.getTeamId()));
                } else {
                    carryOver.add(a);
                }
            }
            if (group.size() % 2 != 0) {
                carryOver.add(group.get(group.size() - 1));
            }
        }

        if (carryOver.size() == 2) {
            result.add(new TeamPair(carryOver.get(0).getTeamId(), carryOver.get(1).getTeamId()));
        }

        return result;
    }

    // ========== Top 8 draw (random mode) ==========

    public static List<TeamPair> generateKnockoutPairings(List<SwissStanding> top8, long seed, String knockoutFormat) {
        Random rng = new Random(seed * 31L + 999L);

        // Sort by wins desc, buchholz desc
        List<SwissStanding> sorted = top8.stream()
                .sorted(Comparator.comparingInt(SwissStanding::getWins).reversed()
                        .thenComparing(Comparator.comparingDouble(SwissStanding::getBuchholz).reversed()))
                .collect(Collectors.toList());

        // Identify 3-0 teams
        SwissStanding first = sorted.get(0);  // 3-0
        SwissStanding second = sorted.get(1); // 3-0

        // 3-2 teams
        List<SwissStanding> threeTwo = sorted.stream()
                .filter(s -> s.getWins() == 3)
                .skip(2)
                .collect(Collectors.toList());

        // Remaining (3-1, 2-3 etc)
        List<SwissStanding> rest = sorted.stream()
                .filter(s -> s.getWins() != 3 || !threeTwo.contains(s))
                .skip(2)
                .collect(Collectors.toList());

        List<TeamPair> pairs = new ArrayList<>();

        // 3-0 #1 draws a 3-2
        Collections.shuffle(threeTwo, rng);
        pairs.add(new TeamPair(first.getTeamId(), threeTwo.get(0).getTeamId()));
        pairs.add(new TeamPair(second.getTeamId(), threeTwo.get(1).getTeamId()));

        // Remaining 4 randomly paired
        List<SwissStanding> remaining = new ArrayList<>();
        remaining.addAll(rest);
        Collections.shuffle(remaining, rng);
        for (int i = 0; i < remaining.size() - 1; i += 2) {
            pairs.add(new TeamPair(remaining.get(i).getTeamId(), remaining.get(i + 1).getTeamId()));
        }

        return pairs;
    }

    public static boolean havePlayed(SwissStanding a, SwissStanding b) {
        if (a.getOpponentIds() == null || a.getOpponentIds().isBlank()) return false;
        String ids = a.getOpponentIds();
        return ids.contains("\"" + b.getTeamId() + "\"");
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
