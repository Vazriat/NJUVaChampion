"use client";

/**
 * 直播聚合页：正在直播 + 主播列表。
 *
 * 主播列表的「在播」只看本站直播记录，不查询 B 站接口——
 * 几十个主播每分钟轮询一次会被限流，而本站记录本来就是裁判主动登记的，更准。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import LivePlayer, { platformLabel } from "@/components/LivePlayer";
import VideoCard from "@/components/VideoCard";
import VideoPlayerModal from "@/components/VideoPlayerModal";
import { liveApi, videoApi, LiveStreamVO, LiveChannelVO, VideoVO } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

function elapsedText(startedAt: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (mins < 1) return "刚刚开播";
  if (mins < 60) return `已开播 ${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `已开播 ${h} 小时 ${m} 分` : `已开播 ${h} 小时`;
}

export default function LivePage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStreamVO[]>([]);
  const [channels, setChannels] = useState<LiveChannelVO[]>([]);
  const [videos, setVideos] = useState<VideoVO[]>([]);
  const [playing, setPlaying] = useState<VideoVO | null>(null);
  const [channelTotal, setChannelTotal] = useState(0);
  const [channelPage, setChannelPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const PAGE_SIZE = 12;

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    Promise.all([
      liveApi.listLive(1, 20).catch(() => null),
      liveApi.channels(1, PAGE_SIZE).catch(() => null),
      videoApi.recent(40).catch(() => null),
    ]).then(([s, c, v]) => {
      setStreams(s?.data?.data?.list || []);
      setChannels(c?.data?.data?.list || []);
      setVideos(v?.data?.data || []);
      setChannelTotal(c?.data?.data?.total || 0);
      setLoading(false);
    });
  }, [router]);

  const loadChannels = useCallback(async (page: number) => {
    try {
      const res = await liveApi.channels(page, PAGE_SIZE);
      setChannels(res.data.data?.list || []);
      setChannelTotal(res.data.data?.total || 0);
      setChannelPage(page);
    } catch { /* 忽略 */ }
  }, []);

  const totalPages = Math.max(1, Math.ceil(channelTotal / PAGE_SIZE));

  // 按赛事聚合成"视频合集"：最多 4 个赛事，每个赛事取最新 3 条
  const videoGroups = useMemo(() => {
    const map = new Map<number, { id: number; name: string; items: VideoVO[] }>();
    for (const v of videos) {
      const g = map.get(v.tournamentId)
        || { id: v.tournamentId, name: v.tournamentName || "未命名赛事", items: [] };
      g.items.push(v);
      map.set(v.tournamentId, g);
    }
    return [...map.values()].slice(0, 4);
  }, [videos]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-5xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-6 flex items-end justify-between">
          <h1 className="text-2xl font-bold">直播</h1>
          <p className="text-sm text-zinc-500">裁判开播后自动出现在这里</p>
        </div>

        {/* ===== 正在直播 ===== */}
        <section className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            正在直播
            <span className="text-sm font-normal text-zinc-500">{streams.length}</span>
          </h2>

          {loading ? (
            <p className="py-10 text-center text-sm text-zinc-500">加载中...</p>
          ) : streams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
              <p className="text-sm text-zinc-500">当前没有正在进行的直播</p>
              <Link href="/tournaments" className="mt-3 inline-block text-sm text-red-400 hover:underline">
                去看看赛程 →
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {streams.map((s) => (
                <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 max-md:p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {s.team1Name || "待定"} vs {s.team2Name || "待定"}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {s.tournamentName || ""} · {elapsedText(s.startedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
                      LIVE
                    </span>
                  </div>
                  <LivePlayer
                    platform={s.platform}
                    roomId={s.roomId}
                    rawUrl={s.rawUrl || (s.roomId ? `https://live.bilibili.com/${s.roomId}` : "#")}
                    title={`${s.team1Name || ""} vs ${s.team2Name || ""}`}
                  />
                  <Link
                    href={`/tournaments/${s.tournamentId}`}
                    className="mt-3 inline-block text-xs text-zinc-400 hover:text-red-400"
                  >
                    查看赛事 →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== 赛事视频（按赛事分合集） ===== */}
        {videoGroups.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              赛事视频
              <span className="text-sm font-normal text-zinc-500">{videos.length}</span>
            </h2>
            <div className="space-y-7">
              {videoGroups.map((g) => (
                <div key={g.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{g.name}</h3>
                      <span className="shrink-0 text-xs text-zinc-500">{g.items.length} 个</span>
                    </div>
                    <Link
                      href={`/tournaments/${g.id}/videos`}
                      className="shrink-0 text-xs text-zinc-400 transition hover:text-red-400"
                    >
                      查看全部 →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    {g.items.slice(0, 3).map((v) => (
                      <VideoCard key={v.id} video={v} onPlay={setPlaying} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 主播列表 ===== */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            主播列表
            <span className="text-sm font-normal text-zinc-500">{channelTotal}</span>
          </h2>

          {channels.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
              还没有裁判绑定直播间
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((c) => (
                <a
                  key={c.channelId}
                  href={c.rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-red-500/50 max-md:p-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-600/20 font-bold text-red-400">
                    {(c.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.username || "未知"}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {platformLabel(c.platform)}
                      {c.gameId ? ` · ${c.gameId}` : ""}
                    </p>
                  </div>
                  {c.live && (
                    <span className="shrink-0 rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      在播
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={channelPage <= 1}
                onClick={() => loadChannels(channelPage - 1)}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-zinc-300 transition hover:border-zinc-600 disabled:opacity-40 max-md:min-h-11"
              >
                上一页
              </button>
              <span className="text-xs text-zinc-500">
                {channelPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={channelPage >= totalPages}
                onClick={() => loadChannels(channelPage + 1)}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-zinc-300 transition hover:border-zinc-600 disabled:opacity-40 max-md:min-h-11"
              >
                下一页
              </button>
            </div>
          )}
        </section>
      </main>

      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
