"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import GameRecordWizard from "@/components/GameRecordWizard";
import StartLiveButton from "@/components/StartLiveButton";
import { resultSubmissionApi, authApi, liveApi } from "@/lib/api";
import { setUser as persistUser } from "@/lib/auth";
import { getUser, isLoggedIn, getRefereeMode } from "@/lib/auth";
import { useConfirm } from "@/components/DialogProvider";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "审核中", APPROVED: "已通过", REJECTED: "已驳回", CANCELLED: "已撤销",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400",
  APPROVED: "bg-green-500/10 text-green-400",
  REJECTED: "bg-red-500/10 text-red-400",
  CANCELLED: "bg-zinc-700/30 text-zinc-400",
};

export default function RefereeCenterPage() {
  const ask = useConfirm();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [startable, setStartable] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const COLLAPSED_COUNT = 5;

  // 按赛事分组：裁判到场关心的是「哪个赛事还有活要干」，不是一长串小场
  const grouped = useMemo(() => {
    const map = new Map<number, { tournamentId: number; tournamentName: string; items: any[] }>();
    for (const m of startable) {
      const key = m.tournamentId;
      if (!map.has(key)) {
        map.set(key, { tournamentId: key, tournamentName: m.tournamentName, items: [] });
      }
      map.get(key)!.items.push(m);
    }
    return [...map.values()];
  }, [startable]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    // 用最新 profile 判定裁判身份（localStorage 可能过期）；需在裁判模式下访问
    if (getRefereeMode() !== true) { router.replace("/dashboard"); return; }
    authApi.getProfile().then(res => {
      const u = res.data.data;
      if (u?.referee !== true) { router.replace("/dashboard"); return; }
      persistUser(u);
      load();
    }).catch(() => router.replace("/login"));
  }, [router]);

  const load = () => {
    setLoading(true);
    resultSubmissionApi.my()
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    loadStartable();
  };

  const loadStartable = () => {
    liveApi.startable()
      .then(r => setStartable(r.data.data || []))
      .catch(() => {});
  };

  const handleCancel = async (id: number) => {
    const ok = await ask({ title: "撤销申报", message: "确定撤销该申报？撤销后需要重新申报。", okText: "确认撤销", danger: true });
    if (!ok) return;
    try {
      await resultSubmissionApi.cancel(id);
      setMsg("申报已撤销");
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || "操作失败"); }
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await resultSubmissionApi.detail(id);
      setEditTarget({ id, detail: res.data.data });
    } catch (err: any) { setMsg(err.response?.data?.message || "加载失败"); }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh"><NavBar /><main className="mx-auto max-w-4xl px-8 py-10 max-md:px-4 max-md:py-8"><p className="text-zinc-500">加载中...</p></main></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-4xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">裁判工作台</h2>
            <p className="mt-1 text-sm text-zinc-500">开播 → 打比赛 → 结束直播 → 提交赛果（赛果由管理员审核后生效）</p>
          </div>
          <Link href="/settings" className="shrink-0 text-sm text-zinc-400 hover:text-red-400">
            我的直播间 →
          </Link>
        </div>
        {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}

        {/* ===== 可开播的比赛（按赛事分组） ===== */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">可开播的比赛</h3>
            <span className="text-xs text-zinc-500">进行中赛事里尚未开打的场次</span>
          </div>
          {grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
              当前没有可开播的比赛
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map((g) => {
                const isOpen = !!expanded[g.tournamentId];
                const shown = isOpen ? g.items : g.items.slice(0, COLLAPSED_COUNT);
                return (
                  <div key={g.tournamentId} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3 max-md:px-4">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold">{g.tournamentName || "未命名赛事"}</h4>
                        <p className="mt-0.5 text-xs text-zinc-500">{g.items.length} 场待开播</p>
                      </div>
                      <Link
                        href={`/tournaments/${g.tournamentId}`}
                        className="shrink-0 text-xs text-zinc-400 transition hover:text-red-400"
                      >
                        查看赛程 →
                      </Link>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {shown.map((m: any) => (
                        <div key={m.matchId}
                          className="flex items-center justify-between gap-3 px-5 py-3 max-md:flex-col max-md:items-stretch max-md:px-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{m.team1Name} vs {m.team2Name}</p>
                            <p className="mt-0.5 truncate text-xs text-zinc-500">
                              {m.round != null ? `第 ${m.round + 1} 轮` : "赛程待定"}
                            </p>
                          </div>
                          <StartLiveButton
                            matchId={m.matchId}
                            onStarted={loadStartable}
                            className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 max-md:min-h-11"
                          />
                        </div>
                      ))}
                    </div>
                    {g.items.length > COLLAPSED_COUNT && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [g.tournamentId]: !isOpen }))}
                        className="w-full border-t border-zinc-800 py-2 text-xs text-zinc-500 transition hover:text-red-400 max-md:min-h-11"
                      >
                        {isOpen ? "收起" : `展开全部 ${g.items.length} 场`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">我的申报记录</h3>
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            暂无申报记录。在上方「可开播的比赛」旁，或在赛事详情页点开某场比赛，即可提交赛果。
          </p>
        ) : (
          <div className="space-y-3">
            {list.map((s: any) => (
              <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{s.team1Name} vs {s.team2Name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      BO{s.boType} · 总比分 {s.team1Wins} : {s.team2Wins} · {s.gameCount} 局
                      {s.note && <span> · 备注：{s.note}</span>}
                      <span className="ml-2 text-zinc-600">{new Date(s.createdAt).toLocaleString("zh-CN")}</span>
                    </p>
                  </div>
                  <span className={"rounded px-2.5 py-1 text-xs font-medium " + (STATUS_CLASS[s.status] || "")}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                </div>

                {s.rejectReason && (
                  <p className="mt-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">驳回原因：{s.rejectReason}</p>
                )}
                {s.reviewNote && (
                  <p className="mt-2 rounded bg-blue-500/10 px-3 py-2 text-xs text-blue-400">审核意见：{s.reviewNote}</p>
                )}

                {(s.screenshotPaths || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(s.screenshotPaths || []).map((p: string, i: number) => (
                      <img key={i} src={p} alt={"截图" + (i + 1)}
                        onClick={() => setEnlargedImg(p)}
                        className="h-20 w-32 cursor-pointer rounded object-cover hover:opacity-80 transition" />
                    ))}
                  </div>
                )}

                {s.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleEdit(s.id)}
                      className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-400">编辑申报</button>
                    <button onClick={() => handleCancel(s.id)}
                      className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">撤销</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {editTarget && (
        <GameRecordWizard
          mode="submission"
          tournamentId={editTarget.detail.tournamentId}
          matchId={editTarget.detail.matchId}
          team1Id={editTarget.detail.team1Id || 0}
          team2Id={editTarget.detail.team2Id || 0}
          team1Name={editTarget.detail.team1Name || "队伍1"}
          team2Name={editTarget.detail.team2Name || "队伍2"}
          initialPayload={editTarget.detail.payload}
          onClose={() => setEditTarget(null)}
          onComplete={(m) => { setMsg(m); setEditTarget(null); load(); }}
          onSubmitPayload={async (payload) => {
            await resultSubmissionApi.update(editTarget.id, { matchId: editTarget.detail.matchId, ...payload });
          }}
        />
      )}

      {enlargedImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setEnlargedImg(null)}>
          <img src={enlargedImg} className="max-h-[90vh] max-w-[90vw] rounded-lg max-md:max-h-[90dvh]" alt="enlarged" />
        </div>
      )}
    </div>
  );
}
