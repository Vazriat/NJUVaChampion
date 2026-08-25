"use client";

import React, { useEffect, useState } from "react";
import { screenshotApi, tournamentApi } from "@/lib/api";

export default function ScreenshotManager() {
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterTournamentId, setFilterTournamentId] = useState("");
  const [filterMatchIds, setFilterMatchIds] = useState("");
  const [filterTournamentName, setFilterTournamentName] = useState("");
  const [tournamentOptions, setTournamentOptions] = useState<any[]>([]);
  const [showTournamentDropdown, setShowTournamentDropdown] = useState(false);

  // Load tournament list for dropdown
  useEffect(() => {
    tournamentApi.list().then(r => setTournamentOptions(r.data.data || [])).catch(() => {});
  }, []);

  const load = (mode: string, value?: string) => {
    setLoading(true);
    setErr("");
    let params: any = {};
    if (mode === "tournamentId" && filterTournamentId) {
      params.tournamentId = Number(filterTournamentId);
    } else if (mode === "matchIds" && filterMatchIds) {
      params.matchIds = filterMatchIds;
    } else if (mode === "tournamentName" && value) {
      // Search by tournament name via backend
      screenshotApi.searchByTournamentName(value)
        .then((r: any) => {
          setScreenshots(r.data.data || []);
        }).catch((e: any) => setErr("搜索失败: " + (e.message || "")))
        .finally(() => setLoading(false));
      screenshotApi.stats().then(r => setStats(r.data.data || {})).catch(() => {});
      return;
    }
    Promise.all([
      screenshotApi.list(params),
      screenshotApi.stats(),
    ]).then(([l, s]) => {
      setScreenshots(l.data.data || []);
      setStats(s.data.data || {});
      if (l.data.code !== 200) setErr("API error: " + JSON.stringify(l.data));
    }).catch((e: any) => {
      setErr("加载失败: " + (e.message || ""));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load("all"); }, []);

  const handleDelete = async (gameId: number) => {
    if (!confirm("确定删除该截图？")) return;
    try {
      await screenshotApi.delete(gameId);
      setMsg("截图已删除");
      setTimeout(() => setMsg(""), 2000);
      load("all");
    } catch { setErr("删除失败"); }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm("确定删除选中的 " + selectedIds.size + " 张截图？")) return;
    try {
      await screenshotApi.batchDelete(Array.from(selectedIds));
      setMsg("已删除 " + selectedIds.size + " 张截图");
      setSelectedIds(new Set());
      setTimeout(() => setMsg(""), 3000);
      load("all");
    } catch { setErr("批量删除失败"); }
  };

  const handleBatchDownload = () => {
    selectedIds.forEach(id => {
      const s = screenshots.find(x => x.gameId === id);
      if (s?.screenshotPath) window.open(s.screenshotPath, "_blank");
    });
  };

  const toggleSelect = (gameId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === screenshots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(screenshots.map((s: any) => s.gameId)));
    }
  };

  const stageLabel = (s: string) => {
    const m: Record<string, string> = { WINNERS: "胜者组", LOSERS: "败者组", GRAND_FINAL: "总决赛" };
    return m[s] || s;
  };

  const selectTournament = (t: any) => {
    setFilterTournamentName(t.name);
    setFilterTournamentId(String(t.id));
    setShowTournamentDropdown(false);
    load("tournamentId", String(t.id));
  };

  return (
    <div>
      {msg && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>
      )}
      {err && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</div>
      )}

      {/* 统计 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">截图总数</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">{stats.totalFiles ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">总大小</p>
          <p className="mt-2 text-3xl font-bold text-green-400">{stats.totalMB ?? 0} MB</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">平均大小</p>
          <p className="mt-2 text-3xl font-bold text-yellow-400">
            {(stats.totalFiles > 0 ? Math.round(stats.totalMB / stats.totalFiles * 100) / 100 : 0)} MB
          </p>
        </div>
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative">
          <label className="mb-1 block text-xs text-zinc-500">赛事名</label>
          <input type="text" value={filterTournamentName}
            onChange={e => { setFilterTournamentName(e.target.value); setShowTournamentDropdown(true); }}
            onFocus={() => setShowTournamentDropdown(true)}
            placeholder="输入赛事名搜索..."
            className="w-44 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500"
          />
          {showTournamentDropdown && filterTournamentName && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-44 overflow-y-auto rounded border border-zinc-700 bg-zinc-800">
              {tournamentOptions
                .filter((t: any) => t.name.toLowerCase().includes(filterTournamentName.toLowerCase()))
                .slice(0, 10)
                .map((t: any) => (
                  <button key={t.id} onClick={() => selectTournament(t)}
                    className="block w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700">
                    {t.name} (#{t.id})
                  </button>
                ))}
              {tournamentOptions.filter((t: any) => t.name.toLowerCase().includes(filterTournamentName.toLowerCase())).length === 0 && (
                <p className="px-3 py-2 text-xs text-zinc-500">无匹配赛事</p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">比赛ID（逗号分隔）</label>
          <input type="text" value={filterMatchIds}
            onChange={e => setFilterMatchIds(e.target.value)}
            placeholder="如 221,222"
            className="w-44 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500"
          />
        </div>
        <button onClick={() => load("all")}
          className="rounded bg-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-700">刷新</button>
        <button onClick={() => { setFilterTournamentId(""); setFilterMatchIds(""); setFilterTournamentName(""); load("all"); }}
          className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:border-zinc-500">清除筛选</button>
      </div>

      {/* 批量操作 */}
      {screenshots.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={selectedIds.size === screenshots.length && screenshots.length > 0}
              onChange={toggleSelectAll} className="rounded border-zinc-600 bg-zinc-700" />
            全选（{screenshots.length}）
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-zinc-500">已选 {selectedIds.size} 张</span>
              <button onClick={handleBatchDownload}
                className="rounded border border-blue-700 px-3 py-1 text-xs text-blue-400 hover:bg-blue-600/20">下载选中</button>
              <button onClick={handleBatchDelete}
                className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除选中</button>
            </>
          )}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <p className="py-8 text-center text-zinc-500">加载中...</p>
      ) : screenshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无截图</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {screenshots.map((s: any) => (
            <div key={s.gameId} className="group relative rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="absolute left-2 top-2 z-10">
                <input type="checkbox" checked={selectedIds.has(s.gameId)}
                  onChange={() => toggleSelect(s.gameId)}
                  className="rounded border-zinc-600 bg-zinc-800 text-red-600"
                />
              </div>
              <img src={s.screenshotPath} alt={"第" + s.gameNumber + "局"}
                onClick={() => setEnlarged(s.screenshotPath)}
                className="h-40 w-full cursor-pointer object-cover bg-zinc-950 hover:opacity-80 transition"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">比赛 #{s.matchId} · 第{s.gameNumber}局</span>
                  <span className="text-xs text-zinc-600">
                    {s.fileSize > 0 ? Math.round(s.fileSize / 1024) + " KB" : "?"}
                  </span>
                </div>
                {s.tournamentName && (
                  <p className="mt-1 text-xs text-zinc-500">{s.tournamentName}</p>
                )}
                <p className="mt-0.5 text-xs text-zinc-500">
                  {s.stage ? stageLabel(s.stage) : ""}{s.round != null ? " R" + s.round : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {s.team1Name || "?"} vs {s.team2Name || "?"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  比分：{s.team1Score ?? "?"} - {s.team2Score ?? "?"}
                </p>
                <div className="mt-2 flex gap-2">
                  <a href={s.screenshotPath} target="_blank" rel="noopener noreferrer"
                    className="flex-1 rounded border border-zinc-700 py-1 text-center text-xs text-zinc-400 hover:border-zinc-500 transition">
                    下载
                  </a>
                  <button onClick={() => handleDelete(s.gameId)}
                    className="flex-1 rounded border border-red-700 py-1 text-xs text-red-400 hover:bg-red-600/20 transition">
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 大图查看 */}
      {enlarged && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setEnlarged(null)}>
          <img src={enlarged} className="max-h-[90vh] max-w-[90vw] rounded-lg" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
    </div>
  );
}
