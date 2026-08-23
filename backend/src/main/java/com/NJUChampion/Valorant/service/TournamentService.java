package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.CreateTournamentRequest;
import com.NJUChampion.Valorant.dto.TournamentVO;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.util.RoundRobinEngine;
import com.NJUChampion.Valorant.util.SwissPairingEngine;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TournamentService {

    private final TournamentRepository tournamentRepository;
    private final TournamentTeamRepository tournamentTeamRepository;
    private final TournamentMatchRepository tournamentMatchRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final SwissStandingRepository swissStandingRepository;
    private final GameRecordRepository gameRecordRepository;
    private final PlayerGameStatRepository playerGameStatRepository;
    private final LeagueStandingRepository leagueStandingRepository;

    @Value("${app.upload.dir:uploads/screenshots}")
    private String uploadDir;

    @Transactional
    public TournamentVO create(CreateTournamentRequest req) {
        String type = req.getType() != null ? req.getType().toUpperCase() : "CUP";
        String format = req.getFormat() != null ? req.getFormat().toUpperCase() : "SINGLE_ELIM";
        int maxTeams = req.getMaxTeams() != null ? req.getMaxTeams() : 2;

        validateTournamentConfig(type, format, maxTeams);

        if ("LEAGUE".equals(type) && Boolean.TRUE.equals(req.getHasPlayoffs())) {
            int pSize = req.getPlayoffSize() != null ? req.getPlayoffSize() : 8;
            String pFormat = req.getPlayoffFormat() != null ? req.getPlayoffFormat().toUpperCase() : "SINGLE_ELIM";
            if (!Set.of(2, 4, 8).contains(pSize)) {
                throw new IllegalArgumentException("季后赛规模仅支持 2/4/8");
            }
            if (!Set.of("SINGLE_ELIM", "DOUBLE_ELIM").contains(pFormat)) {
                throw new IllegalArgumentException("季后赛赛制仅支持单败/双败");
            }
            if ("DOUBLE_ELIM".equals(pFormat) && !Set.of(4, 8).contains(pSize)) {
                throw new IllegalArgumentException("双败季后赛仅支持 4/8 队");
            }
            if (pSize > maxTeams) {
                throw new IllegalArgumentException("季后赛规模不能超过最大参赛队伍数");
            }
        }

        String bracketType = "CUP".equals(type) ? format : "LEAGUE";

        Tournament tournament = Tournament.builder()
                .name(req.getName())
                .description(req.getDescription())
                .status("SETUP")
                .type(type)
                .format(format)
                .maxTeams(maxTeams)
                .bracketType(bracketType)
                .swissRounds(5)
                .knockoutFormat(req.getKnockoutFormat() != null ? req.getKnockoutFormat().toUpperCase() : "SINGLE_ELIM")
                .swissPairingMode(req.getSwissPairingMode() != null ? req.getSwissPairingMode().toUpperCase() : "RANDOM")
                .hasPlayoffs(req.getHasPlayoffs() != null ? req.getHasPlayoffs() : false)
                .playoffFormat(req.getPlayoffFormat() != null ? req.getPlayoffFormat().toUpperCase() : "SINGLE_ELIM")
                .playoffSize(req.getPlayoffSize() != null ? req.getPlayoffSize() : 8)
                .build();
        tournament = tournamentRepository.save(tournament);
        return toVO(tournament);
    }

    private void validateTournamentConfig(String type, String format, int maxTeams) {
        Set<String> validTypes = Set.of("CUP", "LEAGUE");
        if (!validTypes.contains(type)) {
            throw new IllegalArgumentException("无效的赛事类型，仅支持 CUP / LEAGUE");
        }

        Map<String, Set<String>> formatMap = Map.of(
            "CUP", Set.of("SINGLE_ELIM", "DOUBLE_ELIM", "SWISS_ELIM"),
            "LEAGUE", Set.of("SINGLE_RR", "DOUBLE_RR")
        );
        if (!formatMap.get(type).contains(format)) {
            throw new IllegalArgumentException("类型 " + type + " 不支持赛制 " + format);
        }

        if ("CUP".equals(type)) {
            if ("SINGLE_ELIM".equals(format) && !Set.of(2, 4, 8, 16).contains(maxTeams)) {
                throw new IllegalArgumentException("单败淘汰仅支持 2/4/8/16 队");
            }
            if ("DOUBLE_ELIM".equals(format) && !Set.of(4, 8).contains(maxTeams)) {
                throw new IllegalArgumentException("双败淘汰仅支持 4/8 队");
            }
            if ("SWISS_ELIM".equals(format) && maxTeams != 16) {
                throw new IllegalArgumentException("瑞士轮模式仅支持 16 队");
            }
        }
        if ("LEAGUE".equals(type) && maxTeams < 2) {
            throw new IllegalArgumentException("联赛至少需要 2 支队伍");
        }
    }

    @Transactional
    public TournamentVO publish(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"SETUP".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事状态不正确，当前状态：" + tournament.getStatus());
        }
        tournament.setStatus("REGISTRATION");
        tournament = tournamentRepository.save(tournament);
        return toVO(tournament);
    }

    @Transactional
    public TournamentVO start(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事状态不正确，当前状态：" + tournament.getStatus());
        }

        long count = tournamentTeamRepository.countByTournamentId(tournamentId);
        if (count < 2) {
            throw new IllegalArgumentException("参赛队伍不足，至少需要2支队伍");
        }

        if ("SINGLE_RR".equals(tournament.getFormat()) || "DOUBLE_RR".equals(tournament.getFormat())) {
            initLeague(tournament);
        } else if ("SWISS_ELIM".equals(tournament.getFormat())) {
            initSwissBracket(tournament);
        } else if ("DOUBLE_ELIM".equals(tournament.getFormat())) {
            generateDoubleElimBracket(tournament);
        } else {
            generateBracket(tournament);
        }

        tournament.setStatus("PROGRESSION");
        tournament = tournamentRepository.save(tournament);
        return toVO(tournament);
    }

    // ========== Single Elimination ==========

    private void handleSingleElimMatchResult(Tournament tournament, TournamentMatch match) {
        List<TournamentMatch> allMatches = tournamentMatchRepository.findByTournamentIdOrderByRoundAscPositionAsc(tournament.getId());
        int maxRound = allMatches.stream().mapToInt(TournamentMatch::getRound).max().orElse(0);

        if (match.getRound().equals(maxRound)) {
            tournament.setChampionTeamId(match.getWinnerId());
            tournament.setStatus("ENDED");
            tournamentRepository.save(tournament);
        } else {
            advanceWinner(tournament.getId(), match);
        }
    }

    private void generateBracket(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<TournamentTeam> registeredTeams = tournamentTeamRepository.findByTournamentId(tournamentId);
        int totalTeams = registeredTeams.size();
        int totalRounds = getTotalRounds(totalTeams);

        int[] seedOrder = getSeedOrder(totalTeams);
        List<Long> seededTeamIds = new ArrayList<>();
        for (int seed : seedOrder) {
            if (seed <= registeredTeams.size()) {
                TournamentTeam tt = registeredTeams.get(seed - 1);
                seededTeamIds.add(tt.getTeamId());
            }
        }

        int matchesInFirstRound = totalTeams / 2;
        for (int pos = 0; pos < matchesInFirstRound; pos++) {
            TournamentMatch match = TournamentMatch.builder()
                    .tournamentId(tournamentId)
                    .stage("WINNERS")
                    .round(0)
                    .position(pos)
                    .team1Id(seededTeamIds.get(pos * 2))
                    .team2Id(seededTeamIds.get(pos * 2 + 1))
                    .status("PENDING")
                    .build();
            tournamentMatchRepository.save(match);
        }

        for (int round = 1; round < totalRounds; round++) {
            int matchesInRound = totalTeams / (int) Math.pow(2, round + 1);
            for (int pos = 0; pos < matchesInRound; pos++) {
                TournamentMatch match = TournamentMatch.builder()
                        .tournamentId(tournamentId)
                        .stage("WINNERS")
                        .round(round)
                        .position(pos)
                        .status("PENDING")
                        .build();
                tournamentMatchRepository.save(match);
            }
        }
    }

    private void advanceWinner(Long tournamentId, TournamentMatch completedMatch) {
        int nextRound = completedMatch.getRound() + 1;
        int nextPosition = completedMatch.getPosition() / 2;
        boolean isFirstTeam = completedMatch.getPosition() % 2 == 0;

        List<TournamentMatch> nextMatches = tournamentMatchRepository.findByTournamentIdAndRound(tournamentId, nextRound);
        TournamentMatch nextMatch = nextMatches.stream()
                .filter(m -> m.getPosition().equals(nextPosition))
                .findFirst()
                .orElse(null);
        if (nextMatch == null) return;

        if (isFirstTeam) {
            nextMatch.setTeam1Id(completedMatch.getWinnerId());
        } else {
            nextMatch.setTeam2Id(completedMatch.getWinnerId());
        }
        tournamentMatchRepository.save(nextMatch);
    }

    // ========== Double Elimination ==========

    private void generateDoubleElimBracket(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<TournamentTeam> registeredTeams = tournamentTeamRepository.findByTournamentId(tournamentId);
        int totalTeams = registeredTeams.size();

        int[] seedOrder = getSeedOrder(totalTeams);
        List<Long> seededTeamIds = new ArrayList<>();
        for (int seed : seedOrder) {
            if (seed <= registeredTeams.size()) {
                TournamentTeam tt = registeredTeams.get(seed - 1);
                seededTeamIds.add(tt.getTeamId());
            }
        }

        generateDoubleElimBracketInternal(tournamentId, totalTeams, seededTeamIds);
    }

    private void generateDoubleElimBracketInternal(Long tournamentId, int totalTeams, List<Long> seededTeamIds) {
        if (totalTeams == 4) {
            // WB R0 (2 matches): seed1v4, seed2v3
            saveMatch(tournamentId, "WINNERS", 0, 0, seededTeamIds.get(0), seededTeamIds.get(3));
            saveMatch(tournamentId, "WINNERS", 0, 1, seededTeamIds.get(1), seededTeamIds.get(2));
            // WB R1 (1 match): winners of WB R0
            saveMatch(tournamentId, "WINNERS", 1, 0, null, null);
            // LB R0 (1 match): losers of WB R0
            saveMatch(tournamentId, "LOSERS", 0, 0, null, null);
            // LB R1 (1 match): winner of LB R0 vs loser of WB R1
            saveMatch(tournamentId, "LOSERS", 1, 0, null, null);
            // GF (1 match): winner of WB R1 vs winner of LB R1
            saveMatch(tournamentId, "GRAND_FINAL", 0, 0, null, null);
        } else if (totalTeams == 8) {
            // WB R0 (4 matches): 1v8, 4v5, 2v7, 3v6
            saveMatch(tournamentId, "WINNERS", 0, 0, seededTeamIds.get(0), seededTeamIds.get(7));
            saveMatch(tournamentId, "WINNERS", 0, 1, seededTeamIds.get(3), seededTeamIds.get(4));
            saveMatch(tournamentId, "WINNERS", 0, 2, seededTeamIds.get(1), seededTeamIds.get(6));
            saveMatch(tournamentId, "WINNERS", 0, 3, seededTeamIds.get(2), seededTeamIds.get(5));
            // WB R1 (2 matches)
            saveMatch(tournamentId, "WINNERS", 1, 0, null, null);
            saveMatch(tournamentId, "WINNERS", 1, 1, null, null);
            // WB R2 (1 match, WB final)
            saveMatch(tournamentId, "WINNERS", 2, 0, null, null);
            // LB R0 (2 matches): loser(WB0/0)vs(WB0/1), loser(WB0/2)vs(WB0/3)
            saveMatch(tournamentId, "LOSERS", 0, 0, null, null);
            saveMatch(tournamentId, "LOSERS", 0, 1, null, null);
            // LB R1 (2 matches): winner(LB0) vs loser(WB1)
            saveMatch(tournamentId, "LOSERS", 1, 0, null, null);
            saveMatch(tournamentId, "LOSERS", 1, 1, null, null);
            // LB R2 (1 match): winner(LB1/0) vs winner(LB1/1)
            saveMatch(tournamentId, "LOSERS", 2, 0, null, null);
            // LB R3 (1 match): winner(LB2) vs loser(WB2)
            saveMatch(tournamentId, "LOSERS", 3, 0, null, null);
            // GF (1 match)
            saveMatch(tournamentId, "GRAND_FINAL", 0, 0, null, null);
        }
    }

    private void handleDoubleElimMatchResult(Tournament tournament, TournamentMatch match) {
        Long tournamentId = tournament.getId();
        String stage = match.getStage();
        int round = match.getRound();
        int pos = match.getPosition();
        Long winnerId = match.getWinnerId();
        Long loserId = match.getTeam1Id().equals(winnerId) ? match.getTeam2Id() : match.getTeam1Id();

        if ("WINNERS".equals(stage)) {
            // 胜者组轮次按实际生成的 WINNERS 对阵计算（兼容 CUP 双败与联赛季后赛）
            int totalWBRounds = tournamentMatchRepository
                    .findByTournamentIdAndStageOrderByRoundAscPositionAsc(tournamentId, "WINNERS")
                    .stream().mapToInt(TournamentMatch::getRound).max().orElse(0) + 1;
            boolean isWBFinal = (round == totalWBRounds - 1);

            if (isWBFinal) {
                // Winner → GF team1, Loser → LB final (last LB round) as team2
                fillMatchSlot(tournamentId, "GRAND_FINAL", 0, 0, true, winnerId);
                int lastLBRound = getLastLBRound(tournamentId);
                fillMatchSlot(tournamentId, "LOSERS", lastLBRound, 0, false, loserId);
            } else {
                // Advance winner in WB
                int nextPos = pos / 2;
                boolean isFirstTeam = pos % 2 == 0;
                fillMatchSlot(tournamentId, "WINNERS", round + 1, nextPos, isFirstTeam, winnerId);

                // Drop loser to LB
                int lbRound = round;
                int lbPos;
                boolean isFirstTeamInLB;
                if (round == 0) {
                    // WB R0 -> LB R0: pair adjacent positions (half the WB R0 matches)
                    lbPos = pos / 2;
                    isFirstTeamInLB = pos % 2 == 0;
                } else {
                    // WB R1+ -> LB R1+: cross to other half, always team2
                    lbPos = 1 - pos;
                    isFirstTeamInLB = false;
                }
                fillMatchSlot(tournamentId, "LOSERS", lbRound, lbPos, isFirstTeamInLB, loserId);
            }
        } else if ("LOSERS".equals(stage)) {
            int totalLBRounds = getLastLBRound(tournamentId) + 1;
            boolean isLBFinal = (round == totalLBRounds - 1);

            if (isLBFinal) {
                // Winner → GF team2
                fillMatchSlot(tournamentId, "GRAND_FINAL", 0, 0, false, winnerId);
            } else {
                // Determine next LB round & position
                int nextRound = round + 1;

                // Count matches in current and next round to determine mapping
                long currMatchCount = tournamentMatchRepository
                    .findByTournamentIdAndStageAndRound(tournamentId, stage, round).size();
                long nextMatchCount = tournamentMatchRepository
                    .findByTournamentIdAndStageAndRound(tournamentId, stage, nextRound).size();

                if (nextMatchCount == currMatchCount) {
                    // Same number of matches -> 1:1 mapping (pos stays same, always team1)
                    fillMatchSlot(tournamentId, "LOSERS", nextRound, pos, true, winnerId);
                } else {
                    // Fewer matches -> merge (pos/2, team1 for even, team2 for odd)
                    fillMatchSlot(tournamentId, "LOSERS", nextRound, pos / 2, pos % 2 == 0, winnerId);
                }
            }
        } else if ("GRAND_FINAL".equals(stage)) {
            tournament.setChampionTeamId(winnerId);
            tournament.setStatus("ENDED");
            tournamentRepository.save(tournament);
        }
    }


    /**
     * Called by MatchService after a match winner is determined via game recording.
     * Triggers bracket progression logic (single elim / double elim).
     */
    @Transactional
    public void processCompletedMatch(Tournament tournament, TournamentMatch match) {
        if ("SINGLE_RR".equals(tournament.getFormat()) || "DOUBLE_RR".equals(tournament.getFormat())) {
            handleLeaguePlayoffResult(tournament, match);
        } else if ("DOUBLE_ELIM".equals(tournament.getFormat())) {
            handleDoubleElimMatchResult(tournament, match);
        } else if ("SINGLE_ELIM".equals(tournament.getFormat())) {
            handleSingleElimMatchResult(tournament, match);
        }
    }

    // ========== League (Round Robin) ==========

    @Transactional
    public void initLeague(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<TournamentTeam> registered = tournamentTeamRepository.findByTournamentId(tournamentId);

        for (TournamentTeam tt : registered) {
            leagueStandingRepository.save(LeagueStanding.builder()
                    .tournamentId(tournamentId)
                    .teamId(tt.getTeamId())
                    .wins(0).losses(0).roundDiff(0)
                    .build());
        }

        List<Long> teamIds = registered.stream()
                .map(TournamentTeam::getTeamId)
                .collect(Collectors.toList());
        boolean doubleRR = "DOUBLE_RR".equals(tournament.getFormat());
        List<RoundRobinEngine.Pair> pairs = RoundRobinEngine.generate(teamIds, doubleRR);
        for (RoundRobinEngine.Pair p : pairs) {
            if (p.team1 == null || p.team2 == null) {
                continue; // 轮空
            }
            tournamentMatchRepository.save(TournamentMatch.builder()
                    .tournamentId(tournamentId)
                    .stage("REGULAR")
                    .round(p.round)
                    .position(p.position)
                    .team1Id(p.team1)
                    .team2Id(p.team2)
                    .status("PENDING")
                    .build());
        }

        tournament.setCurrentStage(0);
        tournamentRepository.save(tournament);
    }

    @Transactional
    public void completeRegularMatch(Tournament tournament, TournamentMatch match) {
        Long tournamentId = tournament.getId();
        Long winnerId = match.getWinnerId();
        Long loserId = match.getTeam1Id().equals(winnerId) ? match.getTeam2Id() : match.getTeam1Id();

        // 净胜局：按小局实际比分累计（胜者 +diff，负者 -diff）
        int winnerGames = 0;
        int loserGames = 0;
        for (GameRecord g : gameRecordRepository.findByMatchIdOrderByGameNumberAsc(match.getId())) {
            if (!"COMPLETED".equals(g.getStatus()) || g.getTeam1Score() == null || g.getTeam2Score() == null) {
                continue;
            }
            if (g.getTeam1Score() > g.getTeam2Score()) {
                if (match.getTeam1Id().equals(winnerId)) {
                    winnerGames++;
                } else {
                    loserGames++;
                }
            } else if (g.getTeam2Score() > g.getTeam1Score()) {
                if (match.getTeam2Id().equals(winnerId)) {
                    winnerGames++;
                } else {
                    loserGames++;
                }
            }
        }
        int diff = winnerGames - loserGames;

        LeagueStanding ws = leagueStandingRepository.findByTournamentIdAndTeamId(tournamentId, winnerId)
                .orElseThrow(() -> new IllegalArgumentException("联赛积分记录不存在"));
        ws.setWins(ws.getWins() + 1);
        ws.setRoundDiff(ws.getRoundDiff() + diff);
        leagueStandingRepository.save(ws);

        LeagueStanding ls = leagueStandingRepository.findByTournamentIdAndTeamId(tournamentId, loserId)
                .orElseThrow(() -> new IllegalArgumentException("联赛积分记录不存在"));
        ls.setLosses(ls.getLosses() + 1);
        ls.setRoundDiff(ls.getRoundDiff() - diff);
        leagueStandingRepository.save(ls);

        List<TournamentMatch> regular = tournamentMatchRepository
                .findByTournamentIdAndStageOrderByRoundAscPositionAsc(tournamentId, "REGULAR");
        boolean allDone = regular.stream().allMatch(m -> "COMPLETED".equals(m.getStatus()));
        if (!allDone) {
            return;
        }

        if (Boolean.TRUE.equals(tournament.getHasPlayoffs())) {
            generatePlayoffs(tournament);
        } else {
            List<LeagueStanding> standings = leagueStandingRepository
                    .findByTournamentIdOrderByWinsDescRoundDiffDesc(tournamentId);
            if (!standings.isEmpty()) {
                tournament.setChampionTeamId(standings.get(0).getTeamId());
                tournament.setStatus("ENDED");
                tournamentRepository.save(tournament);
            }
        }
    }

    private void generatePlayoffs(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<LeagueStanding> standings = leagueStandingRepository
                .findByTournamentIdOrderByWinsDescRoundDiffDesc(tournamentId);

        // 实际参赛队伍可能少于配置的季后赛规模：自动缩小到可容纳的最大 2 的幂
        int size = tournament.getPlayoffSize() != null ? tournament.getPlayoffSize() : 8;
        while (size > standings.size()) {
            size /= 2;
        }
        if (size < 2) {
            size = 2;
        }
        String format = tournament.getPlayoffFormat() != null ? tournament.getPlayoffFormat() : "SINGLE_ELIM";
        if ("DOUBLE_ELIM".equals(format) && size < 4) {
            // 双败至少需要 4 队，不足时退回单败
            format = "SINGLE_ELIM";
        }
        tournament.setPlayoffSize(size);
        tournament.setPlayoffFormat(format);

        List<Long> seeded = standings.stream()
                .limit(size)
                .map(LeagueStanding::getTeamId)
                .collect(Collectors.toList());

        if ("DOUBLE_ELIM".equals(format)) {
            generateDoubleElimBracketInternal(tournamentId, size, seeded);
        } else {
            int matchesInFirstRound = size / 2;
            for (int pos = 0; pos < matchesInFirstRound; pos++) {
                saveMatch(tournamentId, "WINNERS", 0, pos,
                        seeded.get(pos), seeded.get(size - 1 - pos));
            }
            for (int r = 1; r < getTotalRounds(size); r++) {
                int matchesInRound = size / (int) Math.pow(2, r + 1);
                for (int pos = 0; pos < matchesInRound; pos++) {
                    saveMatch(tournamentId, "WINNERS", r, pos, null, null);
                }
            }
        }

        tournament.setCurrentStage(1);
        tournamentRepository.save(tournament);
    }

    public List<LeagueStanding> getLeagueStandings(Long tournamentId) {
        return leagueStandingRepository.findByTournamentIdOrderByWinsDescRoundDiffDesc(tournamentId);
    }

    /**
     * 联赛季后赛完赛处理。
     * 常规赛对阵由 completeRegularMatch 处理，此处只处理季后赛阶段
     * （WINNERS / LOSERS / GRAND_FINAL）。
     */
    private void handleLeaguePlayoffResult(Tournament tournament, TournamentMatch match) {
        if ("DOUBLE_ELIM".equals(tournament.getPlayoffFormat())) {
            handleDoubleElimMatchResult(tournament, match);
        } else {
            handleLeagueSingleElimPlayoffResult(tournament, match);
        }
    }

    /**
     * 联赛季后赛（单败）推进。
     * 与 CUP 单败不同：赛事中混有 REGULAR 常规赛对阵，
     * 必须只按 WINNERS 阶段计算轮次并晋级，不能沿用全量对阵的查找。
     */
    private void handleLeagueSingleElimPlayoffResult(Tournament tournament, TournamentMatch match) {
        List<TournamentMatch> playoffMatches = tournamentMatchRepository
                .findByTournamentIdAndStageOrderByRoundAscPositionAsc(tournament.getId(), "WINNERS");
        int maxRound = playoffMatches.stream().mapToInt(TournamentMatch::getRound).max().orElse(0);

        if (match.getRound() == maxRound) {
            tournament.setChampionTeamId(match.getWinnerId());
            tournament.setStatus("ENDED");
            tournamentRepository.save(tournament);
        } else {
            int nextRound = match.getRound() + 1;
            int nextPos = match.getPosition() / 2;
            boolean isFirstTeam = match.getPosition() % 2 == 0;
            fillMatchSlot(tournament.getId(), "WINNERS", nextRound, nextPos, isFirstTeam, match.getWinnerId());
        }
    }

    private void fillMatchSlot(Long tournamentId, String stage, int round, int pos, boolean isTeam1, Long teamId) {
        List<TournamentMatch> matches = tournamentMatchRepository.findByTournamentIdAndStageAndRound(tournamentId, stage, round);
        TournamentMatch target = matches.stream()
                .filter(m -> m.getPosition().equals(pos))
                .findFirst()
                .orElse(null);
        if (target == null) return;
        if (isTeam1) {
            target.setTeam1Id(teamId);
        } else {
            target.setTeam2Id(teamId);
        }
        tournamentMatchRepository.save(target);
    }

    private int getLastLBRound(Long tournamentId) {
        List<TournamentMatch> lbMatches = tournamentMatchRepository.findByTournamentIdAndStageOrderByRoundAscPositionAsc(tournamentId, "LOSERS");
        return lbMatches.stream().mapToInt(TournamentMatch::getRound).max().orElse(0);
    }

    private void saveMatch(Long tournamentId, String stage, int round, int position, Long team1Id, Long team2Id) {
        tournamentMatchRepository.save(TournamentMatch.builder()
                .tournamentId(tournamentId)
                .stage(stage)
                .round(round)
                .position(position)
                .team1Id(team1Id)
                .team2Id(team2Id)
                .status("PENDING")
                .build());
    }

    // ========== Common ==========

    public List<TournamentVO> listAll() {
        return tournamentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public TournamentVO getById(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        return toVODetail(tournament);
    }

    public List<Map<String, Object>> getPlayerStats(Long tournamentId) {
        getTournament(tournamentId);

        List<TournamentMatch> matches = tournamentMatchRepository.findByTournamentIdOrderByRoundAscPositionAsc(tournamentId);
        if (matches.isEmpty()) {
            return new ArrayList<>();
        }

        List<Long> matchIds = matches.stream().map(TournamentMatch::getId).collect(Collectors.toList());
        List<GameRecord> games = gameRecordRepository.findByMatchIdIn(matchIds);
        if (games.isEmpty()) {
            return new ArrayList<>();
        }

        Map<Long, GameRecord> gameMap = games.stream()
                .collect(Collectors.toMap(GameRecord::getId, g -> g, (a, b) -> a));
        List<Long> gameIds = games.stream().map(GameRecord::getId).collect(Collectors.toList());
        List<PlayerGameStat> stats = playerGameStatRepository.findByGameIdIn(gameIds);

        Map<Long, double[]> acc = new HashMap<>();
        Map<Long, Map<String, Object>> info = new LinkedHashMap<>();

        for (PlayerGameStat stat : stats) {
            if (stat.getUserId() == null) {
                continue;
            }
            Long userId = stat.getUserId();
            info.computeIfAbsent(userId, k -> {
                User account = userRepository.findById(userId).orElse(null);
                String playerName = account != null && account.getUsername() != null && !account.getUsername().isBlank()
                        ? account.getUsername()
                        : account != null ? account.getDisplayGameId() : stat.getPlayerName();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("userId", userId);
                m.put("playerName", playerName);
                m.put("gameId", account != null ? account.getDisplayGameId() : null);
                m.put("teamId", stat.getTeamId());
                m.put("teamName", stat.getTeamId() != null
                        ? teamRepository.findById(stat.getTeamId()).map(Team::getName).orElse(null)
                        : null);
                return m;
            });

            double[] a = acc.computeIfAbsent(userId, k -> new double[7]);
            Map<String, Object> s = stat.getStats();
            a[0]++; // games
            a[1] += ((Number) s.getOrDefault("acs", 0)).doubleValue();
            a[2] += ((Number) s.getOrDefault("kills", 0)).doubleValue();
            a[3] += ((Number) s.getOrDefault("deaths", 0)).doubleValue();
            a[4] += ((Number) s.getOrDefault("assists", 0)).doubleValue();
            a[5] += ((Number) s.getOrDefault("firstBlood", 0)).doubleValue();

            GameRecord game = gameMap.get(stat.getGameId());
            if (game != null && game.getTeam1Score() != null && game.getTeam2Score() != null) {
                a[6] += game.getTeam1Score() + game.getTeam2Score();
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Long, double[]> entry : acc.entrySet()) {
            double[] a = entry.getValue();
            double gameCount = a[0];
            double rounds = a[6];
            double kills = a[2];
            double deaths = a[3];
            double assists = a[4];
            double firstBloods = a[5];
            double survivalRate = rounds > 0 ? 1 - deaths / rounds : 0;
            survivalRate = Math.max(0, Math.min(1, survivalRate));

            Map<String, Object> row = info.get(entry.getKey());
            row.put("games", (int) gameCount);
            row.put("rounds", (long) rounds);
            row.put("acs", gameCount > 0 ? Math.round(a[1] / gameCount * 100) / 100.0 : 0);
            row.put("kd", deaths > 0 ? Math.round(kills / deaths * 100) / 100.0 : Math.round(kills * 100) / 100.0);
            row.put("kpr", rounds > 0 ? Math.round(kills / rounds * 100) / 100.0 : 0);
            row.put("firstBloodRate", rounds > 0 ? Math.round(firstBloods / rounds * 100) / 100.0 : 0);
            row.put("survivalRate", Math.round(survivalRate * 100) / 100.0);
            row.put("assistsPerRound", rounds > 0 ? Math.round(assists / rounds * 100) / 100.0 : 0);
            result.add(row);
        }

        result.sort(Comparator
                .comparingDouble((Map<String, Object> p) -> ((Number) p.get("acs")).doubleValue())
                .thenComparingDouble(p -> ((Number) p.get("kd")).doubleValue())
                .thenComparingDouble(p -> ((Number) p.get("kpr")).doubleValue())
                .thenComparingDouble(p -> ((Number) p.get("firstBloodRate")).doubleValue())
                .thenComparingDouble(p -> ((Number) p.get("survivalRate")).doubleValue())
                .thenComparingDouble(p -> ((Number) p.get("assistsPerRound")).doubleValue())
                .reversed());

        return result;
    }

    @Transactional
    public void registerTeam(Long tournamentId, Long teamId, Long userId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在报名阶段");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (!team.getCaptainId().equals(userId)) {
            throw new IllegalArgumentException("只有队长可以报名参赛");
        }

        long count = tournamentTeamRepository.countByTournamentId(tournamentId);
        if (count >= tournament.getMaxTeams()) {
            throw new IllegalArgumentException("报名已满");
        }

        if (tournamentTeamRepository.existsByTournamentIdAndTeamId(tournamentId, teamId)) {
            throw new IllegalArgumentException("该战队已报名");
        }

        int seed = (int) count + 1;
        TournamentTeam tt = TournamentTeam.builder()
                .tournamentId(tournamentId)
                .teamId(teamId)
                .seed(seed)
                .build();
        tournamentTeamRepository.save(tt);
    }

    @Transactional
    public void registerTeamByAdmin(Long tournamentId, Long teamId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus()) && !"SETUP".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("当前状态不允许添加队伍");
        }

        long count = tournamentTeamRepository.countByTournamentId(tournamentId);
        if (count >= tournament.getMaxTeams()) {
            throw new IllegalArgumentException("参赛队伍已满");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (tournamentTeamRepository.findByTournamentIdAndTeamId(tournamentId, teamId).isPresent()) {
            throw new IllegalArgumentException("该战队已报名");
        }

        int seed = (int) count + 1;
        TournamentTeam tt = TournamentTeam.builder()
                .tournamentId(tournamentId)
                .teamId(teamId)
                .seed(seed)
                .build();
        tournamentTeamRepository.save(tt);
    }
    @Transactional
    public void unregisterTeamByAdmin(Long tournamentId, Long teamId) {
        TournamentTeam tt = tournamentTeamRepository.findByTournamentIdAndTeamId(tournamentId, teamId)
                .orElseThrow(() -> new IllegalArgumentException("该战队未报名"));
        tournamentTeamRepository.delete(tt);
    }

    @Transactional
    public void batchRegisterTeamByAdmin(Long tournamentId, List<Long> teamIds) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus()) && !"SETUP".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("当前状态不允许添加队伍");
        }

        long count = tournamentTeamRepository.countByTournamentId(tournamentId);
        if (count + teamIds.size() > tournament.getMaxTeams()) {
            throw new IllegalArgumentException("参赛队伍名额不足，剩余 " + (tournament.getMaxTeams() - count) + " 个");
        }

        int seed = (int) count + 1;
        for (Long teamId : teamIds) {
            Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new IllegalArgumentException("战队不存在: " + teamId));
            if (tournamentTeamRepository.findByTournamentIdAndTeamId(tournamentId, teamId).isPresent()) {
                continue;
            }
            TournamentTeam tt = TournamentTeam.builder()
                    .tournamentId(tournamentId)
                    .teamId(teamId)
                    .seed(seed++)
                    .build();
            tournamentTeamRepository.save(tt);
        }
    }


    public void unregisterTeam(Long tournamentId, Long teamId, Long userId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在报名阶段");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));

        if (!team.getCaptainId().equals(userId)) {
            throw new IllegalArgumentException("只有队长可以取消报名");
        }

        TournamentTeam tt = tournamentTeamRepository.findByTournamentIdAndTeamId(tournamentId, teamId)
                .orElseThrow(() -> new IllegalArgumentException("该战队未报名"));
        tournamentTeamRepository.delete(tt);
    }

    @Transactional
    public void deleteTournament(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        List<TournamentMatch> matches = tournamentMatchRepository
                .findByTournamentIdOrderByRoundAscPositionAsc(tournamentId);
        for (TournamentMatch m : matches) {
            List<GameRecord> games = gameRecordRepository.findByMatchIdOrderByGameNumberAsc(m.getId());
            for (GameRecord g : games) {
                playerGameStatRepository.deleteByGameId(g.getId());
                deleteScreenshotFile(g);
                gameRecordRepository.delete(g);
            }
            tournamentMatchRepository.delete(m);
        }
        swissStandingRepository.findByTournamentId(tournamentId)
                .forEach(swissStandingRepository::delete);
        leagueStandingRepository.findByTournamentId(tournamentId)
                .forEach(leagueStandingRepository::delete);
        tournamentTeamRepository.findByTournamentId(tournamentId)
                .forEach(tournamentTeamRepository::delete);
        tournamentRepository.delete(tournament);
    }

    private void deleteScreenshotFile(GameRecord game) {
        try {
            Path filePath = Paths.get(uploadDir, String.valueOf(game.getMatchId()),
                    "game_" + game.getId() + ".png");
            Files.deleteIfExists(filePath);
        } catch (IOException ignored) {
            // 文件删除失败不影响数据删除
        }
    }

    private int getTotalRounds(int totalTeams) {
        return (int) (Math.log(totalTeams) / Math.log(2));
    }

    private int[] getSeedOrder(int totalTeams) {
        int[] order = new int[totalTeams];
        int left = 0, right = totalTeams - 1;
        int seed = 1;
        while (left <= right) {
            order[left++] = seed++;
            if (left <= right) {
                order[right--] = seed++;
            }
        }
        return order;
    }


    // ========== Swiss System ==========

    @Transactional
    public void initSwissBracket(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<TournamentTeam> registered = tournamentTeamRepository.findByTournamentId(tournamentId);

        // Create SwissStanding records
        for (TournamentTeam tt : registered) {
            SwissStanding s = SwissStanding.builder()
                    .tournamentId(tournamentId)
                    .teamId(tt.getTeamId())
                    .wins(0).losses(0).buchholz(0.0).roundDiff(0)
                    .opponentIds("[]")
                    .build();
            swissStandingRepository.save(s);
        }

        // Generate seed for random engine
        if (tournament.getSwissSeed() == null) {
            tournament.setSwissSeed(System.currentTimeMillis());
        }
        tournament.setCurrentSwissRound(0);
        tournament.setCurrentStage(0);
        tournamentRepository.save(tournament);

        // Generate round 1 pairings
        generateNextSwissRound(tournament);
    }

    @Transactional
    public void completeSwissMatch(Tournament tournament, TournamentMatch match) {
        Long tournamentId = tournament.getId();
        Long winnerId = match.getWinnerId();
        Long loserId = match.getTeam1Id().equals(winnerId) ? match.getTeam2Id() : match.getTeam1Id();

        // Update standings
        SwissStanding ws = swissStandingRepository.findByTournamentIdAndTeamId(tournamentId, winnerId)
                .orElseThrow(() -> new IllegalArgumentException("Standing not found for winner"));
        ws.setWins(ws.getWins() + 1);
        ws.setRoundDiff(ws.getRoundDiff() + (match.getGamesPerMatch() != null ? match.getGamesPerMatch() : 1));
        ws.setOpponentIds(SwissPairingEngine.appendOpponent(ws.getOpponentIds(), loserId));
        swissStandingRepository.save(ws);

        SwissStanding ls = swissStandingRepository.findByTournamentIdAndTeamId(tournamentId, loserId)
                .orElseThrow(() -> new IllegalArgumentException("Standing not found for loser"));
        ls.setLosses(ls.getLosses() + 1);
        ls.setRoundDiff(ls.getRoundDiff() - (match.getGamesPerMatch() != null ? match.getGamesPerMatch() : 1));
        ls.setOpponentIds(SwissPairingEngine.appendOpponent(ls.getOpponentIds(), winnerId));
        swissStandingRepository.save(ls);

        // Recalculate buchholz for all teams
        recalculateBuchholz(tournamentId);

        // Check if this round is complete
        long round = match.getRound();
        long totalInRound = tournamentMatchRepository.findByTournamentIdAndStageAndRound(tournamentId, "SWISS", (int) round).size();
        long completedInRound = tournamentMatchRepository.findByTournamentIdAndStageAndRound(tournamentId, "SWISS", (int) round)
                .stream().filter(m -> "COMPLETED".equals(m.getStatus())).count();

        if (totalInRound == completedInRound) {
            // Round complete
            int swissRounds = tournament.getSwissRounds() != null ? tournament.getSwissRounds() : 5;
            int currentRound = tournament.getCurrentSwissRound() != null ? tournament.getCurrentSwissRound() : 0;
            tournament.setCurrentSwissRound(currentRound + 1);
            tournamentRepository.save(tournament);

            if (currentRound + 1 >= swissRounds) {
                // All Swiss rounds done, transition to knockout
                generateKnockoutBracket(tournament);
            } else {
                // Generate next round
                generateNextSwissRound(tournament);
            }
        }
    }

    @Transactional
    public void generateNextSwissRound(Tournament tournament) {
        Long tournamentId = tournament.getId();
        int nextRound = (tournament.getCurrentSwissRound() != null ? tournament.getCurrentSwissRound() : 0) + 1;

        List<SwissStanding> standings = swissStandingRepository
                .findByTournamentIdOrderByWinsDescBuchholzDesc(tournamentId);

        List<SwissPairingEngine.TeamPair> pairs = SwissPairingEngine.generatePairings(
                standings, nextRound,
                tournament.getSwissSeed() != null ? tournament.getSwissSeed() : System.currentTimeMillis(),
                tournament.getSwissPairingMode() != null ? tournament.getSwissPairingMode() : "RANDOM");

        for (int pos = 0; pos < pairs.size(); pos++) {
            SwissPairingEngine.TeamPair pair = pairs.get(pos);
            TournamentMatch m = TournamentMatch.builder()
                    .tournamentId(tournamentId)
                    .stage("SWISS")
                    .round(nextRound)
                    .position(pos)
                    .team1Id(pair.getTeam1Id())
                    .team2Id(pair.getTeam2Id())
                    .status("PENDING")
                    .build();
            tournamentMatchRepository.save(m);
        }
    }

    @Transactional
    public void generateKnockoutBracket(Tournament tournament) {
        Long tournamentId = tournament.getId();
        List<SwissStanding> top8 = swissStandingRepository
                .findByTournamentIdOrderByWinsDescBuchholzDesc(tournamentId)
                .stream().limit(8).collect(java.util.stream.Collectors.toList());

        String knockoutFormat = tournament.getKnockoutFormat() != null ? tournament.getKnockoutFormat() : "SINGLE_ELIM";
        List<SwissPairingEngine.TeamPair> pairs;

        if ("RANDOM".equals(tournament.getSwissPairingMode())) {
            pairs = SwissPairingEngine.generateKnockoutPairings(
                    top8, tournament.getSwissSeed() != null ? tournament.getSwissSeed() : System.currentTimeMillis(),
                    knockoutFormat);
        } else {
            // Buchholz mode: standard seeding
            pairs = new java.util.ArrayList<>();
            for (int i = 0; i < 4; i++) {
                pairs.add(new SwissPairingEngine.TeamPair(
                        top8.get(i).getTeamId(), top8.get(7 - i).getTeamId()));
            }
        }

        if ("DOUBLE_ELIM".equals(knockoutFormat)) {
            // Create seed order from pairs
            java.util.List<Long> seeded = new java.util.ArrayList<>();
            for (SwissPairingEngine.TeamPair p : pairs) {
                seeded.add(p.getTeam1Id());
                seeded.add(p.getTeam2Id());
            }
            generateDoubleElimBracketInternal(tournamentId, 8, seeded);
        } else {
            // Single elimination: round 0 = quarter finals
            for (int pos = 0; pos < pairs.size(); pos++) {
                SwissPairingEngine.TeamPair pair = pairs.get(pos);
                TournamentMatch m = TournamentMatch.builder()
                        .tournamentId(tournamentId)
                        .stage("WINNERS")
                        .round(0)
                        .position(pos)
                        .team1Id(pair.getTeam1Id())
                        .team2Id(pair.getTeam2Id())
                        .status("PENDING")
                        .build();
                tournamentMatchRepository.save(m);
            }
            // Generate remaining rounds (semi, final)
            for (int r = 1; r < 3; r++) {
                int matchesInRound = 4 / (int) Math.pow(2, r);
                for (int pos = 0; pos < matchesInRound; pos++) {
                    tournamentMatchRepository.save(TournamentMatch.builder()
                            .tournamentId(tournamentId).stage("WINNERS").round(r).position(pos)
                            .status("PENDING").build());
                }
            }
        }

        tournament.setCurrentStage(1);
        tournamentRepository.save(tournament);
    }

    private void recalculateBuchholz(Long tournamentId) {
        List<SwissStanding> all = swissStandingRepository.findByTournamentId(tournamentId);
        for (SwissStanding s : all) {
            List<Long> opponentIds = SwissPairingEngine.parseOpponentIds(s.getOpponentIds());
            double buchholz = 0;
            for (Long oppId : opponentIds) {
                SwissStanding opp = all.stream().filter(o -> o.getTeamId().equals(oppId)).findFirst().orElse(null);
                if (opp != null) buchholz += opp.getWins();
            }
            s.setBuchholz(buchholz);
            swissStandingRepository.save(s);
        }
    }

    public List<SwissStanding> getSwissStandings(Long tournamentId) {
        return swissStandingRepository.findByTournamentIdOrderByWinsDescBuchholzDesc(tournamentId);
    }

    public Tournament getTournament(Long id) {
        return tournamentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("赛事不存在"));
    }

    private TournamentVO toVO(Tournament t) {
        long registeredCount = tournamentTeamRepository.countByTournamentId(t.getId());
        String championName = null;
        if (t.getChampionTeamId() != null) {
            Team team = teamRepository.findById(t.getChampionTeamId()).orElse(null);
            championName = team != null ? team.getName() : null;
        }

        return TournamentVO.builder()
                .id(t.getId())
                .name(t.getName())
                .description(t.getDescription())
                .status(t.getStatus())
                .maxTeams(t.getMaxTeams())
                .bracketType(t.getBracketType())
                .type(t.getType())
                .format(t.getFormat())
                .currentStage(t.getCurrentStage())
                .swissRounds(t.getSwissRounds())
                .knockoutFormat(t.getKnockoutFormat())
                .swissPairingMode(t.getSwissPairingMode())
                .currentSwissRound(t.getCurrentSwissRound())
                .hasPlayoffs(t.getHasPlayoffs())
                .playoffFormat(t.getPlayoffFormat())
                .playoffSize(t.getPlayoffSize())
                .registeredCount((int) registeredCount)
                .championTeamId(t.getChampionTeamId())
                .championTeamName(championName)
                .createdAt(t.getCreatedAt())
                .build();
    }

    private TournamentVO toVODetail(Tournament t) {
        TournamentVO vo = toVO(t);

        List<TournamentTeam> registered = tournamentTeamRepository.findByTournamentId(t.getId());
        List<TournamentVO.RegisteredTeamInfo> teamInfos = registered.stream().map(tt -> {
            Team team = teamRepository.findById(tt.getTeamId()).orElse(null);
            return TournamentVO.RegisteredTeamInfo.builder()
                    .id(tt.getId())
                    .teamId(tt.getTeamId())
                    .teamName(team != null ? team.getName() : "未知战队")
                    .teamLogo(team != null ? team.getLogo() : null)
                    .captainName(team != null && team.getCaptainId() != null ?
                        userRepository.findById(team.getCaptainId()).map(u -> u.getUsername()).orElse(null) : null)
                    .description(team != null ? team.getDescription() : null)
                    .memberCount(team != null ? (int) teamMemberRepository.countByTeamId(team.getId()) : 0)
                    .seed(tt.getSeed())
                    .registeredAt(tt.getRegisteredAt())
                    .build();
        }).collect(Collectors.toList());
        vo.setRegisteredTeams(teamInfos);

        List<TournamentMatch> matches = tournamentMatchRepository.findByTournamentIdOrderByRoundAscPositionAsc(t.getId());
        List<TournamentVO.MatchVO> matchVOs = matches.stream().map(m -> {
            String t1Name = null, t2Name = null;
            if (m.getTeam1Id() != null) {
                Team t1 = teamRepository.findById(m.getTeam1Id()).orElse(null);
                t1Name = t1 != null ? t1.getName() : null;
            }
            if (m.getTeam2Id() != null) {
                Team t2 = teamRepository.findById(m.getTeam2Id()).orElse(null);
                t2Name = t2 != null ? t2.getName() : null;
            }
            return TournamentVO.MatchVO.builder()
                    .id(m.getId())
                    .stage(m.getStage())
                    .round(m.getRound())
                    .position(m.getPosition())
                    .team1Id(m.getTeam1Id())
                    .team1Name(t1Name)
                    .team2Id(m.getTeam2Id())
                    .team2Name(t2Name)
                    .winnerId(m.getWinnerId())
                    .status(m.getStatus())
                    .gamesPerMatch(m.getGamesPerMatch())
                    .build();
        }).collect(Collectors.toList());
        vo.setMatches(matchVOs);

        List<LeagueStanding> standings = leagueStandingRepository
                .findByTournamentIdOrderByWinsDescRoundDiffDesc(t.getId());
        List<TournamentVO.LeagueStandingVO> standingVOs = standings.stream().map(s -> {
            Team team = teamRepository.findById(s.getTeamId()).orElse(null);
            return TournamentVO.LeagueStandingVO.builder()
                    .teamId(s.getTeamId())
                    .teamName(team != null ? team.getName() : "未知战队")
                    .wins(s.getWins())
                    .losses(s.getLosses())
                    .roundDiff(s.getRoundDiff())
                    .build();
        }).collect(Collectors.toList());
        vo.setLeagueStandings(standingVOs);

        return vo;
    }
}
