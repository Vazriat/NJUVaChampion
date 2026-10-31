"use client";

/**
 * 比赛视频（回放 / 精彩集锦）。
 *
 * 只存链接不存文件；封面与时长由后端在提交时抓取。
 * 上传权限：该场参赛队员、裁判、管理员（后端校验，前端只做入口展示）。
 */

import { useEffect, useState } from "react";
import { videoApi, VideoVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";
import VideoPlayerModal from "@/components/VideoPlayerModal";
import { CATEGORY_LABEL, categoryLabel, coverOf, durationText } from "@/components/VideoCard";

interface Props {
  matchId: number;
  /** 显示「添加 / 删除」入口；最终权限由后端判定 */
  canManage?: boolean;
  /** 最多展示几条 */
  limit?: number;
}

export default function MatchVideos({ matchId, canManage, limit }: Props) {
  const [items, setItems] = useState<VideoVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("REPLAY");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<VideoVO | null>(null);
  const ask = useConfirm();
  const notify = useNotify();

  const refresh = () => {
    videoApi.byMatch(matchId)
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
      notify("请填写视频链接", "error");
      return;
    }
    setBusy(true);
    try {
      await videoApi.create({ matchId, url: v, title: title.trim() || undefined, category });
      setUrl("");
      setTitle("");
      setAdding(false);
      notify("视频已添加", "success");
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.message || "添加失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: VideoVO) => {
    const ok = await ask({
      title: "删除视频",
      message: `确定删除「${v.title || "该视频"}」？`,
      okText: "确认删除",
      danger: true,
    });
    if (!ok) return;
    try {
      await videoApi.remove(v.id);
      notify("已删除", "success");
      refresh();
    } catch (err: any) {
      notify(err.response?.data?.message || "删除失败", "error");
    }
  };

  if (loading) return null;
  if (items.length === 0 && !canManage) return null;

  const shown = limit ? items.slice(0, limit) : items;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">视频</h4>
        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-red-400 transition hover:text-red-300"
          >
            + 添加视频
          </button>
        )}
      </div>

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((v) => {
            const cover = coverOf(v);
            const dur = durationText(v.durationSec);
            return (
              <li key={v.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    v.bvid
                      ? setPlaying(v)
                      : window.open(v.url, "_blank", "noopener,noreferrer")
                  }
                  className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-zinc-950"
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={v.title || ""} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-zinc-700">▶</span>
                  )}
                  {dur && (
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] text-zinc-200">
                      {dur}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      v.bvid
                        ? setPlaying(v)
                        : window.open(v.url, "_blank", "noopener,noreferrer")
                    }
                    className="block w-full truncate text-left text-sm text-zinc-200 hover:text-red-400"
                  >
                    {v.title || v.url}
                  </button>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {categoryLabel(v.category)}
                    {v.bvid ? " · 站内播放" : " · 站外播放"}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    className="shrink-0 text-xs text-zinc-500 transition hover:text-red-400"
                  >
                    删除
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">暂无视频</p>
      )}

      {adding && (
        <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="视频链接（B 站视频页地址，标题与封面会自动读取）"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题（留空则使用视频原题）"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <div className="flex gap-2">
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition max-md:min-h-11 ${
                  category === key
                    ? "border-red-500 bg-red-600/20 text-red-400"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
              {busy ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      )}

      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
