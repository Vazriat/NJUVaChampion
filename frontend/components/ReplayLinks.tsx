"use client";

/**
 * 比赛回放链接。
 *
 * 回放独立于直播：没开过直播的场次也能加，重赛时上一段不会被覆盖。
 * 只做外链，不做站内播放——回放页的嵌入策略各平台都不一样，维护成本不值当。
 */

import { useEffect, useState } from "react";
import { liveApi, MatchReplayVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";

interface Props {
  matchId: number;
  /** 裁判或管理员可见「添加 / 删除」 */
  canManage?: boolean;
  /** 最多展示几条，不传则全部 */
  limit?: number;
}

export default function ReplayLinks({ matchId, canManage, limit }: Props) {
  const [items, setItems] = useState<MatchReplayVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const notify = useNotify();

  const refresh = () => {
    liveApi.replays(matchId)
      .then((res) => setItems(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const submit = async () => {
    const v = url.trim();
    if (!v) {
      notify("请填写回放链接", "error");
      return;
    }
    setBusy(true);
    try {
      await liveApi.addReplay({ matchId, url: v, title: title.trim() || undefined });
      setUrl("");
      setTitle("");
      setAdding(false);
      notify("回放已添加", "success");
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.message || "添加失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    const ok = await ask({
      title: "删除回放",
      message: "确定删除这条回放链接？",
      okText: "确认删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await liveApi.deleteReplay(id);
      notify("已删除", "success");
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.message || "删除失败", "error");
    }
  };

  if (loading) {
    return null;
  }
  if (items.length === 0 && !canManage) {
    return null;
  }

  const shown = limit ? items.slice(0, limit) : items;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">比赛回放</h4>
        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-red-400 transition hover:text-red-300"
          >
            + 添加回放
          </button>
        )}
      </div>

      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-sm">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-blue-400 hover:underline"
              >
                {r.title || r.url}
              </a>
              <span className="shrink-0 text-xs text-zinc-600">
                {new Date(r.createdAt).toLocaleDateString("zh-CN")}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="shrink-0 text-xs text-zinc-500 transition hover:text-red-400"
                >
                  删除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length === 0 && canManage && !adding && (
        <p className="text-xs text-zinc-500">暂无回放</p>
      )}

      {adding && (
        <div className="mt-2 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="回放链接（https://...）"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（可选，如「半决赛 G1」）"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setAdding(false); setUrl(""); setTitle(""); }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 max-md:min-h-11"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 max-md:min-h-11"
            >
              {busy ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
