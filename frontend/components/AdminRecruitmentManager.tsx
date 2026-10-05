"use client";

import React, { useEffect, useState } from "react";
import { adminRecruitmentPostApi } from "@/lib/api";

const TYPE_LABEL: Record<string, string> = { TEAM: "队伍招募", PLAYER: "选手求职" };
const STATUS_LABEL: Record<string, string> = { OPEN: "招募中", CLOSED: "已关闭" };
const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-green-500/10 text-green-400",
  CLOSED: "bg-zinc-700 text-zinc-400",
};

export default function AdminRecruitmentManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [msg, setMsg] = useState("");

  const load = (kw?: string) => {
    setLoading(true);
    adminRecruitmentPostApi
      .list({
        type: type || undefined,
        status: status || undefined,
        keyword: (kw !== undefined ? kw : keyword).trim() || undefined,
      })
      .then((r) => setItems(r.data.data || []))
      .catch(() => setMsg("加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [type, status]);

  const takeDown = async (id: number) => {
    if (!confirm("确认下架这条信息？作者会收到通知，且该信息将不再出现在人才市场。")) return;
    try {
      await adminRecruitmentPostApi.takeDown(id);
      setMsg("已下架");
      setTimeout(() => setMsg(""), 2000);
      load();
    } catch (err: any) {
      setMsg(err.response?.data?.message || "下架失败");
    }
  };

  const selectClass =
    "rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none focus:border-red-500 max-md:min-h-11";

  return (
    <div>
      {msg && (
        <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {msg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 max-md:gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={selectClass}
        >
          <option value="">全部类型</option>
          <option value="TEAM">队伍招募</option>
          <option value="PLAYER">选手求职</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">全部状态</option>
          <option value="OPEN">招募中</option>
          <option value="CLOSED">已关闭</option>
        </select>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") load();
          }}
          placeholder="搜索内容关键词..."
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-red-500 max-md:min-h-11"
        />
        <button
          onClick={() => load()}
          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 transition hover:border-red-500 hover:text-red-400 max-md:min-h-11"
        >
          搜索
        </button>
        <span className="text-xs text-zinc-500">共 {items.length} 条</span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-zinc-500 max-md:py-6">加载中...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无信息</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p: any) => (
            <div
              key={p.id}
              className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 max-md:flex-col max-md:gap-2"
            >
              <div className="flex shrink-0 items-center gap-2 max-md:w-full">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  {TYPE_LABEL[p.type] || p.type}
                </span>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-medium " +
                    (STATUS_CLASS[p.status] || "bg-zinc-800 text-zinc-400")
                  }
                >
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-300">{p.content}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {p.type === "TEAM" ? `队伍：${p.teamName || "-"}` : "选手帖"}
                  {" · "}
                  发布者：{p.displayName}
                  {p.username ? ` (@${p.username})` : ""}
                  {" · "}
                  {p.createdAt ? new Date(p.createdAt).toLocaleString("zh-CN") : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3 max-md:w-full max-md:justify-end">
                {p.status === "OPEN" ? (
                  <button
                    onClick={() => takeDown(p.id)}
                    className="text-xs text-red-400 hover:underline max-md:min-h-11"
                  >
                    下架
                  </button>
                ) : (
                  <span className="text-[11px] text-zinc-600">已下架</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
