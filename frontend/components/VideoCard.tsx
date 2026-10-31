"use client";

/**
 * 视频卡片：封面 + 分类 + 标题。
 *
 * 点击行为：B 站视频走站内弹层播放，其他平台直接新窗口打开。
 */

import { VideoVO } from "@/lib/api";

export const CATEGORY_LABEL: Record<string, string> = {
  REPLAY: "赛事回放",
  HIGHLIGHT: "精彩集锦",
  OTHER: "其他",
};

export const CATEGORY_STYLE: Record<string, string> = {
  REPLAY: "bg-blue-500/20 text-blue-300",
  HIGHLIGHT: "bg-orange-500/20 text-orange-300",
  OTHER: "bg-zinc-700/60 text-zinc-300",
};

export function categoryLabel(c: string | null | undefined) {
  return CATEGORY_LABEL[c || "REPLAY"] || "其他";
}

export function durationText(sec: number | null | undefined) {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function coverOf(v: VideoVO) {
  const c = v.coverUrl;
  if (!c) return null;
  return c.startsWith("http://") ? "https://" + c.substring(7) : c;
}

interface Props {
  video: VideoVO;
  onPlay: (v: VideoVO) => void;
  canManage?: boolean;
  onDelete?: (v: VideoVO) => void;
}

export default function VideoCard({ video, onPlay, canManage, onDelete }: Props) {
  const cover = coverOf(video);
  const playable = !!video.bvid;
  const dur = durationText(video.durationSec);

  return (
    <div className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-red-500/50">
      <button
        type="button"
        onClick={() => (playable ? onPlay(video) : window.open(video.url, "_blank", "noopener,noreferrer"))}
        className="block w-full text-left"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={video.title || "视频封面"}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-2xl text-zinc-700">
              ▶
            </div>
          )}
          <span
            className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              CATEGORY_STYLE[video.category] || CATEGORY_STYLE.OTHER
            }`}
          >
            {categoryLabel(video.category)}
          </span>
          {!playable && (
            <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300">
              站外播放
            </span>
          )}
          {video.matchName && (
            <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-zinc-200">
              {video.matchName}
            </span>
          )}
          {dur && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-200">
              {dur}
            </span>
          )}
        </div>
        <div className="p-3 max-md:p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {video.title || "未命名视频"}
          </p>
        </div>
      </button>

      {canManage && onDelete && (
        <div className="flex justify-end border-t border-zinc-800 px-3 py-1.5">
          <button
            type="button"
            onClick={() => onDelete(video)}
            className="text-xs text-zinc-500 transition hover:text-red-400"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}
