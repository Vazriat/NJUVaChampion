"use client";

import React, { useEffect, useState } from "react";
import { adminAnnouncementApi } from "@/lib/api";

export default function AdminAnnouncementManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>({ title: "", content: "", priority: "NORMAL", status: "DRAFT" });
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    adminAnnouncementApi.list().then(r => setItems(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit({ title: "", content: "", priority: "NORMAL", status: "DRAFT" }); setShowForm(true); };
  const openEdit = (a: any) => { setEdit({ ...a }); setShowForm(true); };

  const save = async () => {
    try {
      if (edit.id) await adminAnnouncementApi.update(edit.id, edit);
      else await adminAnnouncementApi.create(edit);
      setMsg("保存成功"); setTimeout(() => setMsg(""), 2000);
      setShowForm(false); load();
    } catch { setMsg("保存失败"); }
  };

  const publish = async (id: number) => {
    try { await adminAnnouncementApi.publish(id); setMsg("已发布"); setTimeout(() => setMsg(""), 2000); load(); }
    catch { setMsg("发布失败"); }
  };

  const del = async (id: number) => {
    if (!confirm("确定删除？")) return;
    try { await adminAnnouncementApi.delete(id); setMsg("已删除"); setTimeout(() => setMsg(""), 2000); load(); }
    catch { setMsg("删除失败"); }
  };

  const stL: Record<string, string> = { DRAFT: "草稿", PUBLISHED: "已发布" };
  const stC: Record<string, string> = { DRAFT: "bg-zinc-700 text-zinc-400", PUBLISHED: "bg-green-500/10 text-green-400" };
  const prL: Record<string, string> = { NORMAL: "普通", IMPORTANT: "重要" };

  return (
    <div>
      {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-zinc-500">共 {items.length} 条</span>
        <button onClick={openNew} className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-700">+ 新增</button>
      </div>
      {loading ? <p className="py-8 text-center text-zinc-500">加载中...</p>
      : items.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center"><p className="text-sm text-zinc-500">暂无通知</p></div>
      : <div className="space-y-2">
          {items.map((a: any) => (
            <div key={a.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium " + (stC[a.status] || "bg-zinc-800")}>{stL[a.status] || a.status}</span>
              <span className={"w-10 text-[10px] " + (a.priority === "IMPORTANT" ? "text-yellow-400" : "text-zinc-500")}>{prL[a.priority]}</span>
              <span className="flex-1 truncate text-sm text-zinc-300">{a.title}</span>
              <button onClick={() => openEdit(a)} className="text-xs text-blue-400 hover:underline">编辑</button>
              {a.status === "DRAFT" && <button onClick={() => publish(a.id)} className="text-xs text-green-400 hover:underline">发布</button>}
              <button onClick={() => del(a.id)} className="text-xs text-red-400 hover:underline">删除</button>
            </div>
          ))}
        </div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">{edit.id ? "编辑" : "新增"}通知</h3>
            <div className="space-y-3 text-sm">
              <div><label className="mb-1 block text-xs text-zinc-500">标题</label>
                <input value={edit.title || ""} onChange={e => setEdit({...edit, title: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">优先级</label>
                <select value={edit.priority} onChange={e => setEdit({...edit, priority: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500">
                  <option value="NORMAL">普通</option><option value="IMPORTANT">重要</option>
                </select></div>
              <div><label className="mb-1 block text-xs text-zinc-500">正文</label>
                <textarea value={edit.content || ""} onChange={e => setEdit({...edit, content: e.target.value})} rows={8}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <button onClick={save} className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
