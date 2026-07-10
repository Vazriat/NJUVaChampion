package com.NJUChampion.Valorant.service;

import com.NJUChampion.Valorant.dto.CreateTournamentRequest;
import com.NJUChampion.Valorant.dto.SetMatchWinnerRequest;
import com.NJUChampion.Valorant.dto.TournamentVO;
import com.NJUChampion.Valorant.entity.*;
import com.NJUChampion.Valorant.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
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

    @Transactional
    public TournamentVO create(CreateTournamentRequest req) {
        int maxTeams = req.getMaxTeams() != null ? req.getMaxTeams() : 2;
        Tournament tournament = Tournament.builder()
                .name(req.getName())
                .description(req.getDescription())
                .status("SETUP")
                .maxTeams(maxTeams)
                .bracketType("SINGLE_ELIMINATION")
                .build();
        tournament = tournamentRepository.save(tournament);
        return toVO(tournament);
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

        generateBracket(tournament);

        tournament.setStatus("PROGRESSION");
        tournament = tournamentRepository.save(tournament);
        return toVO(tournament);
    }

    @Transactional
    public TournamentVO setMatchWinner(Long tournamentId, Long matchId, SetMatchWinnerRequest req) {
        Tournament tournament = getTournament(tournamentId);
        if (!"PROGRESSION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事未在进行中");
        }

        TournamentMatch match = tournamentMatchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("比赛不存在"));
        if (!match.getTournamentId().equals(tournamentId)) {
            throw new IllegalArgumentException("比赛不属于该赛事");
        }
        if (!"PENDING".equals(match.getStatus())) {
            throw new IllegalArgumentException("比赛结果已记录");
        }

        if (!req.getWinnerTeamId().equals(match.getTeam1Id()) && !req.getWinnerTeamId().equals(match.getTeam2Id())) {
            throw new IllegalArgumentException("获胜队伍不是参赛队伍");
        }

        match.setWinnerId(req.getWinnerTeamId());
        match.setStatus("COMPLETED");
        tournamentMatchRepository.save(match);

        int totalRounds = getTotalRounds(tournament.getMaxTeams());
        if (match.getRound().equals(totalRounds - 1)) {
            tournament.setChampionTeamId(req.getWinnerTeamId());
            tournament.setStatus("ENDED");
            tournamentRepository.save(tournament);
        } else {
            advanceWinner(tournamentId, match);
        }

        return toVO(tournament);
    }

    public List<TournamentVO> listAll() {
        return tournamentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public TournamentVO getById(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        return toVODetail(tournament);
    }

    @Transactional
    public void registerTeam(Long tournamentId, Long teamId, Long userId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在报名阶段");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("战队不存在"));
        if (team.getStatus() == 0) {
            throw new IllegalArgumentException("战队已解散");
        }

        if (!team.getCaptainId().equals(userId)) {
            throw new IllegalArgumentException("只有队长才能为战队报名");
        }

        if (tournamentTeamRepository.existsByTournamentIdAndTeamId(tournamentId, teamId)) {
            throw new IllegalArgumentException("战队已报名");
        }

        long count = tournamentTeamRepository.countByTournamentId(tournamentId);
        if (count >= tournament.getMaxTeams()) {
            throw new IllegalArgumentException("参赛队伍已满（上限" + tournament.getMaxTeams() + "支）");
        }

        TournamentTeam tt = TournamentTeam.builder()
                .tournamentId(tournamentId)
                .teamId(teamId)
                .seed((int) count + 1)
                .build();
        tournamentTeamRepository.save(tt);
    }

    @Transactional
    public void unregisterTeam(Long tournamentId, Long teamId) {
        Tournament tournament = getTournament(tournamentId);
        if (!"REGISTRATION".equals(tournament.getStatus())) {
            throw new IllegalArgumentException("赛事不在报名阶段");
        }
        tournamentTeamRepository.deleteByTournamentIdAndTeamId(tournamentId, teamId);
    }


    @Transactional
    public void deleteTournament(Long tournamentId) {
        Tournament tournament = getTournament(tournamentId);
        tournamentMatchRepository.findByTournamentIdOrderByRoundAscPositionAsc(tournamentId)
                .forEach(m -> tournamentMatchRepository.delete(m));
        tournamentTeamRepository.findByTournamentId(tournamentId)
                .forEach(t -> tournamentTeamRepository.delete(t));
        tournamentRepository.delete(tournament);
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

        TournamentMatch nextMatch = tournamentMatchRepository.findByTournamentIdAndRound(tournamentId, nextRound)
                .stream()
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

    private Tournament getTournament(Long id) {
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
                    .round(m.getRound())
                    .position(m.getPosition())
                    .team1Id(m.getTeam1Id())
                    .team1Name(t1Name)
                    .team2Id(m.getTeam2Id())
                    .team2Name(t2Name)
                    .winnerId(m.getWinnerId())
                    .status(m.getStatus())
                    .build();
        }).collect(Collectors.toList());
        vo.setMatches(matchVOs);

        return vo;
    }
}