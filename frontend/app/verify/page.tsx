"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { certificationApi, authApi } from "@/lib/api";
import { isLoggedIn, setUser } from "@/lib/auth";
import { RANKS } from "@/lib/ranks";
import { CERT_TYPES } from "@/lib/certification";
import { useConfirm } from "@/components/DialogProvider";

const CHECK = "✔";
const HOURGLASS = "⏳";
const CROSS = "✘";

/**
 * 认证材料上传的图片压缩。
 *
 * 为什么必须压：手机直出的 PNG 截图常有 3–10MB，转 base64 再 +33%，
 * 经 nginx（默认 client_max_body_size 1m）会直接被 413 拦掉；
 * 就算放行，端到端也要几十秒，前端请求会超时。
 *
 * 策略：
 *  - 原图 ≤ 1.2MB 直接传，避免无谓重编码
 *  - 否则长边缩到 1600px，先试 PNG；仍超 3MB（≈2.2MB 原图）再转 JPEG 0.85
 *  - 压缩结果反而更大（少见）就退回原图
 */
const MAX_EDGE = 1600;
const DIRECT_LIMIT = 1.2 * 1024 * 1024;
const MAX_BASE64_LEN = 3 * 1024 * 1024;

const readAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("图片读取失败"));
    fr.readAsDataURL(file);
  });

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片解析失败")); };
    img.src = url;
  });

const fileToDataUrl = async (file: File): Promise<string> => {
  const raw = await readAsDataURL(file);
  // 非位图（gif/svg）与体积本就不大的图，原样上传
  if (file.size <= DIRECT_LIMIT) return raw;
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return raw;
  }
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    // 铺白底：PNG 透明背景直接转 JPEG 会变黑
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let out = canvas.toDataURL("image/png");
    if (out.length > MAX_BASE64_LEN) out = canvas.toDataURL("image/jpeg", 0.85);
    return out.length < raw.length ? out : raw;
  } catch {
    return raw;
  }
};

const identitySubTypes = CERT_TYPES
  .filter((t) => t.group === "identity")
  .map((t) => ({ type: t.code, label: t.label }));

export default function VerifyPage() {
  const ask = useConfirm();
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [rankPublic, setRankPublic] = useState(false);
  const [updatingRank, setUpdatingRank] = useState(false);
  const [required, setRequired] = useState(false);
  const requiredRef = useRef(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const isRequired = new URLSearchParams(window.location.search).get("required") === "1";
    requiredRef.current = isRequired;
    setRequired(isRequired);
    if (isRequired) setExpanded("identity");
    if (!isLoggedIn()) { router.replace("/login"); return; }
    load();
    authApi.getProfile().then(r => setRankPublic(r.data.data?.rankPublic || false)).catch(() => {});
    if (isRequired) {
      const timer = setInterval(() => load(true), 5000);
      return () => clearInterval(timer);
    }
  }, []);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    certificationApi.my().then(r => {
      const records = r.data.data || [];
      setRecords(records);
      if (requiredRef.current) {
        const approved = records.find((rec: any) =>
          (rec.type === "STUDENT" || rec.type === "ALUMNI") && rec.status === "APPROVED");
        if (approved) {
          authApi.getProfile().then(p => {
            setUser(p.data.data);
            router.replace("/dashboard");
          }).catch(() => {});
        }
      }
    }).catch(() => {}).finally(() => { if (!silent) setLoading(false); });
  };

  const getRec = (type: string) => records.find((r: any) => r.type === type);

  const handleApply = async () => {
    const type = form._type || "";
    if (!type || applying) return;
    setApplying(true);
    const body: any = { type, description: form[type + "_desc"] || "" };
    if (type === "STUDENT") {
      body.studentName = form[type + "_name"] || ""; body.studentId = form[type + "_id"] || "";
      const f = form[type + "_xuexin"] as File | undefined;
      if (f) body.xuexinBase64 = await fileToDataUrl(f);
    }
    if (type === "STUDENT" || type === "ALUMNI") {
      body.enrollmentYear = form[type + "_year"] ? Number(form[type + "_year"]) : null;
    }
    if (type === "RANK") {
      body.rank = form[type + "_rank"] || "";
      const files = (form[type + "_evidence"] as File[]) || [];
      if (files.length > 0) body.evidenceBase64s = await Promise.all(files.map(f => fileToDataUrl(f)));
    }
    if (type === "ALUMNI") {
      const files = (form[type + "_evidence"] as File[]) || [];
      body.evidenceBase64s = await Promise.all(files.map(f => fileToDataUrl(f)));
    }
    try {
      await certificationApi.apply(body);
      setMsg("申请已提交");
      setMsgError(false);
      setExpanded(null);
      setUpdatingRank(false);
      load();
    } catch (err: any) {
      // 网关层拦截（413/502）不会返回 Result 结构，给一句能看懂的话
      const status = err.response?.status;
      if (status === 413) {
        setMsg("图片太大，上传被服务器拒绝，请压缩后重试");
        setMsgError(true);
      } else if (!err.response) {
        setMsg("上传超时或网络中断，请检查网络后重试");
        setMsgError(true);
      } else {
        setMsg(err.response?.data?.message || "失败");
        setMsgError(true);
      }
    } finally {
      setApplying(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await ask({ title: "删除认证信息", message: "确定删除该认证申请？", okText: "确认删除", danger: true });
    if (!ok) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/certification/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
      setMsg("已删除"); setMsgError(false); load();
    } catch { setMsg("删除失败"); setMsgError(true); }
  };

  const statusBadge = (rec: any) => {
    if (!rec) return <span className="text-zinc-600">— 未申请</span>;
    if (rec.status === "APPROVED") return <span className="text-green-400">{CHECK} 已通过</span>;
    if (rec.status === "PENDING") return <span className="text-yellow-400">{HOURGLASS} 审核中</span>;
    if (rec.status === "REJECTED" || rec.status === "DELETED") return <span className="text-red-400">{CROSS} 已驳回</span>;
    return <span className="text-zinc-600">— 未申请</span>;
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh"><NavBar /><main className="mx-auto max-w-xl px-8 py-10 max-md:px-4 max-md:py-8"><p className="text-zinc-500">加载中...</p></main></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-xl px-8 py-10 max-md:px-4 max-md:py-8">
        <h2 className="mb-6 text-2xl font-bold">选手认证</h2>
        {required && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            请先完成在校生或校友身份认证，认证通过后方可使用平台其他功能。审核通过后将自动解锁。
          </div>
        )}
        {msg && (
          <div className={"mb-4 rounded-lg px-4 py-3 text-sm " + (msgError ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400")}>
            {msg}
          </div>
        )}

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
                          {st.type === "STUDENT" && <p className="text-xs text-zinc-400">{rec.studentName} · {rec.studentId}{rec.enrollmentYear ? " · " + rec.enrollmentYear + " 年入学" : ""}</p>}
                          {st.type === "ALUMNI" && rec.enrollmentYear && <p className="text-xs text-zinc-400">{rec.enrollmentYear} 年入学</p>}
                          <button onClick={() => handleDelete(rec.id)}
                            className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20 max-md:px-4 max-md:py-2.5 max-md:text-sm">删除认证</button>
                        </div>
                      )}
                      {rec?.status === "REJECTED" && <p className="mt-1 text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                      {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && st.type === "STUDENT" && (
                        <div className="mt-2 space-y-2">
                          <input value={form[st.type + "_name"] || ""} onChange={e => setForm({...form, [st.type + "_name"]: e.target.value, _type: st.type})}
                            placeholder="姓名" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <input value={form[st.type + "_id"] || ""} onChange={e => setForm({...form, [st.type + "_id"]: e.target.value, _type: st.type})}
                            placeholder="学号" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <input type="number" min="1900" max={new Date().getFullYear() + 1}
                            value={form[st.type + "_year"] || ""} onChange={e => setForm({...form, [st.type + "_year"]: e.target.value, _type: st.type})}
                            placeholder="入学年份（如 2023）" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <input type="file" accept="image/*" onChange={e => setForm({...form, [st.type + "_xuexin"]: e.target.files?.[0], _type: st.type})}
                            className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white max-md:text-sm max-md:file:py-2" />
                          <textarea value={form[st.type + "_desc"] || ""} onChange={e => setForm({...form, [st.type + "_desc"]: e.target.value, _type: st.type})}
                            placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <button onClick={handleApply} disabled={applying} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:py-3 max-md:text-sm">{applying ? "提交中..." : "提交申请"}</button>
                        </div>
                      )}
                      {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && st.type === "ALUMNI" && (
                        <div className="mt-2 space-y-2">
                          <input type="number" min="1900" max={new Date().getFullYear() + 1}
                            value={form[st.type + "_year"] || ""} onChange={e => setForm({...form, [st.type + "_year"]: e.target.value, _type: st.type})}
                            placeholder="入学年份（如 2023）" className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <input type="file" accept="image/*" multiple onChange={e => setForm({...form, [st.type + "_evidence"]: Array.from(e.target.files || []), _type: st.type})}
                            className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white max-md:text-sm max-md:file:py-2" />
                          <textarea value={form[st.type + "_desc"] || ""} onChange={e => setForm({...form, [st.type + "_desc"]: e.target.value, _type: st.type})}
                            placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                          <button onClick={handleApply} disabled={applying} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:py-3 max-md:text-sm">{applying ? "提交中..." : "提交申请"}</button>
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
                          className="flex-1 rounded border border-blue-700 px-3 py-1 text-xs text-blue-400 hover:bg-blue-600/20 max-md:py-2.5 max-md:text-sm">更新段位</button>
                        <button onClick={() => handleDelete(rec.id)}
                          className="flex-1 rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20 max-md:px-4 max-md:py-2.5 max-md:text-sm">删除认证</button>
                      </div>
                    </div>
                  )}
                  {rec?.status === "REJECTED" && <p className="text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                  {(!rec || rec.status === "REJECTED" || rec.status === "DELETED" || updatingRank) && rec?.status !== "PENDING" && (
                    <div className="space-y-2">
                      {rec?.status === "APPROVED" && (
                        <button onClick={() => setUpdatingRank(false)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition max-md:py-2.5 max-md:text-sm">取消更新</button>
                      )}
                      <select value={form["RANK_rank"] || ""} onChange={e => setForm({...form, "RANK_rank": e.target.value, _type: "RANK"})}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base">
                        <option value="" disabled>请选择段位</option>
                        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input type="file" accept="image/*" multiple onChange={e => setForm({...form, "RANK_evidence": Array.from(e.target.files || [])})}
                        className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white max-md:text-sm max-md:file:py-2" />
                      <textarea value={form["RANK_desc"] || ""} onChange={e => setForm({...form, "RANK_desc": e.target.value})}
                        placeholder="说明" rows={2} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                      <button onClick={handleApply} disabled={applying} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:py-3 max-md:text-sm">{applying ? "提交中..." : "提交申请"}</button>
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
                        className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-600/20 max-md:px-4 max-md:py-2.5 max-md:text-sm">删除认证</button>
                    </div>
                  )}
                  {rec?.status === "REJECTED" && <p className="text-xs text-red-400">{rec.rejectReason || "无原因"}</p>}
                  {(!rec || rec.status === "REJECTED" || rec.status === "DELETED") && (
                    <div className="space-y-2">
                      <textarea value={form["REFEREE_desc"] || ""} onChange={e => setForm({...form, "REFEREE_desc": e.target.value, _type: "REFEREE"})}
                        placeholder="说明（如裁判经验、资质等）" rows={3}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:py-2.5 max-md:text-base" />
                      <button onClick={handleApply} disabled={applying} className="w-full rounded-lg bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 max-md:py-3 max-md:text-sm">{applying ? "提交中..." : "提交申请"}</button>
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