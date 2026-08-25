"use client";

/**
 * 瑞士轮赛程表：按"该轮开赛时队伍战绩（胜-负）"分组命名，区别于淘汰赛对阵图。
 * - 只展示 stage === "SWISS" 的比赛
 * - 分组标题即战绩，如 0-0 / 1-0 / 0-1 / 2-0 / 1-1 ...
 * - 已完成的对局显示比分并高亮胜者
 * - onMatchClick 传入时卡片可点击（管理端录入）
 */
export default function SwissSchedule({
  matches,
  groupName,
  onMatchClick,
}: {
  matches: any[];
  groupName?: string | null;
  onMatchClick?: (match: any) => void;
}) {
  const swissMatches = matches.filter((m) => m.stage === "SWISS");

  // 计算某队在第 round 轮开赛前的战绩（只统计轮次更早的已完结比赛）
  const recordBefore = (teamId: number, round: number): { w: number; l: number } => {
    let w = 0;
    let l = 0;
    for (const m of swissMatches) {
      if ((m.round ?? 0) >= round || m.status !== "COMPLETED" || !m.winnerId) continue;
      if (m.team1Id === teamId) {
        if (m.winnerId === m.team1Id) w++; else l++;
      } else if (m.team2Id === teamId) {
        if (m.winnerId === m.team2Id) w++; else l++;
      }
    }
    return { w, l };
  };

  // 按战绩分组
  const sections = new Map<string, any[]>();
  for (const m of swissMatches) {
    const round = m.round ?? 0;
    const tid = m.team1Id ?? m.team2Id ?? 0;
    const rec = tid ? recordBefore(tid, round) : { w: 0, l: 0 };
    const label = rec.w + "-" + rec.l;
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label)!.push(m);
  }

  const sorted = [...sections.entries()]
    .map(([label, ms]) => ({
      label,
      ms: [...ms].sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.position ?? 0) - (b.position ?? 0)),
      round: Math.min(...ms.map((m) => m.round ?? 0)),
    }))
    .sort((a, b) => {
      // 轮次先后，同轮内按胜场降序（如 1-0 在 0-1 前）
      if (a.round !== b.round) return a.round - b.round;
      const pa = a.label.split("-").map(Number);
      const pb = b.label.split("-").map(Number);
      return pb[0] - pa[0] || pa[1] - pb[1];
    });

  if (sorted.length === 0) {
    return <p className="py-4 text-center text-sm text-zinc-500">暂无瑞士轮对阵</p>;
  }

  return (
    <div className="space-y-8">
      {groupName && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">组别：</span>
          <span className="rounded bg-red-600/15 px-2.5 py-0.5 font-medium text-red-400">{groupName}</span>
        </div>
      )}
      {sorted.map(({ label, ms }) => (
        <div key={label}>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <span className="rounded bg-zinc-800 px-2.5 py-0.5 font-mono text-base text-red-400">{label}</span>
            <span className="text-xs font-normal text-zinc-600">{ms.length} 场（战绩=胜-负）</span>
          </h4>
          <div className="grid gap-2 md:grid-cols-2">
            {ms.map((m) => {
              const completed = m.status === "COMPLETED";
              const t1Win = completed && m.winnerId && m.winnerId === m.team1Id;
              const t2Win = completed && m.winnerId && m.winnerId === m.team2Id;
              const clickable = !!onMatchClick && !!m.team1Id && !!m.team2Id;
              return (
                <div
                  key={m.id}
                  onClick={() => { if (clickable) onMatchClick(m); }}
                  className={"rounded-lg border p-3 transition " + (clickable ? "cursor-pointer hover:border-red-500 hover:bg-zinc-800/50" : "") + (completed ? " border-zinc-700 bg-zinc-800/40" : " border-zinc-800 bg-zinc-900")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={"truncate text-sm " + (t1Win ? "font-semibold text-green-400" : "text-zinc-300")}>
                      {m.team1Name || "待定"}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-800 px-2.5 py-0.5 text-sm font-bold text-zinc-200">
                      {completed ? (m.team1Score ?? m.team1Wins ?? "-") + " : " + (m.team2Score ?? m.team2Wins ?? "-") : "VS"}
                    </span>
                    <span className={"truncate text-sm " + (t2Win ? "font-semibold text-green-400" : "text-zinc-300")}>
                      {m.team2Name || "待定"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-right text-[10px] text-zinc-600">
                    {completed ? "已完结" : m.team1Id && m.team2Id ? "待赛" : "等待对阵"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
