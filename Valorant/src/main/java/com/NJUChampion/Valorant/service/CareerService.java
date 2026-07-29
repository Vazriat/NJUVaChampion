package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CareerService {

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
        double totalAcs = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0;
        int wins = 0;
        Map<String, Integer> agentCount = new HashMap<>();
        Set<Long> tournamentIds = new HashSet<>();

        for (PlayerGameStat stat : allStats) {
            Map<String, Object> s = stat.getStats();
            totalAcs += ((Number) s.getOrDefault("acs", 0)).doubleValue();
            totalKills += ((Number) s.getOrDefault("kills", 0)).doubleValue();
            totalDeaths += ((Number) s.getOrDefault("deaths", 0)).doubleValue();
            totalAssists += ((Number) s.getOrDefault("assists", 0)).doubleValue();

            String agent = (String) s.get("agent");
            if (agent != null && !agent.isBlank()) {
                agentCount.merge(agent, 1, Integer::sum);
            }

            // Check win: compare team score vs opponent team score in the game
            GameRecord game = gameRecordRepository.findById(stat.getGameId()).orElse(null);
            if (game != null && game.getTeam1Score() != null && game.getTeam2Score() != null) {
                Long teamId = stat.getTeamId();
                boolean isTeam1 = teamId != null && game.getMatchId() != null;
                if (isTeam1) {
                    TournamentMatch match = matchRepository.findById(game.getMatchId()).orElse(null);
                    if (match != null) {
                        tournamentIds.add(match.getTournamentId());
                    }
                }
                // Determine if this player's team won
                if (teamId != null) {
                    // We need to know which team this player was on and compare scores
                    // For now, check if the player's teamId matches team1Id in game
                    // Actually, GameRecord only has team1Score/team2Score, doesn't store which team is which
                    // We'll determine by looking at TournamentMatch which has team1Id/team2Id
                    TournamentMatch match = matchRepository.findById(game.getMatchId()).orElse(null);
                    if (match != null) {
                        tournamentIds.add(match.getTournamentId());
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
        result.put("totalGames", totalGames);
        result.put("avgAcs", Math.round(avgAcs * 10) / 10.0);
        result.put("avgKd", Math.round(kdRatio * 100) / 100.0);
        result.put("avgKills", totalGames > 0 ? Math.round(totalKills / totalGames * 10) / 10.0 : 0);
        result.put("avgDeaths", totalGames > 0 ? Math.round(totalDeaths / totalGames * 10) / 10.0 : 0);
        result.put("avgAssists", totalGames > 0 ? Math.round(totalAssists / totalGames * 10) / 10.0 : 0);
        result.put("totalWins", wins);
        result.put("totalLosses", totalGames - wins);
        result.put("winRate", totalGames > 0 ? Math.round((double) wins / totalGames * 10000) / 100.0 : 0);
        result.put("topAgents", topAgents);
        result.put("tournaments", tournaments);

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
