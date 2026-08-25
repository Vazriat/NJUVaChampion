"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { careerApi, publicUserApi } from "@/lib/api";
import HexagonChart from "@/components/HexagonChart";
import { MAJOR_RANKS, majorRankOf } from "@/lib/ranks";
import { getUser } from "@/lib/auth";

const ANALYSIS_LABELS: Record<string, string> = {
  acs: "ACS",
  kd: "K/D",
  kpr: "回合击杀",
  survivalRate: "存活率",
  assistsPerRound: "回合助攻",
  firstBloodRate: "首杀率",
};

export default function CareerPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [career, setCareer] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([MAJOR_RANKS[3]]);
  const [selectedTournaments, setSelectedTournaments] = useState<number[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadAnalysis = async (ranks: string[], tournamentIds: number[]) => {
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const res = await careerApi.getAnalysis(
        userId,
        ranks.join(","),
        tournamentIds.length > 0 ? tournamentIds.join(",") : undefined
      );
      setAnalysis(res.data.data);
    } catch (err: any) {
      setAnalysisError(err.response?.data?.message || "Failed to load analysis data");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, mRes] = await Promise.all([
        careerApi.get(userId),
        careerApi.getMatches(userId),
      ]);
      const careerData = cRes.data.data;
      setCareer(careerData);
      setMatches(mRes.data.data || []);
      const initialMajor = careerData?.verifiedRank ? majorRankOf(careerData.verifiedRank) : "";
      const initialRanks = initialMajor ? [initialMajor] : [MAJOR_RANKS[3]];
      setSelectedRanks(initialRanks);
      loadAnalysis(initialRanks, []);

    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load career data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <NavBar />
        <main className="mx-auto max-w-4xl px-8 py-10">
          <p className="text-zinc-500">加载中...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <NavBar />
        <main className="mx-auto max-w-4xl px-8 py-10">
          <p className="text-red-400">{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10">
        {/* Profile header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/20 text-xl font-bold text-red-400">
            {career?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{career?.username || "Unknown"}</h1>
            {career?.gameId && (
              <p className="mt-1 text-sm text-zinc-500">{career.gameId}</p>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          {[
            { label: "平均 ACS", value: career?.avgAcs ?? "-", color: "text-blue-400" },
            { label: "K/D", value: career?.avgKd ?? "-", color: "text-green-400" },
            { label: "胜率", value: career?.winRate != null ? career.winRate + "%" : "-", color: "text-red-400" },
            { label: "总场次", value: career?.totalGames ?? 0, color: "text-yellow-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
              <p className="text-sm text-zinc-500">{item.label}</p>
              <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Additional stats row */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "回合击杀", value: career?.killsPerRound != null ? Number(career.killsPerRound).toFixed(2) : "-" },
            { label: "存活率", value: career?.survivalRate != null ? Number(career.survivalRate).toFixed(2) : "-" },
            { label: "回合助攻", value: career?.assistsPerRound != null ? Number(career.assistsPerRound).toFixed(2) : "-" },
            { label: "首杀率", value: career?.firstBloodRate != null ? Number(career.firstBloodRate).toFixed(2) : "-" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-zinc-300">{item.value}</p>
            </div>
          ))}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <p className="text-xs text-zinc-500">生涯 K/D/A</p>
            <p className="mt-1 text-xl font-semibold text-zinc-300">
              <span className="text-green-400">{career?.totalKills ?? 0}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-red-400">{career?.totalDeaths ?? 0}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-yellow-400">{career?.totalAssists ?? 0}</span>
            </p>
          </div>
        </div>

        {/* Data analysis */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">数据分析</h2>
              <p className="mt-1 text-xs text-zinc-500">对比基础集平均值，标注 TOP1-3 / BOT1-3</p>
            </div>
            <div>
              <span className="mb-2 block text-xs text-zinc-400">基础段位（可多选）</span>
              <div className="flex flex-wrap gap-1.5">
                {MAJOR_RANKS.map((r) => {
                  const active = selectedRanks.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? selectedRanks.filter((x) => x !== r)
                          : [...selectedRanks, r];
                        if (next.length === 0) return;
                        setSelectedRanks(next);
                        loadAnalysis(next, selectedTournaments);
                      }}
                      className={
                        "rounded-lg border px-3 py-1 text-sm transition " +
                        (active
                          ? "border-red-500 bg-red-600/20 text-red-400"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500")
                      }
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {career?.tournaments?.length > 0 && (
            <div className="mb-4">
              <span className="mb-2 block text-xs text-zinc-400">赛事筛选（可多选，默认全部）</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTournaments([]);
                    loadAnalysis(selectedRanks, []);
                  }}
                  className={
                    "rounded-lg border px-3 py-1 text-sm transition " +
                    (selectedTournaments.length === 0
                      ? "border-red-500 bg-red-600/20 text-red-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500")
                  }
                >
                  全部
                </button>
                {career.tournaments.map((t: any) => {
                  const active = selectedTournaments.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? selectedTournaments.filter((id) => id !== t.id)
                          : [...selectedTournaments, t.id];
                        setSelectedTournaments(next);
                        loadAnalysis(selectedRanks, next);
                      }}
                      className={
                        "rounded-lg border px-3 py-1 text-sm transition " +
                        (active
                          ? "border-blue-500 bg-blue-600/20 text-blue-400"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500")
                      }
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {analysisLoading && <p className="py-8 text-center text-sm text-zinc-500">分析中...</p>}
          {analysisError && <p className="py-4 text-center text-sm text-red-400">{analysisError}</p>}
          {!analysisLoading && !analysisError && analysis && (
            <div className="grid gap-6 md:grid-cols-2">
              <HexagonChart
                dimensions={analysis.dimensions.map((d: any) => ({
                  key: d.key,
                  label: ANALYSIS_LABELS[d.key] || d.key,
                  value: d.value ?? 0,
                  average: d.average ?? 0,
                  topRank: d.topRank ?? null,
                  botRank: d.botRank ?? null,
                }))}
              />
              <div>
                <p className="mb-2 text-xs text-zinc-500">
                  基础集：{analysis.rank} · 共 {analysis.baseSetSize} 名有数据用户
                </p>
                <div className="space-y-2">
                  {analysis.dimensions.map((d: any) => (
                    <div key={d.key} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm">
                      <span className="text-zinc-300">{ANALYSIS_LABELS[d.key] || d.key}</span>
                      <span className="flex items-center gap-2">
                        {d.topRank && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold text-green-400">TOP{d.topRank}</span>}
                        {d.botRank && !d.topRank && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400">BOT{d.botRank}</span>}
                        <span className="text-zinc-500">均值 {Number(d.average ?? 0).toFixed(2)}</span>
                        <span className="font-semibold text-red-400">{Number(d.value ?? 0).toFixed(2)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top agents */}
        {career?.topAgents?.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">常用特工</h2>
            <div className="flex flex-wrap gap-2">
              {career.topAgents.map((a: any) => (
                <span key={a.agent} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm">
                  {a.agent}
                  <span className="ml-2 text-xs text-zinc-500">×{a.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Match history */}
        <h2 className="mb-3 text-lg font-semibold">最近比赛</h2>
        {matches.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">暂无比赛记录</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m: any) => {
              const isExpanded = expandedGame === m.gameId;
              const team1Score = m.team1Score;
              const team2Score = m.team2Score;
              const isTie = team1Score === team2Score;

              return (
                <div key={m.gameId}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700">
                  <button
                    onClick={() => setExpandedGame(isExpanded ? null : m.gameId)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-300">
                          {m.tournamentName || "未知赛事"}
                          <span className="ml-2 text-xs text-zinc-600">第{m.gameNumber}局</span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {m.team1Name || "队伍A"} vs {m.team2Name || "队伍B"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${!isTie && team1Score > team2Score ? "text-green-400" : "text-zinc-400"}`}>
                        {team1Score ?? "-"}
                      </span>
                      <span className="text-xs text-zinc-600">:</span>
                      <span className={`text-lg font-bold ${!isTie && team2Score > team1Score ? "text-green-400" : "text-zinc-400"}`}>
                        {team2Score ?? "-"}
                      </span>
                      <span className="ml-2 text-xs text-zinc-600">{isExpanded ? "收起" : "展开"}</span>
                    </div>
                  </button>

                  {isExpanded && m.playerStats && (
                    <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-left text-zinc-500 uppercase tracking-wider">
                            <th className="pb-2 pr-3">选手</th>
                            <th className="pb-2 pr-3">特工</th>
                            <th className="pb-2 pr-3">ACS</th>
                            <th className="pb-2 pr-3">K</th>
                            <th className="pb-2 pr-3">D</th>
                            <th className="pb-2 pr-3">A</th>
                            <th className="pb-2 pr-3">首杀</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.playerStats.map((ps: any, i: number) => (
                            <tr key={i} className="border-b border-zinc-800/50">
                              <td className="py-2 pr-3 font-medium text-zinc-300">{ps.playerName || "?"}</td>
                              <td className="py-2 pr-3 text-zinc-400">{ps.agent || "-"}</td>
                              <td className="py-2 pr-3 text-blue-400">{ps.acs ?? "-"}</td>
                              <td className="py-2 pr-3 text-green-400">{ps.kills ?? "-"}</td>
                              <td className="py-2 pr-3 text-red-400">{ps.deaths ?? "-"}</td>
                              <td className="py-2 pr-3 text-yellow-400">{ps.assists ?? "-"}</td>
                              <td className="py-2 pr-3 text-zinc-400">{ps.firstBlood ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
