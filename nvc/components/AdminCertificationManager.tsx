"use client";

import React, { useEffect, useState } from "react";
import { adminCertificationApi } from "@/lib/api";
import { certTypeLabel } from "@/lib/certification";
import { RANKS } from "@/lib/ranks";

export default function CertificationManager() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rankInput, setRankInput] = useState("");
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    setErr("");
    adminCertificationApi.list(filter || undefined)
      .then(r => {
        setRecords(r.data.data || []);
        if (r.data.code !== 200) setErr("API返回: " + JSON.stringify(r.data));
      })
      .catch((e: any) => {
        setErr("加载失败: " + (e.message || "") + " - " + JSON.stringify(e.response?.data || {}));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const statusLabel: Record<string, string> = { PENDING: "待审核", APPROVED: "已通过", REJECTED: "已驳回", REVOKED: "已取消" };
  const statusColor: Record<string, string> = { PENDING: "text-yellow-400 bg-yellow-500/10", APPROVED: "text-green-400 bg-green-500/10", REJECTED: "text-red-400 bg-red-500/10", REVOKED: "text-zinc-400 bg-zinc-800" };

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

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED", "REVOKED"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={"rounded border px-3 py-1.5 text-xs font-medium transition " + (filter === s ? "border-red-500 bg-red-600/20 text-red-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600")}>
            {s ? statusLabel[s] || s : "全部"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="py-8 text-center text-zinc-500">加载中...</p>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无认证记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r: any) => (
            <div key={r.id}
              onClick={() => { setSelected(r); setShowReject(false);
    setRankInput(r.rank || ""); }}
              className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-300">用户 #{r.userId}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{certTypeLabel(r.type)}{r.studentName ? " · " + r.studentName : ""}</p>
                </div>
                <span className={"rounded px-2 py-0.5 text-xs font-medium " + (statusColor[r.status] || "bg-zinc-800 text-zinc-400")}>
                  {statusLabel[r.status] || r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">认证详情</h3>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-zinc-500">用户 ID：</span><span className="text-zinc-300">{selected.userId}</span></div>
              <div><span className="text-zinc-500">类型：</span><span className="text-zinc-300">{certTypeLabel(selected.type)}</span></div>
              <div><span className="text-zinc-500">状态：</span><span className={"font-medium " + (selected.status === "APPROVED" ? "text-green-400" : selected.status === "REJECTED" ? "text-red-400" : "text-yellow-400")}>{statusLabel[selected.status]}</span></div>
              {selected.studentName && <div><span className="text-zinc-500">姓名：</span><span className="text-zinc-300">{selected.studentName}</span></div>}
              {selected.type === "RANK" && selected.rank && <div><span className="text-zinc-500">申请段位：</span><span className="text-zinc-300">{selected.rank}</span></div>}
              {selected.type !== "RANK" && selected.studentId && <div><span className="text-zinc-500">学号：</span><span className="text-zinc-300">{selected.studentId}</span></div>}
              {selected.rank && <div><span className="text-zinc-500">已认证段位：</span><span className="text-zinc-300">{selected.rank}</span></div>}
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
