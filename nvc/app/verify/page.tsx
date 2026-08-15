"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { certificationApi, authApi } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { RANKS } from "@/lib/ranks";
import { CERT_TYPES } from "@/lib/certification";

const CHECK = "✔";
const HOURGLASS = "⏳";
const CROSS = "✘";

const identitySubTypes = CERT_TYPES
  .filter((t) => t.group === "identity")
  .map((t) => ({ type: t.code, label: t.label }));

export default function VerifyPage() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [rankPublic, setRankPublic] = useState(false);
  const [updatingRank, setUpdatingRank] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    load();
    authApi.getProfile().then(r => setRankPublic(r.data.data?.rankPublic || false)).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    certificationApi.my().then(r => setRecords(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  const getRec = (type: string) => records.find((r: any) => r.type === type);

  const toBase64 = (file: File): Promise<string> => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(file); });

  const handleApply = async () => {
    const type = form._type || "";
    if (!type) return;
    const body: any = { type, description: form[type + "_desc"] || "" };
    if (type === "STUDENT") {
      body.studentName = form[type + "_name"] || ""; body.studentId = form[type + "_id"] || "";
      const f = form[type + "_xuexin"] as File | undefined;
      if (f) body.xuexinBase64 = await toBase64(f);
    }
    if (type === "RANK") {
      body.rank = form[type + "_rank"] || "";
      const files = (form[type + "_evidence"] as File[]) || [];
      if (files.length > 0) body.evidenceBase64s = await Promise.all(files.map(f => toBase64(f)));
    }
    if (type === "ALUMNI") {
      const files = (form[type + "_evidence"] as File[]) || [];
      body.evidenceBase64s = await Promise.all(files.map(f => toBase64(f)));
    }
    try {
      await certificationApi.apply(body);
      setMsg("申请已提交");
      setExpanded(null);
      setUpdatingRank(false);
      load();
    } catch (err: any) { setMsg(err.response?.data?.message || "失败"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除？")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/certification/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      setMsg("已删除"); load();
    } catch { setMsg("删除失败"); }
  };

  const statusBadge = (rec: any) => {
    if (!rec) return <span className="text-zinc-600">— 未申请</span>;
    if (rec.status === "APPROVED") return <span className="text-green-400">{CHECK} 已通过</span>;
    if (rec.status === "PENDING") return <span className="text-yellow-400">{HOURGLASS} 审核中</span>;
    if (rec.status === "REJECTED" || rec.status === "DELETED") return <span className="text-red-400">{CROSS} 已驳回</span>;
    return <span className="text-zinc-600">— 未申请</span>;
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white"><NavBar /><main className="mx-auto max-w-xl px-8 py-10"><p className="text-zinc-500">加载中...</p></main></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <NavBar />
      <main className="mx-auto max-w-xl px-8 py-10">
        <h2 className="mb-6 text-2xl font-bold">选手认证</h2>
        {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}

        <div className="space-y-4">
          {/* 身份认证 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button onClick={() => setExpanded(expanded === "identity" ? null : "identity")}
              className="flex w-full items-center justify-between p-4 text-left transition hover:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎓</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">身份认证</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {(() => {
                      const approved = identitySubTypes.find(st => getRec(st.type)?.status === "APPROVED");
                      const types = approved ? [approved] : identitySubTypes;
                      return types.map(st => {
                        const r = getRec(st.type);
                        return <span key={st.type} className="mr-3">{st.label}: {statusBadge(r)}</span>;
                      });
                    })()}
                  </p>
                </div>
              </div>
              <span className="text-xs text-zinc-600">{expanded === "identity" ? "收起" : "管理"}</span>
            </button>

            {expanded === "identity" && (
              <div className="border-t border-zinc-800 px-4 py-4 space-y-4">
                {identitySubTypes.filter(st => {
                    const approved = identitySubTypes.find(s => getRec(s.type)?.status === "APPROVED");
                    return !approved || approved.type === st.type;
                  }).map(st => {
                  const rec = getRec(st.type);
                  return (
                    <div key={st.type} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
                      <p className="text-xs font-semibold text-zinc-400 mb-2">{st.label}认证</p>
                      {statusBadge(rec)}
                      {rec?.status === "APPROVED" && (
                        <div className="mt-2 space-y-2">
                          {st.type === "STUDENT" && <p className="text-xs text-zinc-400">{rec.studentName} · {rec.studentId}</p>}
                          <button onClick={() => handleDelete(rec.id)}
                            className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除认证</button>
                        </div>
                      )}
                      {rec?.status === "REJECTED" && <p className="mt-1 text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                      {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && st.type === "STUDENT" && (
                        <div className="mt-2 space-y-2">
                          <input value={form[st.type + "_name"] || ""} onChange={e => setForm({...form, [st.type + "_name"]: e.target.value, _type: st.type})}
                            placeholder="姓名" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                          <input value={form[st.type + "_id"] || ""} onChange={e => setForm({...form, [st.type + "_id"]: e.target.value, _type: st.type})}
                            placeholder="学号" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                          <input type="file" accept="image/*" onChange={e => setForm({...form, [st.type + "_xuexin"]: e.target.files?.[0], _type: st.type})}
                            className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" />
                          <textarea value={form[st.type + "_desc"] || ""} onChange={e => setForm({...form, [st.type + "_desc"]: e.target.value, _type: st.type})}
                            placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                          <button onClick={handleApply} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700">提交申请</button>
                        </div>
                      )}
                      {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && st.type === "ALUMNI" && (
                        <div className="mt-2 space-y-2">
                          <input type="file" accept="image/*" multiple onChange={e => setForm({...form, [st.type + "_evidence"]: Array.from(e.target.files || []), _type: st.type})}
                            className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" />
                          <textarea value={form[st.type + "_desc"] || ""} onChange={e => setForm({...form, [st.type + "_desc"]: e.target.value, _type: st.type})}
                            placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                          <button onClick={handleApply} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700">提交申请</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 段位认证 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button onClick={() => setExpanded(expanded === "rank" ? null : "rank")}
              className="flex w-full items-center justify-between p-4 text-left transition hover:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">段位认证</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{statusBadge(getRec("RANK"))}</p>
                </div>
              </div>
              <span className="text-xs text-zinc-600">{expanded === "rank" ? "收起" : "管理"}</span>
            </button>

            {expanded === "rank" && (() => {
              const rec = getRec("RANK");
              return (
                <div className="border-t border-zinc-800 px-4 py-4 space-y-3">
                  {rec?.status === "APPROVED" && (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-400">段位：{rec.rank}</p>
                      <p className="text-xs text-zinc-500">
                        申请日期：{rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("zh-CN") : "-"}
                        {" · "}认证日期：{rec.reviewedAt ? new Date(rec.reviewedAt).toLocaleDateString("zh-CN") : "-"}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={rankPublic}
                          onChange={async e => {
                            const val = e.target.checked;
                            setRankPublic(val);
                            try {
                              const token = localStorage.getItem("token");
                              await fetch("/api/user/contact", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                                body: JSON.stringify({ rankPublic: val }),
                              });
                            } catch {}
                          }}
                          className="rounded border-zinc-600 bg-zinc-800 text-red-600" />
                        <span className="text-xs text-zinc-400">对外展示段位</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => { setUpdatingRank(true); setForm({ ...form, _type: "RANK" }); }}
                          className="flex-1 rounded border border-blue-700 px-3 py-1 text-xs text-blue-400 hover:bg-blue-600/20">更新段位</button>
                        <button onClick={() => handleDelete(rec.id)}
                          className="flex-1 rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除认证</button>
                      </div>
                    </div>
                  )}
                  {rec?.status === "REJECTED" && <p className="text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                  {(!rec || rec.status === "REJECTED" || rec.status === "DELETED" || updatingRank) && rec?.status !== "PENDING" && (
                    <div className="space-y-2">
                      {rec?.status === "APPROVED" && (
                        <button onClick={() => setUpdatingRank(false)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition">取消更新</button>
                      )}
                      <select value={form["RANK_rank"] || ""} onChange={e => setForm({...form, "RANK_rank": e.target.value, _type: "RANK"})}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500">
                        <option value="" disabled>请选择段位</option>
                        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input type="file" accept="image/*" multiple onChange={e => setForm({...form, "RANK_evidence": Array.from(e.target.files || [])})}
                        className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" />
                      <textarea value={form["RANK_desc"] || ""} onChange={e => setForm({...form, "RANK_desc": e.target.value})}
                        placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                      <button onClick={handleApply} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700">提交申请</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 裁判认证 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <button onClick={() => setExpanded(expanded === "referee" ? null : "referee")}
              className="flex w-full items-center justify-between p-4 text-left transition hover:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚖️</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">裁判认证</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{statusBadge(getRec("REFEREE"))}</p>
                </div>
              </div>
              <span className="text-xs text-zinc-600">{expanded === "referee" ? "收起" : "管理"}</span>
            </button>

            {expanded === "referee" && (() => {
              const rec = getRec("REFEREE");
              return (
                <div className="border-t border-zinc-800 px-4 py-4 space-y-3">
                  {rec?.status === "APPROVED" && (
                    <div className="space-y-2">
                      {rec.description && <p className="text-xs text-zinc-400">{rec.description}</p>}
                      <button onClick={() => handleDelete(rec.id)}
                        className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20">删除认证</button>
                    </div>
                  )}
                  {rec?.status === "REJECTED" && <p className="text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                  {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && (
                    <div className="space-y-2">
                      <textarea value={form["REFEREE_desc"] || ""} onChange={e => setForm({...form, "REFEREE_desc": e.target.value, _type: "REFEREE"})}
                        placeholder="说明（如裁判经验、资质等）" rows={3}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500" />
                      <button onClick={handleApply} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700">提交申请</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}