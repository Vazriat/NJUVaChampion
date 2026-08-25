"use client";

import React, { useEffect, useState } from "react";
import { adminBannerApi } from "@/lib/api";

export default function AdminBannerManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any>({ title: "", type: "IMAGE", content: "", imageUrl: "", linkUrl: "", sortOrder: 0, active: true });
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    adminBannerApi.list().then(r => setItems(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit({ title: "", type: "IMAGE", content: "", imageUrl: "", linkUrl: "", sortOrder: 0, active: true }); setShowForm(true); };
  const openEdit = (b: any) => { setEdit({ ...b }); setShowForm(true); };

  const save = async () => {
    try {
      if (edit.id) await adminBannerApi.update(edit.id, edit);
      else await adminBannerApi.create(edit);
      setMsg("保存成功"); setTimeout(() => setMsg(""), 2000);
      setShowForm(false); load();
    } catch { setMsg("保存失败"); }
  };

  const del = async (id: number) => {
    if (!confirm("确定删除？")) return;
    try { await adminBannerApi.delete(id); setMsg("已删除"); setTimeout(() => setMsg(""), 2000); load(); }
    catch { setMsg("删除失败"); }
  };

  return (
    <div>
      {msg && <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{msg}</div>}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-zinc-500">共 {items.length} 条</span>
        <button onClick={openNew} className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold hover:bg-red-700">+ 新增</button>
      </div>
      {loading ? <p className="py-8 text-center text-zinc-500">加载中...</p>
      : items.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center"><p className="text-sm text-zinc-500">暂无宣传栏</p></div>
      : <div className="space-y-2">
          {items.map((b: any) => (
            <div key={b.id} className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <span className={"h-2 w-2 rounded-full " + (b.active ? "bg-green-500" : "bg-zinc-600")} />
              <span className="w-16 flex-shrink-0 text-xs text-zinc-500">{b.type}</span>
              <span className="flex-1 truncate text-sm text-zinc-300">{b.title || "(无标题)"}</span>
              <span className="text-xs text-zinc-600">排序 {b.sortOrder}</span>
              <button onClick={() => openEdit(b)} className="text-xs text-blue-400 hover:underline">编辑</button>
              <button onClick={() => del(b.id)} className="text-xs text-red-400 hover:underline">删除</button>
            </div>
          ))}
        </div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">{edit.id ? "编辑" : "新增"}宣传栏</h3>
            <div className="space-y-3 text-sm">
              <div><label className="mb-1 block text-xs text-zinc-500">标题</label>
                <input value={edit.title || ""} onChange={e => setEdit({...edit, title: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">类型</label>
                <select value={edit.type} onChange={e => setEdit({...edit, type: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500">
                  <option value="IMAGE">图片</option><option value="TEXT">文字</option><option value="HTML">HTML</option>
                </select></div>
              {edit.type === "IMAGE" && <div><label className="mb-1 block text-xs text-zinc-500">图片 URL</label>
                <input value={edit.imageUrl || ""} onChange={e => setEdit({...edit, imageUrl: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>}
              {edit.type === "TEXT" && <div><label className="mb-1 block text-xs text-zinc-500">内容</label>
                <textarea value={edit.content || ""} onChange={e => setEdit({...edit, content: e.target.value})} rows={3}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>}
              {edit.type === "HTML" && <div><label className="mb-1 block text-xs text-zinc-500">HTML</label>
                <textarea value={edit.content || ""} onChange={e => setEdit({...edit, content: e.target.value})} rows={4}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500 font-mono text-xs" /></div>}
              <div><label className="mb-1 block text-xs text-zinc-500">点击跳转链接</label>
                <input value={edit.linkUrl || ""} onChange={e => setEdit({...edit, linkUrl: e.target.value})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <div><label className="mb-1 block text-xs text-zinc-500">排序</label>
                <input type="number" value={edit.sortOrder ?? 0} onChange={e => setEdit({...edit, sortOrder: Number(e.target.value)})}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none focus:border-red-500" /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({...edit, active: e.target.checked})}
                  className="rounded border-zinc-600 bg-zinc-800 text-red-600" />
                <span className="text-xs text-zinc-400">启用</span>
              </label>
              <button onClick={save} className="w-full rounded-lg bg-red-600 py-2 text-sm font-semibold hover:bg-red-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
