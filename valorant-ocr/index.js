'use strict';

const { loadConfig } = require('./config');
const { loadImage } = require('./image-loader');
const ImageProcessor = require('./image-processor');
const OcrEngine = require('./ocr-engine');
const PaddleOcrEngine = require('./paddle-ocr-engine');
const ResultParser = require('./result-parser');
const { detectScoreboardRegion, detectDataBounds, computeColumnMapping, extractAgent } = require('./region-detector');
const jimp = require('jimp');

class ValorantOcr {
  constructor(options = {}) {
    const cfg = options.config || loadConfig(options.configPath);
    this.config = cfg;
    this.processor = new ImageProcessor(cfg.crop, cfg.blot, cfg.players);

    const engineName = (cfg.ocr && cfg.ocr.engine) || 'tesseract';
    if (engineName === 'paddle') {
      console.log('[ocr-module] 使用 PaddleOCR 引擎');
      this.ocr = new PaddleOcrEngine(cfg.ocr);
      // 设置每列的语言
      const cols = cfg.players && cfg.players.columns;
      if (cols) {
        this.ocr.columnLanguages = {};
        for (const [cn, col] of Object.entries(cols)) {
          if (col.language) this.ocr.columnLanguages[cn] = col.language;
        }
      }
    } else {
      console.log('[ocr-module] 使用 Tesseract.js 引擎');
      this.ocr = new OcrEngine(cfg.ocr, cfg.players ? cfg.players.columns : null);
    }

    this.parser = new ResultParser(cfg.nameCleaning, cfg.players);
    this.strategy = (cfg.crop && cfg.crop.strategy) || 'blot';
    this.autoDetect = cfg.autoDetect !== false;
  }

  async parseScreenshot(source) {
    try {
      const { buffer } = await loadImage(source);
      console.log('[ocr-module] 图片加载完成');

      let fullRegion = null;
      let mappedColumns = null;

      if (this.autoDetect && (this.strategy === 'per-player-crop' || this.strategy === 'row-wise')) {
        const image = await jimp.read(buffer);

        const vertical = detectScoreboardRegion(image);
        if (!vertical || !vertical.detected) {
          console.log('[ocr-module] 垂直检测未生效，使用硬编码坐标');
        } else {
          console.log('[ocr-module] 垂直检测: ' + vertical.rowCount + ' 行, 行高 ' + vertical.rowHeight + 'px');

          const horizontal = detectDataBounds(image, vertical);
          if (horizontal && horizontal.detected) {
            console.log('[ocr-module] 水平检测: left=' + horizontal.dataLeft + ' right=' + horizontal.dataRight + ' width=' + horizontal.dataWidth);

            fullRegion = {
              detected: true,
              dataStart: vertical.dataStart,
              dataEnd: vertical.dataEnd,
              rowHeight: vertical.rowHeight,
              rowCount: vertical.rowCount,
              separators: vertical.separators,
              dataLeft: horizontal.dataLeft,
              dataRight: horizontal.dataRight,
              dataWidth: horizontal.dataWidth
            };

            mappedColumns = computeColumnMapping(horizontal);
            if (mappedColumns) {
              console.log('[ocr-module] 列坐标映射:');
              for (const [name, mc] of Object.entries(mappedColumns)) {
                if (mc.width > 0) console.log('  ' + name + ': x=' + mc.x + ' w=' + mc.width);
              }
              this.processor.setMappedColumns(mappedColumns);
            }
          } else {
            console.log('[ocr-module] 水平检测未生效');
          }
        }
      }

      if (this.strategy === 'row-wise') {
        return await this._parseRowWise(buffer, fullRegion, mappedColumns);
      }
      if (this.strategy === 'full-column') {
        return await this._parseFullColumn(buffer);
      }
      if (this.strategy === 'per-player-crop') {
        return await this._parsePerPlayer(buffer, fullRegion);
      }
      return await this._parseLegacy(buffer);
    } finally {
      await this.shutdown();
    }
  }

  // ========== 行式OCR — 两遍方案 ==========
  // Pass 1: 整行OCR，获取文字位置 → 确定每列精确裁剪范围
  // Pass 2: 按列分语言重新OCR（IGN用ch，数字列用en+阈值黑白化）
  async _parseRowWise(buffer, fullRegion, mappedColumns) {
    if (!fullRegion || !mappedColumns) {
      throw new Error('row-wise strategy requires region detection and column mapping');
    }

    const image = await jimp.read(buffer);
    const { dataLeft, dataRight, dataWidth, dataStart, rowHeight, rowCount } = fullRegion;

    // 列区间（原始图坐标）
    const columnRanges = {};
    const enabledCols = this.config.players && this.config.players.columns
      ? Object.entries(this.config.players.columns).filter(([,c])=>c.enabled).map(([n])=>n)
      : Object.keys(mappedColumns);
    for (const name of enabledCols) {
      const mc = mappedColumns[name];
      if (mc && mc.width > 0) {
        columnRanges[name] = { start: mc.x, end: mc.x + mc.width };
      }
    }

    // ===== Pass 1: 整行OCR =====
    const rowCropped = [];
    for (let ri = 0; ri < rowCount; ri++) {
      const y = dataStart + ri * rowHeight;
      const rowImg = image.clone().crop(dataLeft, y, dataWidth, rowHeight);
      rowCropped.push(await rowImg.getBufferAsync(jimp.MIME_PNG));
    }
    const pass1Results = await this.ocr.recognizeRows(rowCropped);
    console.log('[ocr-module] Pass1完成: ' + rowCount + ' 行');

    // 从 Pass1 结果中，对每行每列计算精确裁剪范围
    // refinedBounds[rowIndex][colName] = { cropX, cropW }
    const refinedBounds = {};

    for (let ri = 0; ri < rowCount; ri++) {
      refinedBounds[ri] = {};
      const colWords = {};

      const words = pass1Results[ri] || [];
      for (const word of words) {
        if (!word.text || !word.box) continue;
        const cx = (word.box[0][0] + word.box[1][0] + word.box[2][0] + word.box[3][0]) / 4;
        const origX = cx + dataLeft;

        for (const [colName, range] of Object.entries(columnRanges)) {
          if (origX >= range.start && origX <= range.end) {
            if (!colWords[colName]) colWords[colName] = [];
            colWords[colName].push({ text: word.text, box: word.box, origX });
            break;
          }
        }
      }

      for (const [colName, wds] of Object.entries(colWords)) {
        // box 是相对裁剪后行图的坐标
        // 转原始图：leftOrig = box[0][0] + dataLeft, rightOrig = box[1][0] + dataLeft
        const leftOrig = Math.min(...wds.map(w => w.box[0][0] + dataLeft));
        const rightOrig = Math.max(...wds.map(w => w.box[1][0] + dataLeft));
        const pad = 20;
        refinedBounds[ri][colName] = {
          cropX: Math.max(0, leftOrig - pad),
          cropW: Math.min(dataRight, rightOrig + pad) - Math.max(0, leftOrig - pad)
        };
      }
    }

    // ===== Pass 2: 按列分语言重跑OCR =====
    // 按列名分组
    const colGroups = {};
    for (let ri = 0; ri < rowCount; ri++) {
      for (const colName of enabledCols) {
        const rect = refinedBounds[ri] && refinedBounds[ri][colName];
        if (!rect) continue;
        if (!colGroups[colName]) colGroups[colName] = [];
        colGroups[colName].push({ rowIndex: ri, rect });
      }
    }

    const pass2Data = {}; // pass2Data[rowIndex][colName] = text

    for (const [colName, items] of Object.entries(colGroups)) {
      const isNumeric = (colName !== 'ign');
      const needsThreshold = (colName === 'kda' || colName === 'firstBlood');
      const lang = isNumeric ? 'en' : 'ch';
      const bufs = [];

      console.log('[ocr-module] Pass2: ' + colName + ' (' + lang + ', ' + items.length + ' 个)');

      for (const item of items) {
        const ri = item.rowIndex;
        const rect = item.rect;

        // Y范围：使用最初的 yOffsetFactor/heightFactor
        const y = dataStart + ri * rowHeight;
        const cropY = y + Math.round(rowHeight * 0.094);
        const cropH = Math.round(rowHeight * 0.85);

        let crop = image.clone().crop(rect.cropX, cropY, rect.cropW, cropH);

        // KDA/FB：灰度 + Otsu阈值 → 黑白二值图
        if (needsThreshold) {
          crop.greyscale();
          // Otsu 阈值
          const hist = new Array(256).fill(0);
          let totalPixels = 0;
          crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, (x, y, idx) => {
            hist[crop.bitmap.data[idx]]++;
            totalPixels++;
          });
          let sum = 0;
          for (let i = 0; i < 256; i++) sum += i * hist[i];
          let sumB = 0, wB = 0, wF = 0;
          let maxVariance = 0, threshold = 128;
          for (let t = 0; t < 256; t++) {
            wB += hist[t];
            if (wB === 0) continue;
            wF = totalPixels - wB;
            if (wF === 0) break;
            sumB += t * hist[t];
            const meanB = sumB / wB;
            const meanF = (sum - sumB) / wF;
            const betweenVar = wB * wF * (meanB - meanF) * (meanB - meanF);
            if (betweenVar > maxVariance) {
              maxVariance = betweenVar;
              threshold = t;
            }
          }
          crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, (x, y, idx) => {
            const v = crop.bitmap.data[idx];
            crop.bitmap.data[idx] = crop.bitmap.data[idx+1] = crop.bitmap.data[idx+2] = (v > threshold) ? 255 : 0;
          });
        }

        const buf = await crop.getBufferAsync(jimp.MIME_PNG);
        bufs.push(buf);
      }

      // 批量OCR（数字列用英文模型）
      let ocrLines;
      if (isNumeric) {
        ocrLines = await this.ocr.recognizeAll(bufs, colName);
      } else {
        // IGN 列直接用 ch 识别
        // 临时: 设置语言为 ch
        const origLang = this.ocr.columnLanguages && this.ocr.columnLanguages[colName];
        if (!this.ocr.columnLanguages) this.ocr.columnLanguages = {};
        this.ocr.columnLanguages[colName] = 'ch';
        ocrLines = await this.ocr.recognizeAll(bufs, colName);
        if (origLang) this.ocr.columnLanguages[colName] = origLang;
      }

      for (let i = 0; i < items.length; i++) {
        const ri = items[i].rowIndex;
        if (!pass2Data[ri]) pass2Data[ri] = {};
        pass2Data[ri][colName] = (ocrLines[i] || []).join(' ');
      }
    }

    // 比对 Pass1 vs Pass2，选择更好的结果
    const players = [];
    for (let ri = 0; ri < rowCount; ri++) {
      const p2 = pass2Data[ri] || {};

      // 收集 Pass1 各列文字
      const p1 = {};
      const p1words = pass1Results[ri] || [];
      for (const word of p1words) {
        if (!word.text || !word.box) continue;
        const cx = (word.box[0][0] + word.box[1][0] + word.box[2][0] + word.box[3][0]) / 4;
        const origX = cx + dataLeft;
        for (const [colName, range] of Object.entries(columnRanges)) {
          if (origX >= range.start && origX <= range.end) {
            if (!p1[colName]) p1[colName] = [];
            p1[colName].push({ text: word.text, x: origX });
            break;
          }
        }
      }
      for (const cn of Object.keys(p1)) {
        p1[cn].sort((a, b) => a.x - b.x);
        p1[cn] = p1[cn].map(w => w.text).join(' ');
      }

      // 逐列比对
      const merged = {};
      for (const cn of enabledCols) {
        merged[cn] = this._pickBetterText(cn, (p1[cn] || '').trim(), (p2[cn] || '').trim());
      }

      players.push(this._buildPlayerFromRow(merged, ri));
    }

    console.log('[ocr-module] 两遍行式OCR完成: ' + players.length + ' 位玩家');
    return { success: true, players, rawRowResults: pass1Results };
  }

  _buildPlayerFromRow(rowData) {
    const player = {};

    // IGN + agent 分离
    let rawName = (rowData['ign'] || '').trim();
    if (this.config.nameCleaning && this.config.nameCleaning.enabled) {
      const removeChars = this.config.nameCleaning.removeChars || [];
      for (const ch of removeChars) rawName = rawName.split(ch).join('');
    }
    const extracted = extractAgent(rawName);
    player.name = extracted.ign || '';
    player.agent = extracted.agent;

    // ACS
    const acsStr = (rowData['acs'] || '').replace(/\s/g, '');
    const acsNum = acsStr ? parseInt(acsStr, 10) : -1;
    player.acs = (!isNaN(acsNum) && acsNum >= 0) ? acsNum : -1;

    // KDA
    const kdaStr = (rowData['kda'] || '').replace(/\s/g, '');
    if (kdaStr) {
      const parts = kdaStr.split('/');
      if (parts.length === 3) {
        const k = parseInt(parts[0], 10), d = parseInt(parts[1], 10), a = parseInt(parts[2], 10);
        if (!isNaN(k) && !isNaN(d) && !isNaN(a)) {
          player.kda = { kills: k, deaths: d, assists: a };
        } else {
          player.kda = { kills: -1, deaths: -1, assists: -1 };
        }
      } else if (parts.length === 2) {
        const k = parseInt(parts[0], 10), d = parseInt(parts[1], 10);
        player.kda = (!isNaN(k) && !isNaN(d)) ? { kills: k, deaths: d, assists: -1 } : { kills: -1, deaths: -1, assists: -1 };
      } else {
        const s = parseInt(kdaStr, 10);
        player.kda = !isNaN(s) ? { kills: s, deaths: -1, assists: -1 } : { kills: -1, deaths: -1, assists: -1 };
      }
    } else {
      player.kda = { kills: -1, deaths: -1, assists: -1 };
    }

    // firstKill (原 firstBlood)
    const fkStr = (rowData['firstBlood'] || '').replace(/\s/g, '');
    const fkNum = fkStr ? parseInt(fkStr, 10) : -1;
    player.firstKill = (!isNaN(fkNum) && fkNum >= 0) ? fkNum : -1;

    return player;
  }

  async _parseFullColumn(buffer) {
    const crops = await this.processor.process(buffer);
    const columnResults = {};
    const enabledCols = Object.entries(this.config.players.columns).filter(([, col]) => col.enabled);
    for (const [colName, _col] of enabledCols) {
      const bufs = crops[colName] || [];
      const linesPerPlayer = await this.ocr.recognizeAll(bufs, colName);
      columnResults[colName] = linesPerPlayer[0] || [];
    }
    const { players } = this.parser.parseFullColumn(columnResults, enabledCols);
    return { success: true, players, columnResults };
  }

  async _parsePerPlayer(buffer, fullRegion) {
    const crops = await this.processor.process(buffer, fullRegion);
    const columnResults = {};
    const enabledCols = Object.entries(this.config.players.columns).filter(([, col]) => col.enabled);
    for (const [colName, _col] of enabledCols) {
      const bufs = crops[colName] || [];
      const linesPerPlayer = await this.ocr.recognizeAll(bufs, colName);
      columnResults[colName] = linesPerPlayer;
    }
    const { players } = this.parser.parseMultiColumn(columnResults);
    return { success: true, players, columnResults };
  }

  async _parseLegacy(buffer) {
    const { namesBuffer, scoresBuffer } = await this.processor.process(buffer);
    const nameLines = await this.ocr.recognize(namesBuffer);
    const scoreLines = await this.ocr.recognize(scoresBuffer);
    const players = this.parser.parse(nameLines, scoreLines);
    return { success: true, players, rawNames: nameLines, rawScores: scoreLines };
  }

  // 比对 Pass1 和 Pass2 的文字，选更好的
  _pickBetterText(colName, pass1, pass2) {
    if (!pass1) return pass2 || '';
    if (!pass2) return pass1 || '';

    if (colName === 'ign') {
      // IGN: Pass2 裁剪更精确，优先用 Pass2
      // 只有当 Pass2 为空时才回退 Pass1
      if (pass2 && pass2.length > 0) return pass2;
      return pass1 || '';
    }

    // 数字列：取数字位数更多的（阈值容易吞数字）
    const d1 = (pass1.match(/\d/g) || []).length;
    const d2 = (pass2.match(/\d/g) || []).length;
    return d1 >= d2 ? pass1 : pass2;
  }
  async shutdown() {
    await this.ocr.terminate();
  }
}

module.exports = { ValorantOcr, loadConfig };







