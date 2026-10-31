"use client";

/**
 * 管理端：直播间与直播记录。
 *
 * 主播列表是对外展示的内容，等于站点为他人直播间背书，
 * 所以必须能一键隐藏；直播也必须能强制结束。
 */

import { useEffect, useState } from "react";
import { liveApi, LiveChannelVO, LiveStreamVO } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";
import { platformLabel } from "@/components/LivePlayer";

export default function AdminLiveManager() {
  const [channels, setChannels] = useState<LiveChannelVO[]>([]);
  const [streams, setStreams] = useState<LiveStreamVO[]>([]);
  const [loading, setLoading] = useState(true);
  const ask = useConfirm();
  const notify = useNotify();

  const load = () => {
    setLoading(true);
    Promise.all([
      liveApi.adminChannels({ size: 50 }).catch(() => null),
      liveApi.listLive(1, 50).catch(() => null),
    ]).then(([c, s]) => {
      setChannels(c?.data?.data?.list || []);
      setStreams(s?.data?.data?.list || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (ch: LiveChannelVO) => {
    const next = ch.status === "HIDDEN" ? "ACTIVE" : "HIDDEN";
    const ok = await ask({
      title: next === "HIDDEN" ? "隐藏直播间" : "恢复直播间",
      message: next === "HIDDEN"
        ? `隐藏后「${ch.username || "该主播"}」将不再出现在主播列表。`
        : `恢复后「${ch.username || "该主播"}」将重新出现在主播列表。`,
      okText: next === "HIDDEN" ? "确认隐藏" : "确认恢复",
      danger: next === "HIDDEN",
    });
    if (!ok) return;
    try {
      await liveApi.setChannelStatus(ch.channelId, next);
      notify(next === "HIDDEN" ? "已隐藏" : "已恢复", "success");
      load();
    } catch (err: any) {
      notify(err.response?.data?.message || "操作失败", "error");
    }
  };

  const forceEnd = async (s: LiveStreamVO) => {
    const ok = await ask({
      title: "强制结束直播",
      message: `确定结束「${s.team1Name || "待定"} vs ${s.team2Name || "待定"}」的直播？`,
      okText: "确认结束",
      danger: true,
    });
    if (!ok) return;
    try {
      await liveApi.adminEnd(s.id);
      notify("直播已结束", "success");
      load();
    } catch (err: any) {
      notify(err.response?.data?.message || "操作失败", "error");
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-zinc-500">加载中...</p>;
  }

  return (
    <div className="space-y-6">
      {/* 正在直播 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-md:p-4">
        <h3 className="mb-4 text-lg font-semibold">
          正在直播 <span className="text-sm font-normal text-zinc-500">{streams.length}</span>
        </h3>
        {streams.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">当前没有正在进行的直播</p>
        ) : (
          <div className="space-y-2">
            {streams.map((s) => (
              <div key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 max-md:flex-col max-md:items-stretch">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.team1Name || "待定"} vs {s.team2Name || "待定"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {s.tournamentName || ""} · {platformLabel(s.platform)}
                    {s.roomId ? ` · 房间 ${s.roomId}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => forceEnd(s)}
                  className="shrink-0 rounded-lg border border-red-700 px-4 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-600/20 max-md:min-h-11"
                >
                  强制结束
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 主播列表 */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-md:p-4">
        <h3 className="mb-4 text-lg font-semibold">
          已绑定直播间的裁判 <span className="text-sm font-normal text-zinc-500">{channels.length}</span>
        </h3>
        {channels.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">还没有裁判绑定直播间</p>
        ) : (
          <div className="space-y-2">
            {channels.map((c) => (
              <div key={c.channelId}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 max-md:flex-col max-md:items-stretch">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-sm font-bold text-red-400">
                    {(c.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.username || "未知"}
                      {c.status === "HIDDEN" && (
                        <span className="ml-2 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-400">
                          已隐藏
                        </span>
                      )}
                    </p>
                    <a
                      href={c.rawUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-zinc-500 hover:text-red-400"
                    >
                      {platformLabel(c.platform)}
                      {c.roomId ? ` · 房间 ${c.roomId}` : ""}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className="shrink-0 rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 max-md:min-h-11"
                >
                  {c.status === "HIDDEN" ? "恢复" : "隐藏"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
