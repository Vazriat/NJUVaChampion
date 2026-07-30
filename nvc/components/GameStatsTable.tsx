"use client";

import React from "react";

export interface PlayerStatEntry {
  userId: number;
  playerName: string;
  userName: string;
  teamId: number;
  stats: Record<string, any>;
}

export interface StatColumnDef {
  key: string;
  label: string;
  editable: boolean;
  type: "text" | "number" | "select";
  options?: string[];
}

const AGENT_LIST = [
  "K/O", "幽影", "壹决", "夜露", "星礈", "贤者", "维斯", "铁臂", "钛狐",
  "斯凯", "尚勃勒", "芮娜", "奇乐", "霓虹", "暮蝶", "迷核", "零", "猎枭",
  "炼狱", "雷兹", "蝰蛇", "禁灭", "捷风", "幻棱", "黑梦", "海神", "钢索", "盖可", "不死鸟",
];

export interface TeamMemberInfo {
  userId: number;
  username: string;
  displayName: string;
}

interface GameStatsTableProps {
  players: PlayerStatEntry[];
  columns: StatColumnDef[];
  team1Id: number;
  team2Id: number;
  team1Name?: string;
  team2Name?: string;
  team1Members?: TeamMemberInfo[];
  team2Members?: TeamMemberInfo[];
  onChange: (players: PlayerStatEntry[]) => void;
}

export default function GameStatsTable({
  players, columns, team1Id, team2Id, team1Name, team2Name, team1Members, team2Members, onChange,
}: GameStatsTableProps) {

  const updateStat = (index: number, key: string, value: any) => {
    const updated = [...players];
    updated[index] = {
      ...updated[index],
      stats: { ...updated[index].stats, [key]: value },
    };
    onChange(updated);
  };

  const team1Players = players.filter(p => p.teamId === team1Id);
  const team2Players = players.filter(p => p.teamId === team2Id);

  const renderRow = (p: PlayerStatEntry, idx: number, globalIdx: number) => (
    <tr key={globalIdx} className="border-b border-zinc-800/50 text-sm">
      <td className="py-2 px-3 text-zinc-400 text-xs w-8 text-center">{globalIdx + 1}</td>
      <td className="py-2 px-3 font-medium text-zinc-200">
        {columns.find(c => c.key === "agent" && c.editable)
          ? <input
              type="text"
              value={p.playerName || p.userName || ""}
              onChange={e => {
                const updated = [...players];
                updated[globalIdx] = { ...updated[globalIdx], playerName: e.target.value, userName: e.target.value };
                onChange(updated);
              }}
              className="w-full bg-transparent border-b border-transparent focus:border-red-500 outline-none text-zinc-200"
            />
          : (p.playerName || p.userName || "?")
        }
      </td>
      <td className="py-2 px-3">
        <select
          value={p.teamId || 0}
          onChange={e => {
            const updated = [...players];
            updated[globalIdx] = { ...updated[globalIdx], teamId: Number(e.target.value) };
            onChange(updated);
          }}
          className={"w-20 bg-zinc-800 border-zinc-700 text-sm font-semibold rounded border px-2 py-1 outline-none " + (p.teamId ? "text-white" : "text-amber-300")}
        >
          <option value={0} style={{color:'#999'}}>未分配</option>
          <option value={team1Id}>{team1Name || "队伍A"}</option>
          <option value={team2Id}>{team2Name || "队伍B"}</option>
        </select>
      </td>
      <td className="py-2 px-3">
        <select
          value={p.userId || 0}
          onChange={e => {
            const uid = Number(e.target.value);
            const allM = (team1Members || []).concat(team2Members || []);
            const member = allM.find(m => m.userId === uid);
            const updated = [...players];
            if (member) {
              // Determine which team this member belongs to
              const inTeam1 = (team1Members || []).some(m => m.userId === uid);
              updated[globalIdx] = { ...updated[globalIdx], userId: uid, teamId: inTeam1 ? team1Id : team2Id };
            } else {
              updated[globalIdx] = { ...updated[globalIdx], userId: 0 };
            }
            onChange(updated);
          }}
          className={"w-28 bg-zinc-800 border-zinc-700 text-xs rounded border px-2 py-1 outline-none " + (p.userId ? "text-white" : "text-amber-300")}
        >
          <option value={0}>\u4e0d\u7ed1\u5b9a</option>
          {/* Filter members based on current team selection */}
          {(p.teamId && p.teamId !== 0
            ? (p.teamId === team1Id ? (team1Members || []) : (team2Members || []))
            : (team1Members || []).concat(team2Members || [])
          ).map(m => (
            <option key={m.userId} value={m.userId}>{m.username}{m.displayName && m.displayName !== m.username ? " (" + m.displayName + ")" : ""}</option>
          ))}
        </select>
      </td>
      {columns.map(col => (
        <td key={col.key} className="py-2 px-3">
          {renderCell(p, globalIdx, col)}
        </td>
      ))}
    </tr>
  );

  const renderCell = (p: PlayerStatEntry, idx: number, col: StatColumnDef) => {
    const value = p.stats?.[col.key];

    // Highlight -1 or null values that need attention
    const needsAttention = value === -1 || value === null || value === undefined || value === "";
    const cellClass = needsAttention && !col.editable ? "text-amber-400 font-semibold" : "text-zinc-300";

    if (!col.editable) {
      if (col.type === "number") return <span className={cellClass}>{needsAttention ? "?输入" : value}</span>;
      return <span className={cellClass}>{value ?? "-"}</span>;
    }

    if (col.type === "select") {
      const isAgentCol = col.key === "agent";
      return (
        <select
          value={value || ""}
          onChange={e => updateStat(idx, col.key, e.target.value)}
          className={"rounded border px-2 py-1 text-white outline-none focus:border-red-500 " + (isAgentCol ? "w-20 bg-zinc-800 border-zinc-700 text-sm font-semibold" : "w-full bg-zinc-800 border-zinc-700 text-xs")}
        >
          <option value="">-</option>
          {AGENT_LIST.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      );
    }

    if (col.type === "number") {
      const borderClass = needsAttention ? "border-amber-500" : "border-zinc-700";
      return (
        <input
          type="number"
          value={value ?? ""}
          onChange={e => updateStat(idx, col.key, e.target.value === "" ? null : Number(e.target.value))}
          className={"w-full rounded bg-zinc-800 border px-2 py-1 text-xs text-white outline-none focus:border-red-500 " + borderClass}
        />
      );
    }

    return (
      <input
        type="text"
        value={value ?? ""}
        onChange={e => updateStat(idx, col.key, e.target.value)}
        className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-white outline-none focus:border-red-500"
      />
    );
  };

  const renderTeamSection = (teamPlayers: PlayerStatEntry[], label: string) => {
    if (teamPlayers.length === 0) return null;
    const startIdx = players.indexOf(teamPlayers[0]);
    return (
      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{label} ({teamPlayers.length}人)</h4>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-[11px] text-zinc-500 uppercase tracking-wider">
              <th className="pb-2 px-3 w-8">#</th>
              <th className="pb-2 px-3">选手</th>
              <th className="pb-2 px-3">队伍</th>
              {columns.map(col => (
                <th key={col.key} className="pb-2 px-3">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamPlayers.map((p, i) => renderRow(p, i, startIdx + i))}
          </tbody>
        </table>
      </div>
    );
  };

  // Unassigned players (teamId not matching either team)
  const unassignedPlayers = players.filter(p => p.teamId !== team1Id && p.teamId !== team2Id);

  return (
    <div className="space-y-2">
      {renderTeamSection(team1Players, team1Name || "队伍 A")}
      {renderTeamSection(team2Players, team2Name || "队伍 B")}
      {renderTeamSection(unassignedPlayers, "未分配")}
      {players.length === 0 && (
        <p className="py-8 text-center text-xs text-zinc-500">暂无选手数据</p>
      )}
    </div>
  );
}
