"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BracketTree from "@/components/BracketTree";
import SwissSchedule from "@/components/SwissSchedule";
import { adminApi, adminTournamentApi, adminRankReviewApi } from "@/lib/api";
import GameRecordWizard from "@/components/GameRecordWizard";
import { adminResultSubmissionApi } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";

const STATUS_MAP: Record<string, string> = {
  SETUP: "筹备中", REGISTRATION: "报名中", PROGRESSION: "进行中", ENDED: "已结束",
};

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIM: "单败淘汰", DOUBLE_ELIM: "双败淘汰", SWISS_ELIM: "瑞士轮 + 淘汰赛",
  SINGLE_RR: "单循环", DOUBLE_RR: "双循环",
};

export default function AdminTournamentDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [rankReview, setRankReview] = useState<any[]>([]);
  const [rankReviewLoading, setRankReviewLoading] = useState(false);
  const [swissStandings, setSwissStandings] = useState<any[]>([]);
  const [showBulkAddTeam, setShowBulkAddTeam] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [allTeamsList, setAllTeamsList] = useState<any[]>([]);
  const [wizardMatch, setWizardMatch] = useState<{ matchId: number; team1Name: string; team2Name: string; team1Id: number; team2Id: number } | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const loadSwissStandings = async (tournamentId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/tournaments/" + tournamentId + "/swiss/standings", {
        headers: { Authorization: "Bearer " + token },
      });
      const json = await res.json();
      if (json.code === 200) setSwissStandings(json.data);
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/tournaments/" + id, {
        headers: { Authorization: "Bearer " + token },
      });
      const json = await res.json();
      if (json.code !== 200) { setError(json.message || "加载失败"); return; }
      setTournament(json.data);
      setMatches(json.data.matches || []);
      if (json.data.status === "REGISTRATION") {
        setRankReviewLoading(true);
        adminRankReviewApi.tournamentReview(json.data.id)
          .then(r => setRankReview(r.data.data || []))
          .catch(() => setRankReview([]))
          .finally(() => setRankReviewLoading(false));
      } else {
        setRankReview([]);
      }
      if (json.data.format === "SWISS_ELIM") await loadSwissStandings(json.data.id);
      const subRes = await fetch("/api/admin/result-submissions?status=PENDING&tournamentId=" + id, {
        headers: { Authorization: "Bearer " + token },
      });
      const subJson = await subRes.json();
      if (subJson.code === 200) setSubmissions(subJson.data || []);
    } catch { setError("加载失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    if (getUser()?.role !== "ADMIN") { router.replace("/dashboard"); return; }
    load();
  }, [id, router]);

  const handlePublish = async () => {
    try { await adminTournamentApi.publish(tournament.id); showMsg("赛事已发布"); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleStart = async () => {
    try { await adminTournamentApi.start(tournament.id); showMsg("赛事已开始"); load(); }
    catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleRemoveTeam = async (teamId: number) => {
    if (!confirm("确定从赛事中移除该队伍？")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/admin/tournaments/" + tournament.id + "/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ teamId }),
      });
      showMsg("队伍已移除");
      load();
    } catch (err: any) { showMsg(err.response?.data?.message || "移除失败"); }
  };

  const passReviewUser = async (userId: number) => {
    try {
      await adminRankReviewApi.passTournamentUser(tournament.id, userId);
      setRankReview(prev => prev.filter(p => p.userId !== userId));
      showMsg("已通过该选手");
    } catch { showMsg("操作失败"); }
  };

  const handleBulkAddTeams = async () => {
    if (selectedTeamIds.length === 0) return;
    try {
      const res = await adminTournamentApi.batchRegister(tournament.id, selectedTeamIds);
      if (res.data.code === 200) {
        showMsg("成功添加 " + selectedTeamIds.length + " 支队伍");
        setShowBulkAddTeam(false);
        setSelectedTeamIds([]);
        load();
      } else {
        showMsg(res.data.message || "添加失败");
      }
    } catch (err: any) { showMsg(err.response?.data?.message || "添加失败"); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-400">加载中...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <p className="text-red-400">{error || "赛事不存在"}</p>
          <button onClick={() => router.replace("/admin?tab=tournaments")}
            className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-red-500 hover:text-red-400 transition">
            返回赛事管理
          </button>
        </div>
      </div>
    );
  }

  const t = tournament;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin?tab=tournaments")}
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400">
            ← 返回赛事管理
          </button>
          <h1 className="text-xl font-bold">{t.name}</h1>
          <span className="rounded bg-red-600/20 px-3 py-1 text-xs text-red-400">{STATUS_MAP[t.status] || t.status}</span>
          <span className="text-sm text-zinc-500">{FORMAT_LABEL[t.format] || t.format}</span>
          <span className="text-sm text-zinc-500">报名 {t.registeredCount}/{t.maxTeams} 队</span>
        </div>
        <div className="flex items-center gap-3">
          {t.championTeamName && (
            <span className="text-sm text-yellow-400">🏆 冠军：{t.championTeamName}</span>
          )}
        </div>
      </header>

      {msg && (
        <div className="mx-8 mt-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>
      )}

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        {/* 状态操作 */}
        {t.status === "SETUP" && (
          <button onClick={handlePublish}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-700">发布赛事（进入报名阶段）</button>
        )}
        {t.status === "REGISTRATION" && (
          <button onClick={handleStart}
            className="w-full rounded-lg bg-green-600 py-3 text-sm font-semibold hover:bg-green-700">开始比赛（生成对阵表）</button>
        )}

        {/* 段位审核 */}
        {t.status === "REGISTRATION" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">段位审核</p>
              <span className="text-xs text-zinc-500">{rankReview.length} 名选手需更新段位</span>
            </div>
            {rankReviewLoading ? (
              <p className="py-3 text-center text-sm text-zinc-500">加载中...</p>
            ) : rankReview.length === 0 ? (
              <p className="py-3 text-center text-sm text-zinc-500">暂无需要更新段位的选手</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {rankReview.map((p: any) => (
                  <div key={p.userId} className="flex items-center justify-between rounded bg-zinc-800 px-4 py-3 text-sm">
                    <div>
                      <span className="text-zinc-200">{p.username || p.displayGameId || ("#" + p.userId)}</span>
                      {p.displayGameId && <span className="ml-2 text-zinc-500">{p.displayGameId}</span>}
                      <div className="mt-1 text-xs text-zinc-500">
                        申请：{p.appliedAt ? new Date(p.appliedAt).toLocaleDateString("zh-CN") : "-"}
                        {" · "}通过：{p.reviewedAt ? new Date(p.reviewedAt).toLocaleDateString("zh-CN") : "无"}
                        {" · "}段位：{p.rank || "未认证"}
                      </div>
                    </div>
                    <button onClick={() => passReviewUser(p.userId)}
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold hover:bg-green-700">通过</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 赛程：瑞士轮按轮次展示，淘汰赛用对阵图 */}
        {t.status === "PROGRESSION" && matches.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-4 text-sm font-semibold">
              {t.format === "SWISS_ELIM" ? "瑞士轮赛程（点击比赛卡片录入结果）" : "对阵表（点击比赛卡片录入结果）"}
            </p>
            {t.format === "SWISS_ELIM" ? (
              <>
                <SwissSchedule
                  matches={matches}
                  groupName={t.groupName}
                  onMatchClick={(m: any) => {
                    if (m.team1Id && m.team2Id && (m.status === "PENDING" || m.status === "COMPLETED")) {
                      setWizardMatch({
                        matchId: m.id,
                        team1Name: m.team1Name || "队伍1",
                        team2Name: m.team2Name || "队伍2",
                        team1Id: m.team1Id,
                        team2Id: m.team2Id,
                      });
                    }
                  }}
                />
                {matches.some((m: any) => m.stage !== "SWISS") && (
                  <div className="mt-8">
                    <p className="mb-3 text-sm font-semibold">淘汰赛对阵</p>
                    <div className="overflow-x-auto pb-4">
                      <BracketTree
                        matches={matches.filter((m: any) => m.stage !== "SWISS")}
                        format={t.knockoutFormat || "SINGLE_ELIM"}
                        onMatchClick={(m: any) => {
                          if (m.team1Id && m.team2Id && (m.status === "PENDING" || m.status === "COMPLETED")) {
                            setWizardMatch({
                              matchId: m.id,
                              team1Name: m.team1Name || "队伍1",
                              team2Name: m.team2Name || "队伍2",
                              team1Id: m.team1Id,
                              team2Id: m.team2Id,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="overflow-x-auto pb-4">
                <BracketTree
                  matches={matches}
                  format={t.format}
                  onMatchClick={(m: any) => {
                    if (m.team1Id && m.team2Id && (m.status === "PENDING" || m.status === "COMPLETED")) {
                      setWizardMatch({
                        matchId: m.id,
                        team1Name: m.team1Name || "队伍1",
                        team2Name: m.team2Name || "队伍2",
                        team1Id: m.team1Id,
                        team2Id: m.team2Id,
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
        {t.status === "ENDED" && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            {t.championTeamName ? (
              <p className="text-2xl font-bold text-yellow-400">🏆 冠军：{t.championTeamName}</p>
            ) : <p className="text-zinc-500">赛事已结束</p>}
          </div>
        )}

        {/* 瑞士轮排名 */}
        {t.format === "SWISS_ELIM" && swissStandings.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-3 text-sm font-semibold">瑞士轮排名</p>
            <div className="grid gap-2 md:grid-cols-2">
              {swissStandings.map((s: any, i: number) => (
                <div key={s.teamId} className="flex items-center gap-3 rounded bg-zinc-800 px-4 py-2 text-sm">
                  <span className={"w-6 font-bold " + (i < 8 ? "text-red-400" : "text-zinc-600")}>{i + 1}</span>
                  <span className="flex-1 text-zinc-300">
                    {s.teamName || ("#" + s.teamId)}
                    {s.status === "QUALIFIED" && <span className="ml-2 rounded bg-green-600/20 px-1.5 py-0.5 text-[10px] text-green-400">已晋级</span>}
                    {s.status === "ELIMINATED" && <span className="ml-2 rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] text-red-400">已淘汰</span>}
                    <span className="ml-1 text-xs text-zinc-500">{s.wins}胜-{s.losses}负</span>
                  </span>
                  <span className="text-xs text-zinc-500">BU={s.buchholz}</span>
                </div>
              ))}
            </div>
            {t.currentStage === 0 && (t.currentSwissRound ?? 0) >= (t.swissRounds || 5) && (
              <button onClick={async () => {
                const token = localStorage.getItem("token");
                await fetch("/api/admin/tournaments/" + t.id + "/swiss/generate-knockout", {
                  method: "POST", headers: { Authorization: "Bearer " + token },
                });
                showMsg("八强对阵已生成");
                load();
              }}
                className="mt-4 w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold hover:bg-red-700">生成八强对阵</button>
            )}
          </div>
        )}

        {/* 赛果申报审核 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">赛果申报审核</p>
            <span className="text-xs text-zinc-500">{submissions.length} 条待审核</span>
          </div>
          <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={1}
            placeholder="审核意见（选填，通过时附带）"
            className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
          {submissions.length === 0 ? (
            <p className="py-3 text-center text-sm text-zinc-500">暂无待审核申报</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded bg-zinc-800 px-4 py-3 text-sm">
                  <div>
                    <span className="text-zinc-200">{s.team1Name} <span className="text-zinc-500">{s.team1Wins} : {s.team2Wins}</span> {s.team2Name}</span>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      裁判：{s.refereeName || ("#" + s.refereeId)} · BO{s.boType} · {s.gameCount} 局 · {(s.screenshotPaths || []).length} 张截图
                      {s.note && <span> · 备注：{s.note}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      try {
                        const res = await adminResultSubmissionApi.detail(s.id);
                        setReviewTarget({ id: s.id, detail: res.data.data });
                      } catch (err: any) { showMsg(err.response?.data?.message || "加载失败"); }
                    }}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold hover:bg-blue-700">审核</button>
                    <button onClick={() => { setRejectTarget(s); setRejectReason(""); }}
                      className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">驳回</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 联赛积分 */}
        {(t.format === "SINGLE_RR" || t.format === "DOUBLE_RR") && (t.leagueStandings || []).length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-3 text-sm font-semibold">常规赛积分</p>
            <div className="grid gap-2 md:grid-cols-2">
              {(t.leagueStandings || []).map((s: any, i: number) => (
                <div key={s.teamId} className="flex items-center gap-3 rounded bg-zinc-800 px-4 py-2 text-sm">
                  <span className="w-6 font-bold text-zinc-400">{i + 1}</span>
                  <span className="flex-1 text-zinc-300">{s.teamName}</span>
                  <span className="text-xs text-zinc-500">{s.wins}胜-{s.losses}负 · 净胜局{s.roundDiff}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 报名队伍 */}
        {t.registeredTeams && t.registeredTeams.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-3 text-sm font-semibold">报名队伍</p>
            <div className="flex flex-wrap gap-2">
              {t.registeredTeams.map((rt: any) => (
                <div key={rt.id} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-3 py-1.5">
                  <span className="text-sm text-zinc-300">
                    {rt.teamName} <span className="text-xs text-zinc-500">#{rt.seed}</span>
                  </span>
                  {(t.status === "SETUP" || t.status === "REGISTRATION") && (
                    <button onClick={() => handleRemoveTeam(rt.teamId)}
                      className="ml-1 text-red-500 hover:text-red-400 text-xs leading-none">&times;</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(t.status === "SETUP" || t.status === "REGISTRATION") && (
          <button onClick={async () => { setShowBulkAddTeam(true); try { const res = await adminApi.listTeams(); setAllTeamsList(res.data.data || []); } catch {} }}
            className="w-full rounded-lg border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-blue-500 hover:text-blue-400 transition">
            + 批量添加队伍
          </button>
        )}
      </main>

      {wizardMatch && (
        <GameRecordWizard
          tournamentId={t.id}
          matchId={wizardMatch.matchId}
          team1Id={wizardMatch.team1Id}
          team2Id={wizardMatch.team2Id}
          team1Name={wizardMatch.team1Name}
          team2Name={wizardMatch.team2Name}
          onClose={() => setWizardMatch(null)}
          onComplete={(msg) => { showMsg(msg); load(); }}
        />
      )}

      {reviewTarget && (
        <GameRecordWizard
          mode="review"
          tournamentId={reviewTarget.detail.tournamentId}
          matchId={reviewTarget.detail.matchId}
          team1Id={reviewTarget.detail.team1Id || 0}
          team2Id={reviewTarget.detail.team2Id || 0}
          team1Name={reviewTarget.detail.team1Name || "队伍1"}
          team2Name={reviewTarget.detail.team2Name || "队伍2"}
          initialPayload={reviewTarget.detail.payload}
          onClose={() => setReviewTarget(null)}
          onComplete={(m) => { showMsg(m); setReviewTarget(null); load(); }}
          onSubmitPayload={async (payload) => {
            await adminResultSubmissionApi.approve(reviewTarget.id, { reviewNote: reviewNote || undefined, ...payload });
          }}
        />
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-3 text-sm font-semibold">驳回申报</h3>
            <p className="mb-3 text-xs text-zinc-500">
              {rejectTarget.team1Name} vs {rejectTarget.team2Name}（裁判：{rejectTarget.refereeName || "#" + rejectTarget.refereeId}）
            </p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="驳回原因（必填，将展示给裁判）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:border-zinc-500">取消</button>
              <button onClick={async () => {
                if (!rejectReason.trim()) { showMsg("请填写驳回原因"); return; }
                try {
                  await adminResultSubmissionApi.reject(rejectTarget.id, { reviewNote: rejectReason.trim() });
                  showMsg("已驳回该申报");
                  setRejectTarget(null);
                  load();
                } catch (err: any) { showMsg(err.response?.data?.message || "操作失败"); }
              }}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">确认驳回</button>
            </div>
          </div>
        </div>
      )}

      {showBulkAddTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">批量添加队伍</h3>
              <button onClick={() => { setShowBulkAddTeam(false); setSelectedTeamIds([]); }} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {allTeamsList
                .filter((x: any) => x.status === 1 && !(t.registeredTeams || []).some((rt: any) => rt.teamId === x.id))
                .map((x: any) => {
                  const checked = selectedTeamIds.includes(x.id);
                  return (
                    <label key={x.id} className={"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition " + (checked ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600")}>
                      <input type="checkbox" checked={checked} onChange={() => {
                        setSelectedTeamIds(prev =>
                          prev.includes(x.id) ? prev.filter(id => id !== x.id) : [...prev, x.id]
                        );
                      }} className="rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500" />
                      <span className="font-medium text-zinc-200">{x.name}</span>
                      <span className="ml-auto text-xs text-zinc-500">ID:{x.id} · {x.memberCount}人{x.captainId === 0 ? " · 无人战队" : ""}</span>
                    </label>
                  );
                })}
              {allTeamsList.filter((x: any) => x.status === 1 && !(t.registeredTeams || []).some((rt: any) => rt.teamId === x.id)).length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-500">没有可添加的队伍</p>
              )}
            </div>
            {selectedTeamIds.length > 0 && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-xs text-zinc-500">已选择 {selectedTeamIds.length} 支队伍</p>
                <button onClick={handleBulkAddTeams}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-700">确认批量添加</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
