"use client";

import React, { useEffect, useMemo, useState } from "react";
import { adminCertificationApi } from "@/lib/api";
import { CERT_TYPES, certTypeLabel } from "@/lib/certification";
import { RANKS } from "@/lib/ranks";

/** 状态筛选项。code 为空代表「全部」，此时包含 SUPERSEDED / DELETED 等历史状态。 */
const STATUS_TABS: { code: string; label: string }[] = [
  { code: "", label: "全部" },
  { code: "PENDING", label: "待审核" },
  { code: "APPROVED", label: "已通过" },
  { code: "REJECTED", label: "已驳回" },
  { code: "REVOKED", label: "已取消" },
];

/** 类型筛选项，顺序与后端 CertificationType 枚举、前端 CERT_TYPES 保持一致。 */
const TYPE_TABS: { code: string; label: string }[] = [
  { code: "", label: "全部类型" },
  ...CERT_TYPES.map((t) => ({ code: t.code, label: t.label })),
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  REVOKED: "已取消",
  SUPERSEDED: "已更新",
  DELETED: "已删除",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-yellow-400 bg-yellow-500/10",
  APPROVED: "text-green-400 bg-green-500/10",
  REJECTED: "text-red-400 bg-red-500/10",
  REVOKED: "text-zinc-400 bg-zinc-800",
  SUPERSEDED: "text-zinc-400 bg-zinc-800",
  DELETED: "text-zinc-500 bg-zinc-800",
};

const TYPE_COLOR: Record<string, string> = {
  STUDENT: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  ALUMNI: "border-teal-500/40 bg-teal-500/10 text-teal-400",
  RANK: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  REFEREE: "border-purple-500/40 bg-purple-500/10 text-purple-400",
};

export default function CertificationManager() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // 一次拉全量：数据量在校级赛事平台可控，换来无刷新切换筛选 + 各维度实时计数
  const load = () => {
    setLoading(true);
    setErr("");
    adminCertificationApi.list()
      .then((r) => setRecords(r.data.data || []))
      .catch((e: any) =>
        setErr("加载失败：" + (e.response?.data?.message || e.message || "未知错误"))
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /** 关键词过滤：用户名 / 姓名 / 学号 / 游戏 ID */
  const matched = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return records;
    return records.filter((r) =>
      [r.username, r.studentName, r.studentId, r.displayGameId, r.gameId]
        .some((v) => (v == null ? "" : String(v).toLowerCase().includes(kw)))
    );
  }, [records, keyword]);

  // 计数规则：计算某一维度时套用另一维度已生效的筛选，这样 chip 上的数字就是点进去能看到的条数
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    matched.forEach((r) => {
      if (typeFilter && r.type !== typeFilter) return;
      m[r.status] = (m[r.status] || 0) + 1;
    });
    return m;
  }, [matched, typeFilter]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    matched.forEach((r) => {
      if (statusFilter && r.status !== statusFilter) return;
      m[r.type] = (m[r.type] || 0) + 1;
    });
    return m;
  }, [matched, statusFilter]);

  const visible = useMemo(() => {
    return matched
      .filter((r) => (!statusFilter || r.status === statusFilter) && (!typeFilter || r.type === typeFilter))
      // 待审核始终置顶，其余按申请时间倒序
      .sort((a, b) => {
        const ap = a.status === "PENDING" ? 0 : 1;
        const bp = b.status === "PENDING" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [matched, statusFilter, typeFilter]);

  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const backlog = records.filter((r) => r.status === "PENDING").length;
  const hasFilter = !!(statusFilter || typeFilter || keyword.trim());
  const clearFilters = () => { setStatusFilter(""); setTypeFilter(""); setKeyword(""); };

  const chipCls = (active: boolean) =>
    "flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition " +
    (active
      ? "border-red-500 bg-red-600/20 text-red-400"
      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200");

  const countCls = (active: boolean) =>
    "rounded px-1.5 text-[11px] tabular-nums " +
    (active ? "bg-red-500/20 text-red-300" : "bg-zinc-700/60 text-zinc-400");

  const handleApprove = async (id: number) => {
    try {
      const body: any = {};
      if (rankInput) body.rank = rankInput;
      await adminCertificationApi.approve(id, body);
      setMsg("已通过"); setTimeout(() => setMsg(""), 2000); setSelected(null); load();
    } catch { setMsg("操作失败"); }
  };

  const handleReject = async () => {
    if (!selected) return;
    try { await adminCertificationApi.reject(selected.id, rejectReason); setMsg("已驳回"); setTimeout(() => setMsg(""), 2000); setShowReject(false); setSelected(null); load(); }
    catch { setMsg("操作失败"); }
  };

  return (
    <div>
      {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}
      {err && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</div>}

      {/* ===== 筛选面板 ===== */}
      <div className="mb-5 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-zinc-500">状态</span>
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.code;
            const count = t.code ? (statusCounts[t.code] || 0) : sum(statusCounts);
            // 有积压时把「待审核」标黄，提示待办
            const backlogHint = t.code === "PENDING" && count > 0 && !active;
            return (
              <button key={t.code || "ALL"} onClick={() => setStatusFilter(t.code)}
                className={chipCls(active) + (backlogHint ? " border-yellow-500/50 text-yellow-400" : "")}>
                {t.label}
                <span className={countCls(active)}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-zinc-500">类型</span>
          {TYPE_TABS.map((t) => {
            const active = typeFilter === t.code;
            const count = t.code ? (typeCounts[t.code] || 0) : sum(typeCounts);
            return (
              <button key={t.code || "ALLTYPE"} onClick={() => setTypeFilter(t.code)}
                className={chipCls(active)}>
                {t.label}
                <span className={countCls(active)}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3">
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索用户名 / 姓名 / 学号 / 游戏 ID"
            className="w-72 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-red-500" />
          <span className="text-xs text-zinc-500">
            共 <span className="text-zinc-300">{visible.length}</span> 条
          </span>
          {backlog > 0 && <span className="text-xs text-yellow-400">待审核 {backlog} 条</span>}
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-white">清除筛选</button>
          )}
        </div>
      </div>

      {/* ===== 列表 ===== */}
      {loading ? (
        <p className="py-8 text-center text-zinc-500">加载中...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">{hasFilter ? "没有符合筛选条件的认证申请" : "暂无认证记录"}</p>
          {hasFilter && (
            <button onClick={clearFilters} className="mt-3 text-xs text-red-400 hover:text-red-300">清除筛选条件</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r: any) => {
            const meta = [
              r.displayGameId || r.gameId,
              r.studentName,
              r.studentId,
              r.enrollmentYear ? r.enrollmentYear + " 年入学" : null,
              r.type === "RANK" ? r.rank : null,
            ].filter(Boolean).join(" · ");
            return (
              <div key={r.id}
                onClick={() => { setSelected(r); setShowReject(false); setRankInput(r.rank || ""); }}
                className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-300">{r.username || ("用户 #" + r.userId)}</p>
                    {meta && <p className="mt-0.5 truncate text-xs text-zinc-500">{meta}</p>}
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      申请：{r.createdAt ? new Date(r.createdAt).toLocaleDateString("zh-CN") : "-"}
                      {" · "}认证：{r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString("zh-CN") : "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={"rounded border px-2 py-0.5 text-[11px] font-medium " + (TYPE_COLOR[r.type] || "border-zinc-700 bg-zinc-800 text-zinc-400")}>
                      {certTypeLabel(r.type)}
                    </span>
                    <span className={"rounded px-2 py-0.5 text-xs font-medium " + (STATUS_COLOR[r.status] || "bg-zinc-800 text-zinc-400")}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 详情弹窗 ===== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">认证详情</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-zinc-500">用户：</span><span className="text-zinc-300">{selected.username || ("#" + selected.userId)}</span></div>
              {selected.displayGameId && <div><span className="text-zinc-500">游戏 ID：</span><span className="text-zinc-300">{selected.displayGameId}</span></div>}
              <div>
                <span className="text-zinc-500">类型：</span>
                <span className={"ml-1 rounded border px-2 py-0.5 text-[11px] font-medium " + (TYPE_COLOR[selected.type] || "border-zinc-700 bg-zinc-800 text-zinc-400")}>
                  {certTypeLabel(selected.type)}
                </span>
              </div>
              <div><span className="text-zinc-500">状态：</span><span className={"font-medium " + (selected.status === "APPROVED" ? "text-green-400" : selected.status === "REJECTED" ? "text-red-400" : "text-yellow-400")}>{STATUS_LABEL[selected.status] || selected.status}</span></div>
              <div><span className="text-zinc-500">申请时间：</span><span className="text-zinc-300">{selected.createdAt ? new Date(selected.createdAt).toLocaleString("zh-CN") : "-"}</span></div>
              <div><span className="text-zinc-500">认证时间：</span><span className="text-zinc-300">{selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString("zh-CN") : "-"}</span></div>
              {selected.studentName && <div><span className="text-zinc-500">姓名：</span><span className="text-zinc-300">{selected.studentName}</span></div>}
              {selected.type === "RANK" && selected.rank && <div><span className="text-zinc-500">申请段位：</span><span className="text-zinc-300">{selected.rank}</span></div>}
              {selected.type !== "RANK" && selected.studentId && <div><span className="text-zinc-500">学号：</span><span className="text-zinc-300">{selected.studentId}</span></div>}
              {selected.enrollmentYear && <div><span className="text-zinc-500">入学年份：</span><span className="text-zinc-300">{selected.enrollmentYear}</span></div>}
              {selected.status === "APPROVED" && selected.rank && <div><span className="text-zinc-500">已认证段位：</span><span className="text-zinc-300">{selected.rank}</span></div>}
              {selected.description && <div><span className="text-zinc-500">说明：</span><p className="mt-1 text-zinc-300">{selected.description}</p></div>}
              {selected.rejectReason && <div><span className="text-zinc-500">驳回原因：</span><span className="text-red-400">{selected.rejectReason}</span></div>}

              {selected.xuexinPath && (
                <div>
                  <p className="mb-1 text-zinc-500">学信网截图：</p>
                  <img src={selected.xuexinPath} onClick={() => setEnlargedImg(selected.xuexinPath)} className="max-h-48 rounded object-contain bg-zinc-950 cursor-pointer hover:opacity-80" alt="xuexin" />
                </div>
              )}

              {selected.evidencePaths && selected.evidencePaths !== "[]" && (
                <div>
                  <p className="mb-1 text-zinc-500">证明材料：</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      try { return JSON.parse(selected.evidencePaths); } catch { return []; }
                    })().map((p: string, i: number) => (
                      <img key={i} src={p} onClick={() => setEnlargedImg(p)} className="max-h-32 rounded object-contain bg-zinc-950 cursor-pointer hover:opacity-80" alt={"evidence " + i} />
                    ))}
                  </div>
                </div>
              )}

              {selected.status === "APPROVED" && (
                <div className="mt-4">
                  <button onClick={async () => {
                    if (!confirm("确定取消该用户的认证？")) return;
                    try { await adminCertificationApi.revoke(selected.id); setMsg("已取消认证"); setTimeout(() => setMsg(""), 2000); setSelected(null); load(); }
                    catch { setMsg("操作失败"); }
                  }}
                    className="w-full rounded-lg border border-red-700 py-2 text-sm font-semibold text-red-400 hover:bg-red-600/20">取消认证</button>
                </div>
              )}
              {selected.status === "PENDING" && selected.type === "RANK" && (
                <div className="mt-4 mb-3">
                  <select value={rankInput} onChange={e => setRankInput(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500">
                    <option value="" disabled>选择段位</option>
                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              {selected.status === "PENDING" && (
                <div className="mt-4 flex gap-3">
                  <button onClick={() => handleApprove(selected.id)}
                    className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold hover:bg-green-700">通过</button>
                  <button onClick={() => setShowReject(true)}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">驳回</button>
                </div>
              )}

              {showReject && (
                <div className="mt-3 space-y-2">
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                    rows={2} placeholder="填写驳回原因..." />
                  <button onClick={handleReject} disabled={!rejectReason.trim()}
                    className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold disabled:opacity-50">确认驳回</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {enlargedImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setEnlargedImg(null)}>
          <img src={enlargedImg} className="max-h-[90vh] max-w-[90vw] rounded-lg" alt="" />
        </div>
      )}
    </div>
  );
}
