"use client";

/**
 * 赛事视频页：回放与精彩集锦。
 *
 * 视频只存外链，封面由后端抓取；B 站视频可在站内弹层播放，其他平台跳转。
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import VideoCard, { CATEGORY_LABEL } from "@/components/VideoCard";
import VideoPlayerModal from "@/components/VideoPlayerModal";
import { tournamentApi, videoApi, VideoVO } from "@/lib/api";
import { getUser, isLoggedIn } from "@/lib/auth";
import { useConfirm, useNotify } from "@/components/DialogProvider";

const PAGE_SIZE = 24;

const TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "REPLAY", label: "赛事回放" },
  { key: "HIGHLIGHT", label: "精彩集锦" },
  { key: "OTHER", label: "其他" },
];

export default function TournamentVideosPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ask = useConfirm();
  const notify = useNotify();

  const [tournament, setTournament] = useState<any>(null);
  const [videos, setVideos] = useState<VideoVO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [form, setForm] = useState({ matchId: "", url: "", title: "", category: "REPLAY" });
  const [busy, setBusy] = useState(false);

  const [playing, setPlaying] = useState<VideoVO | null>(null);
  const me = getUser();

  const load = useCallback(async (p: number, cat: string) => {
    setLoading(true);
    try {
      const res = await videoApi.byTournament(Number(id), {
        category: cat || undefined,
        page: p,
        size: PAGE_SIZE,
      });
      setVideos(res.data.data?.list || []);
      setTotal(res.data.data?.total || 0);
      setPage(p);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    tournamentApi.detail(Number(id)).then((r) => setTournament(r.data.data)).catch(() => {});
    load(1, "");
    videoApi.selectableMatches(Number(id))
      .then((r) => setMatches(r.data.data || []))
      .catch(() => {});
  }, [id, router, load]);

  const submit = async () => {
    if (!form.matchId) {
      notify("请选择这场比赛", "error");
      return;
    }
    if (!form.url.trim()) {
      notify("请填写视频链接", "error");
      return;
    }
    setBusy(true);
    try {
      await videoApi.create({
        matchId: Number(form.matchId),
        url: form.url.trim(),
        title: form.title.trim() || undefined,
        category: form.category,
      });
      notify("视频已提交", "success");
      setForm({ matchId: form.matchId, url: "", title: "", category: form.category });
      setUploading(false);
      load(1, category);
    } catch (err: any) {
      notify(err.response?.data?.message || "提交失败", "error");
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
      load(page, category);
    } catch (err: any) {
      notify(err.response?.data?.message || "删除失败", "error");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
      <NavBar />
      <main className="mx-auto max-w-6xl px-8 py-10 max-md:px-4 max-md:py-8">
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
          <Link href={`/tournaments/${id}`} className="hover:text-red-400">
            {tournament?.name || "赛事"}
          </Link>
          <span>/</span>
          <span>视频</span>
        </div>

        <div className="mb-6 flex items-end justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <div>
            <h1 className="text-2xl font-bold">赛事视频</h1>
            <p className="mt-1 text-sm text-zinc-500">回放与精彩集锦，由裁判与参赛队员提交</p>
          </div>
          <button
            type="button"
            onClick={() => setUploading((v) => !v)}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 max-md:min-h-11"
          >
            {uploading ? "收起" : "+ 提交视频"}
          </button>
        </div>

        {uploading && (
          <section className="mb-6 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 max-md:p-4">
            <p className="text-xs text-zinc-500">
              只有该场比赛的参赛队员、裁判与管理员可以提交。B 站视频会自动读取标题和封面。
            </p>
            <select
              value={form.matchId}
              onChange={(e) => setForm({ ...form, matchId: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            >
              <option value="">选择比赛…</option>
              {matches.map((m) => (
                <option key={m.matchId} value={m.matchId}>
                  {m.name}
                  {m.round != null ? `（第 ${m.round + 1} 轮）` : ""}
                </option>
              ))}
            </select>
            {matches.length === 0 && (
              <p className="text-xs text-zinc-600">该赛事还没有已完结的比赛，先打完一场再来传。</p>
            )}
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="视频链接（B 站视频页地址）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="标题（留空则使用视频原题）"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
            <div className="flex gap-2">
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, category: key })}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition max-md:min-h-11 ${
                    form.category === key
                      ? "border-red-500 bg-red-600/20 text-red-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50 max-md:min-h-11"
              >
                {busy ? "提交中..." : "提交"}
              </button>
            </div>
          </section>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setCategory(t.key); load(1, t.key); }}
              className={`rounded-lg border px-3 py-1.5 text-xs transition max-md:min-h-11 ${
                category === t.key
                  ? "border-red-500 bg-red-600/20 text-red-400"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-500">加载中...</p>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
            <p className="text-sm text-zinc-500">还没有视频</p>
            <p className="mt-1 text-xs text-zinc-600">赛后把 B 站的回放或集锦链接提交上来吧</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onPlay={setPlaying}
                canManage={!!me}
                onDelete={remove}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => load(page - 1, category)}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-zinc-300 transition hover:border-zinc-600 disabled:opacity-40 max-md:min-h-11"
            >
              上一页
            </button>
            <span className="text-xs text-zinc-500">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => load(page + 1, category)}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-zinc-300 transition hover:border-zinc-600 disabled:opacity-40 max-md:min-h-11"
            >
              下一页
            </button>
          </div>
        )}
      </main>

      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}
