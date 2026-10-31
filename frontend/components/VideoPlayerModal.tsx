"use client";

/**
 * 站内视频播放弹层。
 *
 * 只嵌入 B 站（官方 player.bilibili.com，实测无 X-Frame-Options）。
 * bvid 必须先用正则校验再拼进 src —— 和其它 iframe 一样，不能直接使用用户填的 URL。
 */

import { useEffect } from "react";
import { VideoVO } from "@/lib/api";

const BVID_RE = /^BV[0-9A-Za-z]{10}$/;

interface Props {
  video: VideoVO | null;
  onClose: () => void;
}

export default function VideoPlayerModal({ video, onClose }: Props) {
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, onClose]);

  if (!video) return null;

  const bvid = video.bvid && BVID_RE.test(video.bvid) ? video.bvid : null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-6 max-md:items-start max-md:p-3 max-md:pt-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2.5">
          <p className="min-w-0 truncate text-sm font-medium">{video.title || "视频"}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xl leading-none text-zinc-500 transition hover:text-white"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {bvid ? (
          <iframe
            src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1&high_quality=1&danmaku=0`}
            title={video.title || "视频播放"}
            className="aspect-video w-full bg-black"
            frameBorder={0}
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black text-sm text-zinc-400">
            <p>该平台不支持站内播放</p>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              在站外打开 ↗
            </a>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2 text-xs">
          <span className="truncate text-zinc-500">{video.matchName || ""}</span>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-red-400 hover:underline"
          >
            在 B 站打开 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
