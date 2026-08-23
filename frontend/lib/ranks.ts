// 规范化段位列表，按由低到高排序（与后端 Rank 枚举保持一致）。
// 黑铁（最低）→ 青铜/白银/黄金/铂金/钻石/超凡/神话 各分 1、2、3 → 源能战魂（最高）。
export const RANKS = [
  "黑铁",
  "青铜1", "青铜2", "青铜3",
  "白银1", "白银2", "白银3",
  "黄金1", "黄金2", "黄金3",
  "铂金1", "铂金2", "铂金3",
  "钻石1", "钻石2", "钻石3",
  "超凡1", "超凡2", "超凡3",
  "神话1", "神话2", "神话3",
  "源能战魂",
] as const;

export type Rank = (typeof RANKS)[number];

// 大段（段位组）：青铜/白银/黄金/铂金/钻石/超凡/神话 各包含 1/2/3 三个小段。
export const MAJOR_RANKS = [
  "黑铁",
  "青铜", "白银", "黄金", "铂金", "钻石", "超凡", "神话",
  "源能战魂",
] as const;

export type MajorRank = (typeof MAJOR_RANKS)[number];

/** 由小段位（如 黄金2）得到所属大段（黄金）；非法值返回空字符串。 */
export function majorRankOf(rank: string): string {
  const major = rank.replace(/[123]$/, "");
  return (MAJOR_RANKS as readonly string[]).includes(major) ? major : "";
}

// 段位评分表：黑铁 1 分；每个大段 base = 2 * 4^k，段内三小段为 base / base*1.5 / base*2。
export const RANK_SCORES: Record<string, number> = {
  "黑铁": 1,
  "青铜1": 2, "青铜2": 3, "青铜3": 4,
  "白银1": 8, "白银2": 12, "白银3": 16,
  "黄金1": 32, "黄金2": 48, "黄金3": 64,
  "铂金1": 128, "铂金2": 192, "铂金3": 256,
  "钻石1": 512, "钻石2": 768, "钻石3": 1024,
  "超凡1": 2048, "超凡2": 3072, "超凡3": 4096,
  "神话1": 8192, "神话2": 12288, "神话3": 16384,
  "源能战魂": 32768,
};

/** 段位顺序值，1 最低，23 最高；非法段位返回 0。 */
export function rankOrder(rank: string): number {
  const idx = (RANKS as readonly string[]).indexOf(rank);
  return idx === -1 ? 0 : idx + 1;
}

/** 段位评分，非法/未认证段位按最低段位（黑铁）计分。 */
export function rankScore(rank: string): number {
  return RANK_SCORES[rank] ?? 1;
}
