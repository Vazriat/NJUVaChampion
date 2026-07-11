'use strict';

/**
 * 结果解析器 — 将 OCR 识别的多列结果合并为球员列表
 */
class ResultParser {
  /**
   * @param {object} nameCleaning - 名字清洗配置
   * @param {object} [playersConfig] - 玩家配置（含列定义）
   */
  constructor(nameCleaning, playersConfig) {
    this.removeChars = (nameCleaning && nameCleaning.enabled !== false)
      ? (nameCleaning.removeChars || ["'", '"', '`', ',', '.', '|'])
      : [];
    this.playersConfig = playersConfig;
  }

  cleanName(raw) {
    let name = String(raw || '');
    for (const ch of this.removeChars) {
      name = name.split(ch).join('');
    }
    return name.trim();
  }

  /**
   * full-column 策略：整列OCR结果解析
   * columnResults 中每列是单层字符串数组（整列识别出的所有文字行）
   * ign：偶数行为ID，奇数行为Agent（每行两段文字裁在同一列）
   * acs/kda/firstBlood：依次对应每位玩家
   */
  parseFullColumn(columnResults, enabledCols) {
    const players = [];
    const playerCount = 10;

    for (let pi = 0; pi < playerCount; pi++) {
      const player = {};

      for (const [colName, col] of enabledCols) {
        const allLines = columnResults[colName] || [];

        switch (colName) {
          case 'ign': {
            // 偶数行（0,2,4...）为ID
            const idx = pi * 2;
            const raw = allLines[idx] || '';
            player.name = this.cleanName(raw);
            break;
          }
          case 'agent': {
            // 奇数行（1,3,5...）为特工名
            const idx = pi * 2 + 1;
            const raw = allLines[idx] || '';
            player.agent = raw;
            break;
          }
          case 'acs': {
            const raw = allLines[pi] || '';
            const nums = raw.replace(/[^0-9]/g, '');
            player.acs = nums ? parseInt(nums, 10) : null;
            break;
          }
          case 'kda': {
            const raw = allLines[pi] || '';
            const parts = raw.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
            if (parts) {
              player.kda = { kills: parseInt(parts[1]), deaths: parseInt(parts[2]), assists: parseInt(parts[3]) };
            } else {
              const nums = raw.replace(/[^0-9]/g, '');
              if (nums.length >= 3) {
                player.kda = rawText;
              }
            }
            break;
          }
          case 'firstBlood': {
            const raw = allLines[pi] || '';
            const nums = raw.replace(/[^0-9]/g, '');
            player.firstBlood = nums ? parseInt(nums, 10) : null;
            break;
          }
          default:
            player[colName] = allLines[pi] || '';
        }
      }

      players.push(player);
    }

    console.log('[parser] full-column 解析完成，共 ' + players.length + ' 位玩家');
    return { players, rawResults: columnResults };
  }

  /**
   * 解析多列 OCR 结果
   * @param {Object} columnResults - { ign: string[][], acs: string[][], ... }
   *   每个数组对应每位球员在该列的 OCR 识别行
   * @returns {{ players: Object[], rawResults: Object }}
   */
  parseMultiColumn(columnResults) {
    const columns = this.playersConfig ? this.playersConfig.columns : null;
    if (!columns) {
      return { players: [], rawResults: columnResults };
    }

    // 找出启用的列和球员数量
    const enabledCols = Object.entries(columns).filter(([, col]) => col.enabled);
    if (enabledCols.length === 0) {
      return { players: [], rawResults: columnResults };
    }

    const playerCount = Math.min(
      ...enabledCols.map(([name]) => (columnResults[name] || []).length)
    );

    const players = [];
    for (let pi = 0; pi < playerCount; pi++) {
      const player = {};

      for (const [colName, col] of enabledCols) {
        const lines = (columnResults[colName] || [])[pi] || [];
        const rawText = lines.join(' ');

        switch (colName) {
          case 'ign':
            player.name = this.cleanName(lines[0] || '');
            player.agent = lines[1] || '零';
            break;
          case 'agent':
            player.agent = rawText;
            break;
          case 'acs': {
            // 提取数字
            const nums = rawText.replace(/[^0-9]/g, '');
            player.acs = nums ? parseInt(nums, 10) : null;
            break;
          }
          case 'kda': {
            // 提取 KDA 格式
            const parts = rawText.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
            if (parts) {
              player.kda = { kills: parseInt(parts[1]), deaths: parseInt(parts[2]), assists: parseInt(parts[3]) };
            } else {
              // 尝试纯数字提取
              const nums = rawText.replace(/[^0-9]/g, '');
              if (nums.length >= 3) {
                player.kda = rawText;
              }
            }
            break;
          }
          case 'economy': {
            const nums = rawText.replace(/[^0-9]/g, '');
            player.economy = nums ? parseInt(nums, 10) : null;
            break;
          }
          case 'firstBlood': {
            const nums = rawText.replace(/[^0-9]/g, '');
            player.firstBlood = nums ? parseInt(nums, 10) : null;
            break;
          }
          default:
            player[colName] = rawText;
        }
      }

      players.push(player);
    }

    return { players, rawResults: columnResults };
  }

  /**
   * 旧版解析：名字行与分数行匹配（兼容旧接口）
   */
  parse(nameLines, scoreLines) {
    const players = [];
    const minLen = Math.min(nameLines.length, scoreLines.length);

    for (let i = 0; i < minLen; i++) {
      const cleaned = this.cleanName(nameLines[i]);
      if (!cleaned) continue;

      const scoreStr = scoreLines[i].replace(/[^0-9\-]/g, '');
      const score = scoreStr ? parseInt(scoreStr, 10) : null;

      players.push({ name: cleaned, score });
    }

    console.log('[parser] 成功解析 ' + players.length + ' 位玩家');
    return players;
  }
}

module.exports = ResultParser;
