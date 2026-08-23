package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.common.Rank;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CareerService {

    private static final List<String> MAJOR_RANKS = List.of(
            "黑铁", "青铜", "白银", "黄金", "铂金", "钻石", "超凡", "神话", "源能战魂"
    );

    private final PlayerGameStatRepository playerGameStatRepository;
    private final GameRecordRepository gameRecordRepository;
    private final TournamentMatchRepository matchRepository;
    private final TournamentRepository tournamentRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;

    /**
     * Career overview for a user.
     */
    public Map<String, Object> getCareer(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }

        List<PlayerGameStat> allStats = playerGameStatRepository.findByUserId(userId);

        int totalGames = allStats.size();
        double totalAcs = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0, totalFirstBloods = 0;
        double scoredKills = 0, scoredDeaths = 0, scoredAssists = 0, scoredFirstBloods = 0;
        long totalRounds = 0;
        int wins = 0;
        Map<String, Integer> agentCount = new HashMap<>();
        Set<Long> tournamentIds = new HashSet<>();

        for (PlayerGameStat stat : allStats) {
            Map<String, Object> s = stat.getStats();
            double kills = ((Number) s.getOrDefault("kills", 0)).doubleValue();
            double deaths = ((Number) s.getOrDefault("deaths", 0)).doubleValue();
            double assists = ((Number) s.getOrDefault("assists", 0)).doubleValue();
            double firstBloods = ((Number) s.getOrDefault("firstBlood", 0)).doubleValue();
            totalAcs += ((Number) s.getOrDefault("acs", 0)).doubleValue();
            totalKills += kills;
            totalDeaths += deaths;
            totalAssists += assists;
            totalFirstBloods += firstBloods;

            String agent = (String) s.get("agent");
            if (agent != null && !agent.isBlank()) {
                agentCount.merge(agent, 1, Integer::sum);
            }

            // Check win: compare team score vs opponent team score in the game
            GameRecord game = gameRecordRepository.findById(stat.getGameId()).orElse(null);
            if (game == null) continue;
            if (game.getTeam1Score() != null && game.getTeam2Score() != null) {
                int rounds = game.getTeam1Score() + game.getTeam2Score();
                if (rounds > 0) {
                    totalRounds += rounds;
                    scoredKills += kills;
                    scoredDeaths += deaths;
                    scoredAssists += assists;
                    scoredFirstBloods += firstBloods;
                }

                TournamentMatch match = matchRepository.findById(game.getMatchId()).orElse(null);
                if (match != null) {
                    tournamentIds.add(match.getTournamentId());
                    Long teamId = stat.getTeamId();
                    if (teamId != null) {
                        boolean isTeam1InMatch = teamId.equals(match.getTeam1Id());
                        boolean team1Won = game.getTeam1Score() > game.getTeam2Score();
                        boolean team2Won = game.getTeam2Score() > game.getTeam1Score();
                        if ((isTeam1InMatch && team1Won) || (!isTeam1InMatch && team2Won)) {
                            wins++;
                        }
                    }
                }
            }
        }

        double avgAcs = totalGames > 0 ? totalAcs / totalGames : 0;
        double kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;
        double killsPerRound = totalRounds > 0 ? scoredKills / totalRounds : 0;
        double deathsPerRound = totalRounds > 0 ? scoredDeaths / totalRounds : 0;
        double assistsPerRound = totalRounds > 0 ? scoredAssists / totalRounds : 0;
        double firstBloodRate = totalRounds > 0 ? scoredFirstBloods / totalRounds : 0;
        double survivalRate = 1 - deathsPerRound;
        if (survivalRate < 0) survivalRate = 0;
        if (survivalRate > 1) survivalRate = 1;

        // Top agents
        List<Map<String, Object>> topAgents = agentCount.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("agent", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());

        // Tournament names
        List<Map<String, Object>> tournaments = tournamentIds.stream()
                .map(id -> tournamentRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", t.getId());
                    m.put("name", t.getName());
                    return m;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("username", user.getUsername());
        result.put("gameId", user.getDisplayGameId());
        result.put("verifiedRank", user.getVerifiedRank());
        result.put("totalGames", totalGames);
        result.put("avgAcs", Math.round(avgAcs * 10) / 10.0);
        result.put("avgKd", Math.round(kdRatio * 100) / 100.0);
        result.put("avgKills", totalGames > 0 ? Math.round(totalKills / totalGames * 10) / 10.0 : 0);
        result.put("avgDeaths", totalGames > 0 ? Math.round(totalDeaths / totalGames * 10) / 10.0 : 0);
        result.put("avgAssists", totalGames > 0 ? Math.round(totalAssists / totalGames * 10) / 10.0 : 0);
        result.put("killsPerRound", Math.round(killsPerRound * 100) / 100.0);
        result.put("deathsPerRound", Math.round(deathsPerRound * 100) / 100.0);
        result.put("assistsPerRound", Math.round(assistsPerRound * 100) / 100.0);
        result.put("firstBloodRate", Math.round(firstBloodRate * 100) / 100.0);
        result.put("survivalRate", Math.round(survivalRate * 100) / 100.0);
        result.put("totalKills", (long) Math.round(totalKills));
        result.put("totalDeaths", (long) Math.round(totalDeaths));
        result.put("totalAssists", (long) Math.round(totalAssists));
        result.put("totalFirstBloods", (long) Math.round(totalFirstBloods));
        result.put("totalRounds", totalRounds);
        result.put("totalWins", wins);
        result.put("totalLosses", totalGames - wins);
        result.put("winRate", totalGames > 0 ? Math.round((double) wins / totalGames * 10000) / 100.0 : 0);
        result.put("topAgents", topAgents);
        result.put("tournaments", tournaments);

        return result;
    }

    /**
     * Career analysis: user's six metrics vs a selected rank base set.
     */
    public Map<String, Object> getCareerAnalysis(Long userId, List<String> majors, Set<Long> tournamentIds) {
        if (majors == null || majors.isEmpty()) {
            throw new IllegalArgumentException("请至少选择一个段位");
        }
        List<String> selectedMajors = majors.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.toList());
        if (selectedMajors.isEmpty()) {
            throw new IllegalArgumentException("请至少选择一个段位");
        }
        for (String major : selectedMajors) {
            if (!MAJOR_RANKS.contains(major)) {
                throw new IllegalArgumentException("请选择合法的大段位：" + major);
            }
        }
        List<String> subRanks = selectedMajors.stream()
                .flatMap(major -> Arrays.stream(Rank.values())
                        .map(Rank::getLabel)
                        .filter(label -> label.startsWith(major)))
                .distinct()
                .collect(Collectors.toList());

        Map<String, Double> userMetrics = computeMetricsForUsers(Collections.singletonList(userId), tournamentIds).get(userId);
        if (userMetrics == null) {
            userMetrics = emptyMetrics();
        }

        List<User> baseUsers = userRepository.findByVerifiedRankIn(subRanks);
        List<Long> baseUserIds = baseUsers.stream().map(User::getId).collect(Collectors.toList());
        Map<Long, Map<String, Double>> baseMetrics = computeMetricsForUsers(baseUserIds, tournamentIds);

        List<Map<String, Double>> activeMetrics = baseMetrics.values().stream()
                .filter(m -> m.getOrDefault("rounds", 0.0) > 0)
                .collect(Collectors.toList());

        String[] dims = {"acs", "kd", "kpr", "survivalRate", "assistsPerRound", "firstBloodRate"};
        Map<String, Double> averages = new LinkedHashMap<>();
        Map<String, List<Double>> valuesByDim = new LinkedHashMap<>();
        for (String dim : dims) {
            List<Double> values = activeMetrics.stream()
                    .map(m -> m.getOrDefault(dim, 0.0))
                    .collect(Collectors.toList());
            valuesByDim.put(dim, values);
            double avg = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            averages.put(dim, Math.round(avg * 100) / 100.0);
        }

        List<Map<String, Object>> dimensions = new ArrayList<>();
        for (String dim : dims) {
            double userValue = userMetrics.getOrDefault(dim, 0.0);
            List<Double> values = valuesByDim.get(dim);

            Integer topRank = null;
            Integer botRank = null;
            if (!values.isEmpty()) {
                long greater = values.stream().filter(v -> v > userValue).count();
                if (greater < 3) {
                    topRank = (int) greater + 1;
                }
                long less = values.stream().filter(v -> v < userValue).count();
                if (less < 3) {
                    botRank = (int) less + 1;
                }
            }

            Map<String, Object> d = new LinkedHashMap<>();
            d.put("key", dim);
            d.put("value", Math.round(userValue * 100) / 100.0);
            d.put("average", averages.get(dim));
            d.put("topRank", topRank);
            d.put("botRank", botRank);
            d.put("top3", topRank != null);
            d.put("bot3", botRank != null);
            dimensions.add(d);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("rank", String.join("、", selectedMajors));
        result.put("ranks", selectedMajors);
        result.put("baseSetSize", activeMetrics.size());
        result.put("averages", averages);
        result.put("dimensions", dimensions);
        result.put("tournamentIds", tournamentIds == null ? List.of() : new ArrayList<>(tournamentIds));
        return result;
    }

    private Map<String, Double> emptyMetrics() {
        Map<String, Double> m = new LinkedHashMap<>();
        m.put("games", 0.0);
        m.put("rounds", 0.0);
        m.put("acs", 0.0);
        m.put("kd", 0.0);
        m.put("kpr", 0.0);
        m.put("survivalRate", 0.0);
        m.put("assistsPerRound", 0.0);
        m.put("firstBloodRate", 0.0);
        return m;
    }

    private Map<Long, Map<String, Double>> computeMetricsForUsers(List<Long> userIds) {
        return computeMetricsForUsers(userIds, null);
    }

    private Map<Long, Map<String, Double>> computeMetricsForUsers(List<Long> userIds, Set<Long> tournamentIds) {
        Map<Long, Map<String, Double>> result = new HashMap<>();
        if (userIds == null || userIds.isEmpty()) {
            return result;
        }

        List<PlayerGameStat> allStats = playerGameStatRepository.findByUserIdIn(userIds);

        if (tournamentIds != null && !tournamentIds.isEmpty()) {
            Set<Long> allGameIds = allStats.stream()
                    .map(PlayerGameStat::getGameId)
                    .collect(Collectors.toSet());
            Map<Long, GameRecord> allGames = gameRecordRepository.findAllById(allGameIds).stream()
                    .collect(Collectors.toMap(GameRecord::getId, g -> g, (a, b) -> a));
            Set<Long> matchIds = allGames.values().stream()
                    .map(GameRecord::getMatchId)
                    .collect(Collectors.toSet());
            Map<Long, TournamentMatch> matches = matchRepository.findAllById(matchIds).stream()
                    .collect(Collectors.toMap(TournamentMatch::getId, m -> m, (a, b) -> a));

            allStats = allStats.stream()
                    .filter(stat -> {
                        GameRecord game = allGames.get(stat.getGameId());
                        if (game == null) return false;
                        TournamentMatch match = matches.get(game.getMatchId());
                        return match != null && tournamentIds.contains(match.getTournamentId());
                    })
                    .collect(Collectors.toList());
        }

        Map<Long, List<PlayerGameStat>> byUser = allStats.stream()
                .collect(Collectors.groupingBy(PlayerGameStat::getUserId));

        Set<Long> gameIds = allStats.stream()
                .map(PlayerGameStat::getGameId)
                .collect(Collectors.toSet());
        Map<Long, GameRecord> games = gameRecordRepository.findAllById(gameIds).stream()
                .collect(Collectors.toMap(GameRecord::getId, g -> g, (a, b) -> a));

        for (Map.Entry<Long, List<PlayerGameStat>> entry : byUser.entrySet()) {
            double totalAcs = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0, totalFirstBloods = 0;
            long totalRounds = 0;
            int totalGames = 0;

            for (PlayerGameStat stat : entry.getValue()) {
                Map<String, Object> s = stat.getStats();
                double kills = ((Number) s.getOrDefault("kills", 0)).doubleValue();
                double deaths = ((Number) s.getOrDefault("deaths", 0)).doubleValue();
                double assists = ((Number) s.getOrDefault("assists", 0)).doubleValue();
                double firstBloods = ((Number) s.getOrDefault("firstBlood", 0)).doubleValue();
                totalAcs += ((Number) s.getOrDefault("acs", 0)).doubleValue();
                totalKills += kills;
                totalDeaths += deaths;
                totalAssists += assists;
                totalFirstBloods += firstBloods;
                totalGames++;

                GameRecord game = games.get(stat.getGameId());
                if (game != null && game.getTeam1Score() != null && game.getTeam2Score() != null) {
                    totalRounds += game.getTeam1Score() + game.getTeam2Score();
                }
            }

            Map<String, Double> m = new LinkedHashMap<>();
            m.put("games", (double) totalGames);
            m.put("rounds", (double) totalRounds);
            m.put("acs", totalGames > 0 ? totalAcs / totalGames : 0);
            m.put("kd", totalDeaths > 0 ? totalKills / totalDeaths : totalKills);
            m.put("kpr", totalRounds > 0 ? totalKills / totalRounds : 0);
            double survivalRate = totalRounds > 0 ? 1 - totalDeaths / totalRounds : 0;
            m.put("survivalRate", Math.max(0, Math.min(1, survivalRate)));
            m.put("assistsPerRound", totalRounds > 0 ? totalAssists / totalRounds : 0);
            m.put("firstBloodRate", totalRounds > 0 ? totalFirstBloods / totalRounds : 0);
            result.put(entry.getKey(), m);
        }

        return result;
    }

    /**
     * Match history for a user with game details.
     */
    public List<Map<String, Object>> getMatchHistory(Long userId) {
        List<PlayerGameStat> allStats = playerGameStatRepository.findByUserId(userId);

        // Group by game
        Map<Long, List<PlayerGameStat>> byGame = allStats.stream()
                .collect(Collectors.groupingBy(PlayerGameStat::getGameId));

        List<Map<String, Object>> history = new ArrayList<>();

        for (Map.Entry<Long, List<PlayerGameStat>> entry : byGame.entrySet()) {
            Long gameId = entry.getKey();
            List<PlayerGameStat> gameStats = entry.getValue();

            GameRecord game = gameRecordRepository.findById(gameId).orElse(null);
            if (game == null) continue;

            TournamentMatch match = matchRepository.findById(game.getMatchId()).orElse(null);
            if (match == null) continue;

            Tournament tournament = tournamentRepository.findById(match.getTournamentId()).orElse(null);

            // Build player stats list
            List<Map<String, Object>> playerStats = gameStats.stream().map(stat -> {
                Map<String, Object> ps = new LinkedHashMap<>(stat.getStats());
                ps.put("playerName", stat.getPlayerName());
                ps.put("teamId", stat.getTeamId());
                return ps;
            }).collect(Collectors.toList());

            Map<String, Object> entry_map = new LinkedHashMap<>();
            entry_map.put("gameId", gameId);
            entry_map.put("gameNumber", game.getGameNumber());
            entry_map.put("tournamentName", tournament != null ? tournament.getName() : null);
            entry_map.put("tournamentId", match.getTournamentId());
            entry_map.put("matchStage", match.getStage());
            entry_map.put("matchRound", match.getRound());
            entry_map.put("team1Id", match.getTeam1Id());
            entry_map.put("team1Name", teamRepository.findById(match.getTeam1Id()).map(Team::getName).orElse(null));
            entry_map.put("team2Id", match.getTeam2Id());
            entry_map.put("team2Name", teamRepository.findById(match.getTeam2Id()).map(Team::getName).orElse(null));
            entry_map.put("team1Score", game.getTeam1Score());
            entry_map.put("team2Score", game.getTeam2Score());
            entry_map.put("winnerId", match.getWinnerId());
            entry_map.put("playerStats", playerStats);
            entry_map.put("createdAt", game.getCreatedAt());

            history.add(entry_map);
        }

        history.sort((a, b) -> {
            Comparable ca = (Comparable) a.getOrDefault("createdAt", "");
            Comparable cb = (Comparable) b.getOrDefault("createdAt", "");
            return cb.compareTo(ca); // newest first
        });

        return history;
    }
}
