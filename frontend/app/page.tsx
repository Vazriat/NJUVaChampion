import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-6xl font-black tracking-wider text-red-500">VALORANT</h1>
        <p className="mt-4 text-xl text-zinc-400">无畏契约赛事平台</p>
        <p className="mt-2 text-zinc-600">NJU Champion</p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-red-600 px-8 py-3 font-semibold transition hover:bg-red-700"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-700 px-8 py-3 font-semibold text-zinc-300 transition hover:border-red-500 hover:text-red-400"
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  );
}