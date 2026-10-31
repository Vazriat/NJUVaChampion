"use client";

/**
 * 「我的直播间」：裁判绑定一次，之后每场比赛一键开播。
 *
 * B 站链接会在这里完成短号 → 真实 room_id 的转换，转换失败的链接不允许保存。
 */

import { useEffect, useState } from "react";
import { liveApi } from "@/lib/api";
import { useConfirm, useNotify } from "@/components/DialogProvider";
import { platformLabel } from "@/components/LivePlayer";

interface ChannelVO {
  id: number;
  platform: string;
  roomId: string | null;
  rawUrl: string;
  status: string;
}

export default function LiveChannelCard() {
  const [channel, setChannel] = useState<ChannelVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useConfirm();
  const notify = useNotify();

  const load = () => {
    liveApi.myChannel()
      .then((res) => setChannel(res.data.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const v = url.trim();
    if (!v) {
      notify("请填写直播间链接", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await liveApi.bindChannel(v);
      setChannel(res.data.data);
      setUrl("");
      setEditing(false);
      notify("直播间已保存", "success");
    } catch (err: any) {
      notify(err.response?.data?.message || "保存失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const unbind = async () => {
    const ok = await ask({
      title: "解绑直播间",
      message: "解绑后将无法一键开播，确定继续？",
      okText: "确认解绑",
      danger: true,
    });
    if (!ok) return;
    try {
      await liveApi.unbindChannel();
      setChannel(null);
      notify("已解绑", "success");
    } catch (err: any) {
      notify(err.response?.data?.message || "解绑失败", "error");
    }
  };

  if (loading) return null;

  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 max-md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">我的直播间</h2>
        <span className="text-xs text-zinc-500">绑定一次，比赛页可一键开播</span>
      </div>

      {channel && !editing ? (
        <div>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600/20 font-bold text-red-400">
              {platformLabel(channel.platform).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {platformLabel(channel.platform)}
                {channel.roomId ? ` · 房间 ${channel.roomId}` : ""}
              </p>
              <a
                href={channel.rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate text-xs text-zinc-500 hover:text-red-400"
              >
                {channel.rawUrl}
              </a>
            </div>
            {channel.status === "HIDDEN" && (
              <span className="shrink-0 rounded bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-400">
                已隐藏
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { setEditing(true); setUrl(channel.rawUrl); }}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 max-md:min-h-11"
            >
              修改
            </button>
            <button
              type="button"
              onClick={unbind}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 transition hover:border-red-500 hover:text-red-400 max-md:min-h-11"
            >
              解绑
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs text-zinc-500">
            请粘贴完整的直播间链接。支持 B 站 / 虎牙 / 斗鱼 / 抖音；只有 B 站能在站内播放，其他平台会跳转到对应直播间。
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://live.bilibili.com/12345"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 max-md:min-h-11"
            >
              {busy ? "校验中..." : "保存"}
            </button>
            {channel && (
              <button
                type="button"
                onClick={() => { setEditing(false); setUrl(""); }}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-600 max-md:min-h-11"
              >
                取消
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
