"use client";

import React, { useEffect, useState } from "react";
import { tournamentAnnouncementApi, adminTournamentAnnouncementApi } from "@/lib/api";

interface TournamentNotificationManagerProps {
  tournamentId: number;
  canManage?: boolean;
}

export default function TournamentNotificationManager({
  tournamentId,
  canManage = false,
}: TournamentNotificationManagerProps) {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<any>({ title: "", content: "", priority: "NORMAL", status: "DRAFT" });

  const load = () => {
    setLoading(true);
    const req = canManage
      ? adminTournamentAnnouncementApi.list(tournamentId)
      : tournamentAnnouncementApi.listByTournament(tournamentId);
    req
      .then((r) => setNotices(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, canManage]);

  const openNew = () => {
    setEdit({ title: "", content: "", priority: "NORMAL", status: "DRAFT" });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEdit({ ...a });
    setShowForm(true);
  };

  const save = async () => {
    try {
      if (edit.id) {
        await adminTournamentAnnouncementApi.update(tournamentId, edit.id, edit);
      } else {
        await adminTournamentAnnouncementApi.create(tournamentId, edit);
      }
      setMsg("保存成功");
      setTimeout(() => setMsg(""), 2000);
      setShowForm(false);
      load();
    } catch {
      setMsg("保存失败");
    }
  };

  const publish = async (id: number) => {
    try {
      await adminTournamentAnnouncementApi.publish(tournamentId, id);
      setMsg("已发布");
      setTimeout(() => setMsg(""), 2000);
      load();
    } catch {
      setMsg("发布失败");
    }
  };

  const del = async (id: number) => {
    if (!confirm("确定删除？")) return;
    try {
      await adminTournamentAnnouncementApi.delete(tournamentId, id);
      setMsg("已删除");
      setTimeout(() => setMsg(""), 2000);
      load();
    } catch {
      setMsg("删除失败");
    }
  };

  const stL: Record<string, string> = { DRAFT: "草稿", PUBLISHED: "已发布" };
  const stC: Record<string, string> = {
    DRAFT: "bg-zinc-700 text-zinc-400",
    PUBLISHED: "bg-green-500/10 text-green-400",
  };

  return (
    <div>
      {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">赛事通知</h2>
        {canManage && (
          <button
            onClick={openNew}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-700"
          >
            + 新增通知
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-zinc-500">加载中...</p>
      ) : notices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
          暂无通知
        </p>
      ) : (
        <div className="space-y-3">
          {notices.map((n: any) => (
            <div key={n.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {n.priority === "IMPORTANT" && <span className="text-yellow-400">⚠</span>}
                  <div>
                    <p className={"font-medium " + (n.priority === "IMPORTANT" ? "text-yellow-300" : "text-zinc-200")}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {n.publishedAt ? new Date(n.publishedAt).toLocaleString("zh-CN") : "未发布"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium " + (stC[n.status] || "bg-zinc-800")}>
                      {stL[n.status] || n.status}
                    </span>
                    <button onClick={() => openEdit(n)} className="text-xs text-blue-400 hover:underline">编辑</button>
                    {n.status === "DRAFT" && (
                      <button onClick={() => publish(n.id)} className="text-xs text-green-400 hover:underline">发布</button>
                    )}
                    <button onClick={() => del(n.id)} className="text-xs text-red-400 hover:underline">删除</button>
                  </div>
                )}
              </div>
              {n.content && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{n.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">{edit.id ? "编辑" : "新增"}赛事通知</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">标题</label>
                <input
                  value={edit.title || ""}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">优先级</label>
                <select
                  value={edit.priority || "NORMAL"}
                  onChange={(e) => setEdit({ ...edit, priority: e.target.value })}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
                >
                  <option value="NORMAL">普通</option>
                  <option value="IMPORTANT">重要</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">正文</label>
                <textarea
                  value={edit.content || ""}
                  onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                  rows={8}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500"
                />
              </div>
              <button onClick={save} className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
