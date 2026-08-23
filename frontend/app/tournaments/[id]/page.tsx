"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import BracketTree from "@/components/BracketTree";
import GameDetailPanel from "@/components/GameDetailPanel";
import TournamentNotificationManager from "@/components/TournamentNotificationManager";
import { tournamentApi, teamApi, matchApi } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

const STATUS_MAP = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  PROGRESSION: "进行中",
  ENDED: "已结束",
};
const STATUS_COLOR = {
  SETUP: "text-zinc-400",
  REGISTRATION: "text-blue-400",
  PROGRESSION: "text-green-400",
  ENDED: "text-yellow-400",
};

const FORMAT_LABEL = {
  SINGLE_ELIM: "单败淘汰",
  DOUBLE_ELIM: "双败淘汰",
  SWISS_ELIM: "瑞士轮",
  SINGLE_RR: "单循环",
  DOUBLE_RR: "双循环",
};

const PLAYER_SORT_COLUMNS = [
  { key: "acs", label: "ACS" },
  { key: "kd", label: "K/D" },
  { key: "kpr", label: "KPR" },
  { key: "firstBloodRate", label: "首杀率" },
  { key: "survivalRate", label: "存活率" },
  { key: "assistsPerRound", label: "回合助攻" },
];

export default function TournamentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [detailMatch, setDetailMatch] = useState<any>(null);
  const [detailGames, setDetailGames] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
  const [playerSortKey, setPlayerSortKey] = useState("acs");
  const [playerSortDir, setPlayerSortDir] = useState<"asc" | "desc">("desc");
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [captainTeams, setCaptainTeams] = useState<any[]>([]);

  const currentUser = getUser();

  const fetch = () => {
    setLoading(true);
    tournamentApi.detail(Number(id))
      .then((res) => setTournament(res.data.data))
      .catch(() => router.replace("/tournaments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    fetch();
  }, [id, router]);

  useEffect(() => {
    if (!detailMatch) return;
    setDetailLoading(true);
    matchApi.detail(detailMatch.id).then(r => {
      setDetailGames(r.data.data?.games || []);
    }).catch(() => {}).finally(() => setDetailLoading(false));
  }, [detailMatch]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    setPlayerStatsLoading(true);
    tournamentApi.playerStats(Number(id))
      .then((r) => setPlayerStats(r.data.data || []))
      .catch(() => {})
      .finally(() => setPlayerStatsLoading(false));
  }, [id, router]);

  const handleOpenPicker = async () => {
    try {
      const res = await teamApi.myCaptainedTeams();
      setCaptainTeams(res.data.data || []);
      if (!res.data.data || res.data.data.length === 0) {
        setMsg("你没有担任队长的战队，请先创建或加入一个战队");
        setTimeout(() => setMsg(""), 3000);
        return;
      }
      setShowTeamPicker(true);
    } catch (e: any) {
      setMsg("获取战队列表失败");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleRegister = async (teamId: number) => {
    if (!tournament) return;
    try {
      await tournamentApi.register(tournament!.id, teamId);
      setMsg("报名成功");
      setShowTeamPicker(false);
      fetch();
    } catch (err: any) {
      setMsg(err.response?.data?.message || "报名失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const handleUnregister = async () => {
    if (!tournament || !currentUser) return;
    const myTeam = (tournament.registeredTeams ?? []).find(
      (rt: any) => currentUser.id && rt.teamId
    );
    if (!myTeam) return;
    if (!confirm("确定取消报名？")) return;
    try {
      await tournamentApi.unregister(tournament!.id, myTeam.teamId);
      setMsg("已取消报名");
      fetch();
    } catch (err2: any) {
      setMsg(err2.response?.data?.message || "取消失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const matches = tournament?.matches || [];

  const sortedPlayerStats = useMemo(() => {
    const arr = [...playerStats];
    const dir = playerSortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => dir * (Number(a[playerSortKey] ?? 0) - Number(b[playerSortKey] ?? 0)));
    return arr;
  }, [playerStats, playerSortKey, playerSortDir]);
  const handlePlayerSort = (key: string) => {
    if (playerSortKey === key) {
      setPlayerSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setPlayerSortKey(key);
      setPlayerSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <NavBar />
        <p className="text-zinc-500">加载中...</p>
      </div>
    );
  }

  if (!tournament) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-black tracking-tight">{tournament.name}</h1>
              {tournament.description && (
                <p className="mt-2 text-zinc-400">{tournament.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={"rounded-full px-4 py-1.5 text-sm font-medium " + (STATUS_COLOR[tournament.status as keyof typeof STATUS_COLOR] || "") + " bg-white/5 border border-white/10"}>
                {STATUS_MAP[tournament.status as keyof typeof STATUS_MAP]}
              </span>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{tournament.registeredCount}/{tournament.maxTeams} 队</span>
                <span>{FORMAT_LABEL[tournament.format as keyof typeof FORMAT_LABEL] || tournament.format}</span>
                <span>{new Date(tournament.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 border border-red-500/20">{msg}</div>
        )}

        {tournament.status === "ENDED" && tournament.championTeamName && (
          <div className="mb-10 mx-auto max-w-3xl rounded-2xl border border-yellow-600/30 bg-gradient-to-br from-yellow-600/10 to-transparent p-8 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl font-black text-yellow-400">{tournament.championTeamName}</h2>
            <p className="mt-1 text-sm text-zinc-500">冠军队伍</p>
          </div>
        )}

        <div className="mb-10">
          <TournamentNotificationManager
            tournamentId={Number(id)}
            canManage={currentUser?.role === "ADMIN"}
          />
        </div>

        <div className="grid gap-10 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">报名队伍（{tournament.registeredCount}/{tournament.maxTeams}）</h2>
              {tournament.status === "REGISTRATION" && (
                <div className="flex gap-2">
                  <button onClick={handleOpenPicker}
                    className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold transition hover:bg-red-700">
                    报名参赛
                  </button>
                  <button onClick={handleUnregister}
                    className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 transition hover:border-red-500 hover:text-red-400">
                    取消报名
                  </button>
                </div>
              )}
            </div>            <div className="space-y-2">
              {(tournament.registeredTeams ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">暂无报名队伍</p>
              ) : (
                (tournament.registeredTeams ?? []).map((rt: any) => (
                  <div key={rt.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
                        #{rt.seed}
                      </span>
                      <div>
                        <Link href={"/teams/" + rt.teamId} className="font-medium text-sm hover:text-red-400 transition">
                          {rt.teamName}
                        </Link>
                        <p className="text-xs text-zinc-500">队长：{rt.captainName}</p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{rt.memberCount} 人</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-2 overflow-x-auto">
            {(tournament.format === "SINGLE_RR" || tournament.format === "DOUBLE_RR") && (tournament.leagueStandings || []).length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">常规赛积分</h2>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                        <th className="px-4 py-3">排名</th>
                        <th className="px-4 py-3">战队</th>
                        <th className="px-4 py-3 text-right">胜</th>
                        <th className="px-4 py-3 text-right">负</th>
                        <th className="px-4 py-3 text-right">净胜局</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tournament.leagueStandings || []).map((s: any, i: number) => (
                        <tr key={s.teamId} className="border-b border-zinc-800/50 last:border-0">
                          <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{s.teamName}</td>
                          <td className="px-4 py-3 text-right text-green-400">{s.wins}</td>
                          <td className="px-4 py-3 text-right text-red-400">{s.losses}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{s.roundDiff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold">选手数据</h2>
              </div>

              {playerStatsLoading ? (
                <p className="py-6 text-center text-sm text-zinc-500">加载中...</p>
              ) : sortedPlayerStats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">暂无选手数据</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs text-zinc-500">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">选手</th>
                        <th className="px-4 py-3">战队</th>
                        <th className="px-4 py-3 text-right">场次</th>
                        {PLAYER_SORT_COLUMNS.map((col) => {
                          const isActive = playerSortKey === col.key;
                          const arrow = isActive ? (playerSortDir === "desc" ? "↓" : "↑") : "↕";
                          return (
                            <th key={col.key} className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handlePlayerSort(col.key)}
                                className={"inline-flex items-center gap-1 transition " + (isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300")}
                              >
                                {col.label}
                                <span className={isActive ? "text-red-400" : "text-zinc-600"}>{arrow}</span>
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayerStats.map((p: any, idx: number) => (
                        <tr key={p.userId} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/50">
                          <td className="px-4 py-3 text-zinc-500">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium">
                            {p.userId ? (
                              <div>
                                <Link href={"/career/" + p.userId} className="text-blue-400 hover:text-blue-300 transition">
                                  {p.playerName || "未知"}
                                </Link>
                                {p.gameId && <div className="text-xs text-zinc-500">{p.gameId}</div>}
                              </div>
                            ) : (
                              <span className="text-zinc-400">{p.playerName || "未知"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{p.teamName || "-"}</td>
                          <td className="px-4 py-3 text-right text-zinc-300">{p.games ?? 0}</td>
                          <td className="px-4 py-3 text-right text-blue-400">{Number(p.acs ?? 0).toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-green-400">{Number(p.kd ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-yellow-400">{Number(p.kpr ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-purple-400">{Number(p.firstBloodRate ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-cyan-400">{Number(p.survivalRate ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-orange-400">{Number(p.assistsPerRound ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <h2 className="text-lg font-semibold mb-4">赛程图</h2>
            <BracketTree
              matches={matches}
              format={tournament.format}
              onMatchClick={(m: any) => {
                if (m.team1Id && m.team2Id) setDetailMatch(m);
              }}
            />
            {tournament.status === "ENDED" && !tournament.championTeamName && (
              <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
                <p className="text-sm text-zinc-500">赛事已结束，无冠军</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {detailMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[85vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{detailMatch.team1Name || "队伍A"} vs {detailMatch.team2Name || "队伍B"}</h3>
              <button onClick={() => setDetailMatch(null)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <p className="mb-4 text-xs text-zinc-500">{detailMatch.status === "COMPLETED" ? "已完结" : "进行中"}</p>
            {detailLoading ? (
              <p className="py-4 text-center text-xs text-zinc-500">加载中...</p>
            ) : detailGames.length > 0 ? (
              <GameDetailPanel
                games={detailGames}
                team1Name={detailMatch.team1Name}
                team2Name={detailMatch.team2Name}
                team1Id={detailMatch.team1Id}
                team2Id={detailMatch.team2Id}
              />
            ) : (
              <p className="py-4 text-center text-xs text-zinc-500">暂无小局数据</p>
            )}
          </div>
        </div>
      )}
{showTeamPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">选择战队</h3>
              <button onClick={() => setShowTeamPicker(false)} className="text-zinc-500 hover:text-white text-xl transition">&times;</button>
            </div>
            <div className="space-y-3">
              {captainTeams.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">暂无可用战队</p>
              ) : (
                captainTeams.map((team: any) => (
                  <button key={team.id} onClick={() => handleRegister(team.id)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left transition hover:border-red-500 hover:bg-zinc-700 group">
                    <p className="font-medium group-hover:text-red-400 transition">{team.name}</p>
                    <p className="text-xs text-zinc-500">队员 {team.memberCount} 人</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
