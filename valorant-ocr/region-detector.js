'use strict';

/**
 * 战绩图区域检测器
 * detectScoreboardRegion — 垂直：亮度跳变找行分隔线
 * detectDataBounds — 水平：左→右扫描找左边界(rowColor)，右→左扫描找右边界(rowColorRelaxed)
 * computeColumnMapping — 标准图参考坐标比例映射
 */

// ===== 标准图（1920x1080）参考坐标 =====
const REF_LEFT = 262;
const REF_RIGHT = 1597;
const REF_WIDTH = REF_RIGHT - REF_LEFT;  // 1335

const REF_COLUMNS = {
  ign:      { x: 330, width: 220 },
  agent:    { x: 330, width: 220 },
  acs:      { x: 633, width: 187 },
  kda:      { x: 820, width: 160 },
  economy:  { x: 0,   width: 0 },
  firstBlood: { x: 1150, width: 110 }
};

/**
 * 行背景色：标准亮度（用于左→右扫描）
 */
function isRowColor(r, g, b) {
  if (r + g + b < 80) return false;
  if (r > 220 && g > 220 && b > 200) return false;
  if (g > r + 20 && g > b - 10 && g > 80) return true;   // 青
  if (r > g + 15 && r > b && r > 80) return true;         // 红
  if (r > 120 && g > 120 && Math.abs(r - g) < 35 && r - b > 15) return true; // 黄
  return false;
}

/**
 * 行背景色：宽松版（用于右→左扫描，右边界颜色可能更暗）
 */
function isRowColorRelaxed(r, g, b) {
  if (r + g + b < 50) return false;       // 比标准版允许更暗
  if (r > 220 && g > 220 && b > 200) return false;

  // 青色：阈值降低
  if (g > r + 15 && g > b - 15 && g > 55) return true;
  // 红色：阈值降低
  if (r > g + 10 && r > b && r > 55) return true;
  // 黄色：阈值降低
  if (r > 90 && g > 90 && Math.abs(r - g) < 40 && r - b > 10) return true;

  return false;
}

/**
 * 垂直方向行分隔线检测
 */
function detectScoreboardRegion(image) {
  const W = image.bitmap.width;
  const H = image.bitmap.height;

  const scanStartY = Math.round(60 * H / 1080);
  const scanEndY = Math.round(960 * H / 1080);

  const sampleXs = [200, 250, 300, 350, 400, 450].map(x => Math.round(x * W / 1920));
  const scanRange = Math.round(60 * W / 1920);

  const yBrightness = {};

  for (const sx of sampleXs) {
    const startX = Math.max(0, sx - Math.floor(scanRange / 2));
    const endX = Math.min(W - 1, sx + Math.floor(scanRange / 2));
    const totalPx = endX - startX + 1;

    for (let y = scanStartY; y < scanEndY; y++) {
      let sum = 0;
      for (let x = startX; x <= endX; x++) {
        const idx = image.getPixelIndex(x, y);
        sum += (image.bitmap.data[idx] + image.bitmap.data[idx + 1] + image.bitmap.data[idx + 2]);
      }
      const avg = sum / totalPx;
      if (!yBrightness[y]) yBrightness[y] = [];
      yBrightness[y].push(avg);
    }
  }

  const yDrops = {};
  const sortedYs = Object.keys(yBrightness).map(Number).sort((a, b) => a - b);

  for (let i = 1; i < sortedYs.length; i++) {
    const y = sortedYs[i];
    const prev = sortedYs[i - 1];

    if (y - prev > 2) continue;

    let totalDrop = 0;
    let dropCount = 0;

    for (let j = 0; j < yBrightness[y].length; j++) {
      const drop = yBrightness[prev] ? (yBrightness[prev][j] || 0) - (yBrightness[y][j] || 0) : 0;
      if (drop > 30 && (yBrightness[y][j] || 0) < 130) {
        totalDrop += drop;
        dropCount++;
      }
    }

    if (dropCount >= 2) {
      yDrops[y] = { avgDrop: totalDrop / dropCount, count: dropCount };
    }
  }

  const dropYs = Object.keys(yDrops).map(Number).sort((a, b) => a - b);

  if (dropYs.length < 10) {
    return { detected: false };
  }

  const groups = [];
  let curGroup = [dropYs[0]];
  for (let i = 1; i < dropYs.length; i++) {
    if (dropYs[i] - curGroup[curGroup.length - 1] <= 3) {
      curGroup.push(dropYs[i]);
    } else {
      groups.push(curGroup);
      curGroup = [dropYs[i]];
    }
  }
  groups.push(curGroup);

  const separators = groups.map(g => {
    g.sort((a, b) => a - b);
    return g[Math.floor(g.length / 2)];
  }).sort((a, b) => a - b);

  if (separators.length < 7) {
    return { detected: false };
  }

  const gaps = [];
  for (let i = 1; i < separators.length; i++) {
    gaps.push(separators[i] - separators[i - 1]);
  }

  let modeGap = gaps[0];
  let maxCount = 1;
  for (let i = 0; i < gaps.length; ) {
    let count = 1;
    let j = i + 1;
    while (j < gaps.length && Math.abs(gaps[j] - gaps[i]) <= 2) {
      count++;
      j++;
    }
    if (count > maxCount) {
      maxCount = count;
      modeGap = Math.round(gaps.slice(i, j).reduce((a, b) => a + b, 0) / count);
    }
    i = j;
  }

  const rowHeight = modeGap;
  const dataStart = separators[0] - rowHeight;
  const dataEnd = separators[separators.length - 1];
  const rowCount = separators.length;

  return { detected: true, dataStart, dataEnd, rowHeight, rowCount, separators };
}

/**
 * 水平方向数据区边界检测
 *
 * 左边界：左→右扫描，用 isRowColor（标准），找到第一个有效色块的起始
 * 右边界：右→左扫描，用 isRowColorRelaxed（宽松），找到第一个有效色块的末端
 * 容差扫描：允许色块内最多 MAX_GAP 个连续非色像素
 */
function detectDataBounds(image, region) {
  if (!region || !region.detected || region.rowCount < 8) {
    return { detected: false };
  }

  const W = image.bitmap.width;
  const H = image.bitmap.height;
  const { dataStart, rowHeight } = region;

  const MAX_GAP = 20;
  const MIN_BLOCK = 60;

  const rowLefts = [];
  const rowRights = [];

  for (let ri = 0; ri < region.rowCount; ri++) {
    const y = dataStart + ri * rowHeight + Math.round(rowHeight * 0.5);
    if (y >= H) continue;

    // === 左边界：左→右扫描 ===
    let leftEdge = -1;
    let gapCount = 0;
    let totalWidth = 0;

    for (let x = 0; x < W; x++) {
      const idx = image.getPixelIndex(x, y);
      const colored = isRowColor(image.bitmap.data[idx], image.bitmap.data[idx+1], image.bitmap.data[idx+2]);

      if (colored) {
        if (leftEdge < 0) leftEdge = x;
        gapCount = 0;
      } else if (leftEdge >= 0) {
        gapCount++;
        if (gapCount > MAX_GAP) {
          totalWidth = x - MAX_GAP - leftEdge;
          if (totalWidth < MIN_BLOCK) {
            leftEdge = -1;  // 块太小，重新找
          }
          gapCount = 0;
          break;  // 找到第一个有效块即停止
        }
      }
    }

    if (leftEdge >= 0 && gapCount <= MAX_GAP) {
      totalWidth = W - leftEdge;
    }

    // === 右边界：右→左扫描 ===
    let rightEdge = -1;
    gapCount = 0;

    for (let x = W - 1; x >= 0; x--) {
      const idx = image.getPixelIndex(x, y);
      const colored = isRowColorRelaxed(image.bitmap.data[idx], image.bitmap.data[idx+1], image.bitmap.data[idx+2]);

      if (colored) {
        if (rightEdge < 0) rightEdge = x;
        gapCount = 0;
      } else if (rightEdge >= 0) {
        gapCount++;
        if (gapCount > MAX_GAP) {
          totalWidth = rightEdge - (x + MAX_GAP + 1) + 1;
          if (totalWidth < MIN_BLOCK) {
            rightEdge = -1;
          }
          gapCount = 0;
          break;
        }
      }
    }

    if (rightEdge >= 0 && gapCount <= MAX_GAP) {
      totalWidth = rightEdge - 0 + 1;
    }

    if (leftEdge > 0 && rightEdge > leftEdge + 300) {
      rowLefts.push(leftEdge);
      rowRights.push(rightEdge);
    }
  }

  if (rowLefts.length < 6) {
    return { detected: false };
  }

  // 中位数统计
  rowLefts.sort((a, b) => a - b);
  rowRights.sort((a, b) => a - b);
  const mid = Math.floor(rowLefts.length / 2);

  const dataLeft = rowLefts[mid];
  const dataRight = rowRights[mid];
  const dataWidth = dataRight - dataLeft;

  if (dataWidth < 300) {
    return { detected: false };
  }

  return { detected: true, dataLeft, dataRight, dataWidth, rowCount: rowLefts.length };
}

/**
 * 比例映射列坐标
 */
function computeColumnMapping(dataBounds) {
  if (!dataBounds || !dataBounds.detected) return null;
  const { dataLeft, dataWidth } = dataBounds;

  const mapped = {};
  for (const [name, ref] of Object.entries(REF_COLUMNS)) {
    const xRatio = (ref.x - REF_LEFT) / REF_WIDTH;
    const wRatio = ref.width / REF_WIDTH;
    mapped[name] = {
      x: Math.round(dataLeft + xRatio * dataWidth),
      width: Math.round(wRatio * dataWidth)
    };
  }
  return mapped;
}

const REF_COLUMN_X = {};
for (const [k, v] of Object.entries(REF_COLUMNS)) {
  REF_COLUMN_X[k] = v.x;
}


// ===== Valorant 特工名称列表 =====
const AGENT_NAMES = [
  'K/O','幽影','壹决','夜露','星礈','贤者','维斯','铁臂','钛狐',
  '斯凯','尚勃勒','芮娜','奇乐','霓虹','暮蝶','迷核','零','猎枭',
  '炼狱','雷兹','蝰蛇','禁灭','捷风','幻棱','黑梦','海神','钢索','盖可','不死鸟'
];

/**
 * 从 IGN+agent 组合文字中提取 agent 名称，返回 {agent, ign}
 * 如果找不到 agent，agent = -1
 */
function extractAgent(rawName) {
  if (!rawName) return { agent: -1, ign: rawName || '' };
  const trimmed = rawName.trim();

  // 按空格分割
  const parts = trimmed.split(/\s+/);

  // 没有空格 → 整段都是 IGN，agent = -1
  if (parts.length < 2) {
    return { agent: -1, ign: trimmed };
  }

  // 有空格 → 取最后一段作为可能的 agent 名
  const lastWord = parts[parts.length - 1];

  // 1. 精确匹配
  const exact = AGENT_NAMES.find(a => a === lastWord);
  if (exact) {
    return { agent: exact, ign: parts.slice(0, -1).join(' ') };
  }

  // 2. 模糊匹配：找字符重叠度最高的
  let bestMatch = -1;
  let bestScore = 0;

  for (const agent of AGENT_NAMES) {
    // 如果 lastWord 是 agent 的子串（如 蛇→蝰蛇），或者反过来
    if (agent.includes(lastWord) || lastWord.includes(agent)) {
      const score = Math.min(lastWord.length, agent.length) / Math.max(lastWord.length, agent.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = agent;
      }
    }

    // 逐字符匹配
    const len = Math.min(lastWord.length, agent.length);
    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (lastWord[i] === agent[i]) matches++;
    }
    const charScore = matches / Math.max(lastWord.length, agent.length);
    if (charScore > bestScore) {
      bestScore = charScore;
      bestMatch = agent;
    }
  }

  // 相似度阈值 0.3 以上才认为匹配
  if (bestScore >= 0.3 && bestMatch !== -1) {
    return { agent: bestMatch, ign: parts.slice(0, -1).join(' ') };
  }

  // 3. 实在找不到
  return { agent: -1, ign: trimmed };
}
module.exports = {
  detectScoreboardRegion,
  detectDataBounds,
  computeColumnMapping,
  REF_LEFT,
  REF_RIGHT,
  REF_COLUMNS,
  REF_COLUMN_X,
  isRowColor,
  AGENT_NAMES,
  extractAgent
};



