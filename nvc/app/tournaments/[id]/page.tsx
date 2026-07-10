"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { tournamentApi, teamApi, TournamentVO, TeamVO, MatchVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中",
  REGISTRATION: "报名中",
  PROGRESSION: "进行中",
  ENDED: "已结束",
};
const STATUS_COLOR: Record<string, string> = {
  SETUP: "text-zinc-400",
  REGISTRATION: "text-blue-400",
  PROGRESSION: "text-green-400",
  ENDED: "text-yellow-400",
};

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [detailMatch, setDetailMatch] = useState<MatchVO | null>(null);

  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [captainTeams, setCaptainTeams] = useState<TeamVO[]>([]);

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
    } catch {
      setMsg("获取战队列表失败");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleRegister = async (teamId: number) => {
    if (!tournament) return;
    try {
      await tournamentApi.register(tournament.id, teamId);
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
    const myTeam = tournament.registeredTeams?.find(
      (rt) => currentUser.id && rt.teamId
    );
    if (!myTeam) return;
    if (!confirm("确定取消报名？")) return;
    try {
      await tournamentApi.unregister(tournament.id, myTeam.teamId);
      setMsg("已取消报名");
      fetch();
    } catch (err: any) {
      setMsg(err.response?.data?.message || "取消失败");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><NavBar /><p className="text-zinc-500">加载中...</p></div>;
  }

  if (!tournament) return null;

  const matches = tournament.matches || [];
  const rounds: MatchVO[][] = [];
  for (const m of matches) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }


  const isMyTeamRegistered = tournament.registeredTeams?.some(
    (rt) => currentUser?.id && rt.captainName === currentUser.username
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-black tracking-tight">{tournament.name}</h1>
              {tournament.description && (
                <p className="mt-2 text-zinc-400">{tournament.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${STATUS_COLOR[tournament.status]} bg-white/5 border border-white/10`}>
                {STATUS_MAP[tournament.status]}
              </span>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{tournament.registeredCount}/{tournament.maxTeams} 队</span>
                <span>单败淘汰</span>
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

        <div className="grid gap-10 lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">报名队伍（{tournament.registeredCount}/{tournament.maxTeams}）</h2>
              {tournament.status === "REGISTRATION" && (
                <div className="flex gap-2">
                  {!isMyTeamRegistered && (
                    <button onClick={handleOpenPicker}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold transition hover:bg-red-700">
                      报名参赛
                    </button>
                  )}
                  {isMyTeamRegistered && (
                    <button onClick={handleUnregister}
                      className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 transition hover:border-red-500 hover:text-red-400">
                      取消报名
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(tournament.registeredTeams ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">暂无报名队伍</p>
              ) : (
                (tournament.registeredTeams ?? []).map((rt) => (
                  <div key={rt.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
                        #{rt.seed}
                      </span>
                      <div>
                        <Link href={`/teams/${rt.teamId}`} className="font-medium text-sm hover:text-red-400 transition">
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

          <section className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">对阵表</h2>
            {rounds.length > 0 ? (
              <div className="space-y-8">
                {rounds.map((roundMatches, ri) => (
                  <div key={ri}>
                    <h3 className="text-sm font-semibold text-zinc-500 mb-3">
                      {ri === 0 ? "四分之一决赛" : ri === 1 ? "半决赛" : ri === 2 ? "决赛" : `第 ${ri + 1} 轮`}
                    </h3>
                    <div className={`grid gap-3 ${roundMatches.length >= 4 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
                      {roundMatches.map((m) => (
                        <button key={m.id} onClick={() => m.team1Id && m.team2Id && setDetailMatch(m)}
                          className={`rounded-xl border p-4 text-left transition ${
                            m.status === "COMPLETED"
                              ? "border-green-800/50 bg-green-900/10"
                              : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                          }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${m.winnerId === m.team1Id ? "text-green-400" : "text-zinc-300"}`}>
                              {m.team1Name || "待定"}
                            </span>
                            <span className="text-xs text-zinc-600">VS</span>
                            <span className={`text-sm font-medium ${m.winnerId === m.team2Id ? "text-green-400" : "text-zinc-300"}`}>
                              {m.team2Name || "待定"}
                            </span>
                          </div>
                          <div className="mt-2 text-center">
                            {m.status === "COMPLETED" && (
                              <span className="text-xs text-green-500">已结束</span>
                            )}
                            {m.status === "PENDING" && m.team1Id && m.team2Id && (
                              <span className="text-xs text-zinc-500">等待比赛</span>
                            )}
                            {m.status === "PENDING" && (!m.team1Id || !m.team2Id) && (
                              <span className="text-xs text-zinc-600">等待对手确定</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
                <p className="text-sm text-zinc-500">暂无比赛数据</p>
              </div>
            )}

            {tournament.status === "ENDED" && !tournament.championTeamName && (
              <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
                <p className="text-sm text-zinc-500">赛事已结束，无冠军</p>
              </div>
            )}
          </section>
        </div>
      </main>

      {detailMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetailMatch(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">比赛详情</h3>
              <button onClick={() => setDetailMatch(null)} className="text-zinc-500 hover:text-white text-xl transition">&times;</button>
            </div>
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-6 mb-2">
                <span className="text-lg font-bold">{detailMatch.team1Name || "待定"}</span>
                <span className="text-xs font-bold text-zinc-600 tracking-widest">VS</span>
                <span className="text-lg font-bold">{detailMatch.team2Name || "待定"}</span>
              </div>
              <p className="text-xs text-zinc-500">
                {detailMatch.winnerId
                  ? `胜者：${detailMatch.winnerId === detailMatch.team1Id ? detailMatch.team1Name : detailMatch.team2Name}`
                  : "比赛未开始"}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-800/30 p-12 text-center">
              <div className="mb-3 text-4xl">🎮</div>
              <p className="text-sm font-medium text-zinc-400">比赛详情由管理员记录</p>
              <p className="mt-1 text-xs text-zinc-600">管理员可在管理后台记录比赛胜负，胜者自动晋级下一轮</p>
            </div>
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
                captainTeams.map((team) => (
                  <button key={team.id} onClick={() => handleRegister(team.id)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-left transition hover:border-red-500 hover:bg-zinc-700 group">
                    <p className="font-medium group-hover:text-red-400 transition">{team.name}</p>
                    <p className="text-xs text-zinc-500">队员 {team.memberCount}/5</p>
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