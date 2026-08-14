// @ts-nocheck
"use client";

import React, { useMemo } from "react";

export interface BracketMatch {
  id: number;
  stage: string;
  round: number;
  position: number;
  team1Id: number | null;
  team1Name: string | null;
  team2Id: number | null;
  team2Name: string | null;
  winnerId: number | null;
  status: string;
  gamesPerMatch?: number;
}

interface BracketTreeProps {
  matches: BracketMatch[];
  format?: string;
  onMatchClick?: (match: BracketMatch) => void;
}

// layout constants
const MATCH_W = 200;
const MATCH_H = 64;
const V_GAP = 14;
const H_GAP = 72;
const COL_W = MATCH_W + H_GAP;
const PADDING_X = 24;
const PADDING_Y = 20;
const Y_OFFSET = 40;
// helpers
function getRoundLabel(ms, ri, keys, stageLabel) {
  // For league regular season
  if (stageLabel === "常规赛") {
    return "第" + (ri + 1) + "轮";
  }
  // For losers bracket
  if (stageLabel === "败者组") {
    if (ri === keys.length - 1) return "败者组决赛";
    // Non-final LB rounds: numbered
    return "第" + (ri + 1) + "轮";
  }
  // For winners bracket last round
  if (stageLabel === "胜者组" && ri === keys.length - 1 && ms.length === 1) {
    return "胜者组决赛";
  }
  // Standard count-based labels
  if (ms.length >= 8) return "1/8决赛";
  if (ms.length >= 4) return "1/4决赛";
  if (ms.length >= 2) return "半决赛";
  return "决赛";
}

function sortMatchesByRoundPos(ms: any) {
  return [...ms].sort((a, b) => a.round - b.round || a.position - b.position);
}

function groupByRound(matches: any) {
  var map = {};
  for (var _i = 0; _i < matches.length; _i++) {
    var m = matches[_i];
    if (!map[m.round]) map[m.round] = [];
    map[m.round].push(m);
  }
  var keys = Object.keys(map).map(Number).sort(function(a,b){return a-b;});
  var sorted = {};
  for (var _j = 0; _j < keys.length; _j++) {
    var k = keys[_j];
    map[k].sort(function(a,b){return a.position - b.position;});
    sorted[k] = map[k];
  }
  return { byRound: sorted, keys: keys };
}

function getBracketHeight(round0matches: any) {
  if (!round0matches || round0matches.length === 0) return PADDING_Y * 2 + MATCH_H;
  var lastPos = round0matches[round0matches.length - 1].position;
  return PADDING_Y * 2 + lastPos * (MATCH_H + V_GAP) + MATCH_H;
}

function computeYPositions(byRound, keys, stageLabel) {
  var yMap = {};
  if (keys.length === 0) return yMap;
  var r0 = keys[0];
  var r0ms = byRound[r0] || [];
  for (var _i = 0; _i < r0ms.length; _i++) {
    var m = r0ms[_i];
    yMap[r0 + ":" + m.position] = m.position * (MATCH_H + V_GAP) + MATCH_H / 2 + Y_OFFSET;
  }
  for (var ri = 1; ri < keys.length; ri++) {
    var r = keys[ri];
    var prevR = keys[ri - 1];
    var ms = byRound[r] || [];
    var prevMs = byRound[prevR] || [];
    // 1:1 mapping: prev round has same count, matches share same Y positions
    if (ms.length === prevMs.length) {
      for (var _i2 = 0; _i2 < ms.length; _i2++) {
        var m = ms[_i2];
        yMap[r + ":" + m.position] = yMap[prevR + ":" + m.position];
      }
    } else {
      // 2:1 binary tree merge
      for (var _i3 = 0; _i3 < ms.length; _i3++) {
        var m = ms[_i3];
        var p1 = m.position * 2;
        var p2 = m.position * 2 + 1;
        var y1 = yMap[prevR + ":" + p1];
        var y2 = yMap[prevR + ":" + p2];
        if (y1 != null && y2 != null) {
          yMap[r + ":" + m.position] = (y1 + y2) / 2;
        } else if (y1 != null) {
          yMap[r + ":" + m.position] = y1;
        } else if (y2 != null) {
          yMap[r + ":" + m.position] = y2;
        } else {
          yMap[r + ":" + m.position] = PADDING_Y + MATCH_H / 2 + Y_OFFSET;
        }
      }
    }
  }
  return yMap;
}

function buildConnectorPaths(byRound, keys, yMap) {
  var paths = [];
  for (var ri = 1; ri < keys.length; ri++) {
    var r = keys[ri];
    var prevR = keys[ri - 1];
    var curMs = byRound[r] || [];
    var prevMs = byRound[prevR] || [];
    var parentRightX = PADDING_X + (ri - 1) * COL_W + MATCH_W;
    var childLeftX = PADDING_X + ri * COL_W;

    if (curMs.length === prevMs.length) {
      // 1:1 mapping - straight horizontal lines at same Y
      for (var _i = 0; _i < curMs.length; _i++) {
        var m = curMs[_i];
        var y = yMap[r + ":" + m.position];
        if (y != null) {
          paths.push({ d: "M " + parentRightX + " " + y + " H " + childLeftX });
        }
      }
    } else {
      // 2:1 binary tree connector
      for (var _i2 = 0; _i2 < curMs.length; _i2++) {
        var m = curMs[_i2];
        var p1 = m.position * 2;
        var p2 = m.position * 2 + 1;
        var yChild = yMap[r + ":" + m.position];
        var y1 = yMap[prevR + ":" + p1];
        var y2 = yMap[prevR + ":" + p2];
        if (yChild == null) continue;
        var midX = PADDING_X + (ri - 1) * COL_W + MATCH_W + H_GAP / 2;
        if (y1 != null && y2 != null && Math.abs(y1 - y2) > 1) {
          paths.push({ d: "M " + parentRightX + " " + y1 + " H " + midX });
          paths.push({ d: "M " + parentRightX + " " + y2 + " H " + midX });
          paths.push({ d: "M " + midX + " " + y1 + " V " + y2 });
          paths.push({ d: "M " + midX + " " + yChild + " H " + childLeftX });
        } else if (y1 != null) {
          paths.push({ d: "M " + parentRightX + " " + y1 + " H " + childLeftX });
        } else if (y2 != null) {
          paths.push({ d: "M " + parentRightX + " " + y2 + " H " + childLeftX });
        }
      }
    }
  }
  return paths;
}
// Render one stage as a horizontal bracket tree
function StageBracket(props: any) {
  var label = props.label;
  var matches = props.matches;
  var onMatchClick = props.onMatchClick;

  var layout = useMemo(function () {
    var grouped = groupByRound(matches);
    var byRound = grouped.byRound;
    var keys = grouped.keys;
    var yMap = computeYPositions(byRound, keys, label);
    var r0ms = byRound[keys[0]] || [];
    var totalH = getBracketHeight(r0ms);
    var totalW = keys.length > 0 ? keys.length * COL_W + PADDING_X * 2 : 400;
    var connPaths = buildConnectorPaths(byRound, keys, yMap);
    var svgD = connPaths.map(function(p){return p.d;}).join(" ");
    return { byRound: byRound, keys: keys, yMap: yMap, totalH: totalH, totalW: totalW, svgD: svgD, connPaths: connPaths };
  }, [matches]);

  var byRound = layout.byRound;
  var keys = layout.keys;
  var yMap = layout.yMap;
  var totalH = layout.totalH;
  var totalW = layout.totalW;
  var svgD = layout.svgD;

  if (keys.length === 0) return null;

  return React.createElement("div", { className: "relative", style: { height: totalH, width: totalW, minWidth: totalW } },
    label ? React.createElement("div", { className: "absolute left-6 top-1 z-10", key: "label" },
      React.createElement("span", { className: "inline-block rounded-md border border-zinc-700/50 bg-zinc-800/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300" }, label)
    ) : null,
    React.createElement("svg", { className: "absolute inset-0 pointer-events-none", width: totalW, height: totalH, style: { overflow: "visible" }, key: "svg" },
      React.createElement("path", { d: svgD, fill: "none", stroke: "rgb(63,63,70)", strokeWidth: "2", strokeLinejoin: "round" })
    ),
    keys.map(function(r, ri) {
      var ms = byRound[r] || [];
      var x = PADDING_X + ri * COL_W;
      var roundLabel = getRoundLabel(ms, ri, keys, label);
      var isFinal = ri === keys.length - 1 && ms.length === 1;
      return React.createElement("div", { key: r, className: "absolute top-0", style: { left: x } },
        React.createElement("div", { className: "absolute z-10 top-0 left-0 text-center pb-1 pt-0.5 bg-zinc-950/80 rounded", style: { width: MATCH_W } },
          React.createElement("span", { className: "text-[11px] font-semibold uppercase tracking-widest text-zinc-500" },
            isFinal && label !== "\u80dc\u8005\u7ec4" && label !== "\u8d25\u8005\u7ec4" ? "\u603b\u51b3\u8d5b" : roundLabel,
            isFinal ? React.createElement("span", { className: "ml-2 text-[10px] text-yellow-500" }, "🏆") : null
          )
        ),
        React.createElement("div", { className: "absolute top-0", style: { width: MATCH_W } },
          ms.map(function(m) {
            var y = yMap[r + ":" + m.position] || PADDING_Y;
            var top = y - MATCH_H / 2;
            var isComplete = m.status === "COMPLETED";
            var hasBothTeams = m.team1Id && m.team2Id;
            var w1 = m.winnerId === m.team1Id;
            var w2 = m.winnerId === m.team2Id;
            return React.createElement("button", {
              key: m.id,
              onClick: function() { if (hasBothTeams && onMatchClick) onMatchClick(m); },
              className: "absolute left-0 flex flex-col rounded-lg border transition " +
                (isComplete ? "border-green-700/50 bg-green-900/15" : "border-zinc-700/60 bg-zinc-800/80 hover:border-zinc-500/60") +
                (hasBothTeams ? " cursor-pointer" : " cursor-default"),
              style: { width: MATCH_W, height: MATCH_H, top: top }
            },
              React.createElement("div", { className: "flex flex-1 items-center justify-between rounded-t-[7px] px-3 text-xs " + (w1 ? "bg-green-600/20 text-green-300" : "text-zinc-300") },
                React.createElement("span", { className: "truncate font-medium" }, m.team1Name || "待定"),
                w1 ? React.createElement("span", { className: "ml-1 text-[10px] font-bold text-green-400" }, "W") : null
              ),
              React.createElement("div", { className: "border-t border-zinc-700/40" }),
              React.createElement("div", { className: "flex flex-1 items-center justify-between rounded-b-[7px] px-3 text-xs " + (w2 ? "bg-green-600/20 text-green-300" : "text-zinc-300") },
                React.createElement("span", { className: "truncate font-medium" }, m.team2Name || "待定"),
                w2 ? React.createElement("span", { className: "ml-1 text-[10px] font-bold text-green-400" }, "W") : null
              ),
            );
          })
        )
      );
    })
  );
}
// Main BracketTree component
export default function BracketTree(props: any) {
  var matches = props.matches;
  var format = props.format;
  var onMatchClick = props.onMatchClick;

  // Group by stage
  var stageMap = {};
  for (var _i = 0; _i < matches.length; _i++) {
    var m = matches[_i];
    var s = m.stage || "WINNERS";
    if (!stageMap[s]) stageMap[s] = [];
    stageMap[s].push(m);
  }
  var stageKeys = Object.keys(stageMap);

  if (matches.length === 0) {
    return React.createElement("div", { className: "flex items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16" },
      React.createElement("p", { className: "text-sm text-zinc-500" }, "\u6682\u65e0\u6bd4\u8d5b\u6570\u636e")
    );
  }

  // For single elim or single-stage brackets
  if (format !== "DOUBLE_ELIM" || stageKeys.length <= 1) {
    var sorted = sortMatchesByRoundPos(matches);
    var isLeague = format === "SINGLE_RR" || format === "DOUBLE_RR";
    return React.createElement(StageBracket, { matches: sorted, onMatchClick: onMatchClick, label: isLeague ? "常规赛" : null });
  }

  // For double elimination
  var wb = stageMap["WINNERS"] || [];
  var lb = stageMap["LOSERS"] || [];
  var gf = stageMap["GRAND_FINAL"] || [];

  var sections = [];
  if (wb.length > 0) sections.push({ label: "\u80dc\u8005\u7ec4", data: wb });
  if (lb.length > 0) sections.push({ label: "\u8d25\u8005\u7ec4", data: lb });
  if (gf.length > 0) sections.push({ label: "\u603b\u51b3\u8d5b", data: gf });

  return React.createElement("div", { className: "space-y-10" },
    sections.map(function(sec) {
      return React.createElement("div", { key: sec.label },
        React.createElement(StageBracket, { label: sec.label, matches: sec.data, onMatchClick: onMatchClick })
      );
    })
  );
}