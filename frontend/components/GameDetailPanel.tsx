"use client";

import React, { useState } from "react";

interface PlayerStat {
  playerName?: string;
  userName?: string;
  teamId?: number;
  agent?: string;
  acs?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  firstBlood?: number;
  [key: string]: any;
}

interface GameDetail {
  id: number;
  gameNumber: number;
  team1Score: number | null;
  team2Score: number | null;
  screenshotPath?: string;
  status: string;
  playerStats?: any[];
}

interface GameDetailPanelProps {
  games: GameDetail[];
  team1Name?: string;
  team2Name?: string;
  team1Id?: number;
  team2Id?: number;
}

const AGENTS = ["K/O","幽影","壹决","夜露","星礈","贤者","维斯","铁臂","钛狐",
  "斯凯","尚勃勒","芮娜","奇乐","霓虹","暮蝶","迷核","零","猎枭",
  "炼狱","雷兹","蝰蛇","禁灭","捷风","幻棱","黑梦","海神","钢索","盖可","不死鸟"];

function isAgent(s: string) { return AGENTS.includes(s); }

export default function GameDetailPanel({ games, team1Name, team2Name, team1Id, team2Id }: GameDetailPanelProps) {
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);

  if (!games || games.length === 0) {
    return <p className="py-4 text-center text-xs text-zinc-500">暂无小局数据</p>;
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const stats = game.playerStats || [];
        const team1Stats = stats.filter((s: any) => s.teamId === team1Id);
        const team2Stats = stats.filter((s: any) => s.teamId === team2Id);
        const unassignedStats = team1Id && team2Id
          ? stats.filter((s: any) => s.teamId !== team1Id && s.teamId !== team2Id)
          : stats;

        return (
          <div key={game.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="text-sm font-semibold text-zinc-300">第{game.gameNumber}局</span>
              <div className="flex items-center gap-3">
                <span className="text-sm">{team1Name || "主队"}</span>
                <span className={`text-lg font-bold ${(game.team1Score ?? 0) > (game.team2Score ?? 0) ? "text-green-400" : "text-zinc-400"}`}>
                  {game.team1Score ?? "-"}
                </span>
                <span className="text-zinc-600">:</span>
                <span className={`text-lg font-bold ${(game.team2Score ?? 0) > (game.team1Score ?? 0) ? "text-green-400" : "text-zinc-400"}`}>
                  {game.team2Score ?? "-"}
                </span>
                <span className="text-sm">{team2Name || "客队"}</span>
              </div>
            </div>

            {/* Screenshot */}
            {game.screenshotPath && (
              <div className="border-b border-zinc-800">
                <img
                  src={game.screenshotPath}
                  alt={"第" + game.gameNumber + "局截图"}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onClick={() => setEnlargedImg(game.screenshotPath!)}
                  className="max-h-48 w-full cursor-pointer object-contain bg-zinc-950 hover:opacity-80 transition"
                />
              </div>
            )}

            {/* Player stats */}
            <div className="p-4">
              {renderTeamTable(team1Stats, team1Name || "主队")}
              {renderTeamTable(team2Stats, team2Name || "客队")}
              {renderTeamTable(unassignedStats, "未分配")}
              {stats.length === 0 && (
                <p className="py-2 text-center text-xs text-zinc-500">无选手数据</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Image viewer */}
      {enlargedImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setEnlargedImg(null)}>
          <img src={enlargedImg} className="max-h-[90vh] max-w-[90vw] rounded-lg" alt="截图" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
    </div>
  );

  function renderTeamTable(teamStats: any[], label: string) {
    if (teamStats.length === 0) return null;
    return (
      <div className="mb-3 last:mb-0">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">{label} ({teamStats.length}人)</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="pb-1.5 pr-2">选手</th>
              <th className="pb-1.5 pr-2">特工</th>
              <th className="pb-1.5 pr-2">ACS</th>
              <th className="pb-1.5 pr-2">K</th>
              <th className="pb-1.5 pr-2">D</th>
              <th className="pb-1.5 pr-2">A</th>
              <th className="pb-1.5 pr-2">首杀</th>
            </tr>
          </thead>
          <tbody>
            {teamStats.map((ps: any, i: number) => {
              const maybeAgent = ps.playerName && isAgent(ps.playerName);
              const name = maybeAgent ? "" : (ps.playerName || ps.userName || "?");
              const agent = maybeAgent ? ps.playerName : (ps.agent || ps.stats?.agent || "-");
              const s = ps.stats || ps;
              return (
                <tr key={i} className="border-b border-zinc-800/30">
                  <td className="py-1.5 pr-2 font-medium text-zinc-300">{name}</td>
                  <td className="py-1.5 pr-2 text-zinc-400">{agent}</td>
                  <td className="py-1.5 pr-2 text-blue-400">{s.acs ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-green-400">{s.kills ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-red-400">{s.deaths ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-yellow-400">{s.assists ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-zinc-400">{s.firstBlood ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
