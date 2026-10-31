"use client";

/**
 * 直播播放器。
 *
 * 只有 B 站可以在站内播放（官方活动页播放器，实测无 X-Frame-Options）；
 * 其他平台没有等价嵌入页，只做跳转卡片。
 *
 * 安全：iframe 的 src 必须由 roomId 模板拼死，**绝不能直接用 rawUrl**。
 * 否则用户可填入任意地址，在站内渲染仿冒页面。
 */

const PLATFORM_LABEL: Record<string, string> = {
  BILIBILI: "哔哩哔哩",
  HUYA: "虎牙",
  DOUYU: "斗鱼",
  DOUYIN: "抖音",
};

export function platformLabel(platform: string) {
  return PLATFORM_LABEL[platform] || "直播间";
}

interface Props {
  platform: string;
  roomId: string | null;
  rawUrl: string;
  title?: string;
}

export default function LivePlayer({ platform, roomId, rawUrl, title }: Props) {
  const canEmbed = platform === "BILIBILI" && !!roomId && /^\d{1,20}$/.test(roomId);

  if (canEmbed) {
    return (
      <div>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
          <iframe
            src={`https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${roomId}&quality=0`}
            title={title || "直播画面"}
            className="aspect-video w-full"
            frameBorder={0}
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-zinc-500">{title || "B 站直播"}</span>
          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:underline"
          >
            在 B 站打开 ↗
          </a>
        </div>
      </div>
    );
  }

  // 非 B 站：不嵌画面，只给跳转
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 max-md:p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600/20 text-lg font-bold text-red-400">
          {platformLabel(platform).charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{title || "直播间"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {platformLabel(platform)} · 该平台不支持站内播放
          </p>
        </div>
      </div>
      <a
        href={rawUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        前往{platformLabel(platform)}观看 ↗
      </a>
    </div>
  );
}
