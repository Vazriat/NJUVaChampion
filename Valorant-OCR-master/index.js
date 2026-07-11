'use strict';

const { loadConfig } = require('./config');
const { loadImage } = require('./image-loader');
const ImageProcessor = require('./image-processor');
const OcrEngine = require('./ocr-engine');
const PaddleOcrEngine = require('./paddle-ocr-engine');
const ResultParser = require('./result-parser');

class ValorantOcr {
  constructor(options = {}) {
    const cfg = options.config || loadConfig(options.configPath);
    this.config = cfg;
    this.processor = new ImageProcessor(cfg.crop, cfg.blot, cfg.players);

    const engineName = (cfg.ocr && cfg.ocr.engine) || 'tesseract';
    if (engineName === 'paddle') {
      console.log('[ocr-module] 使用 PaddleOCR 引擎');
      const columns = cfg.players && cfg.players.columns;
      this.ocr = new PaddleOcrEngine(cfg.ocr);
      // 收集每列的语言覆盖
      if (columns) {
        this.ocr.columnLanguages = {};
        for (const [colName, col] of Object.entries(columns)) {
          if (col.language) this.ocr.columnLanguages[colName] = col.language;
        }
      }
    } else {
      console.log('[ocr-module] 使用 Tesseract.js 引擎');
      this.ocr = new OcrEngine(cfg.ocr, cfg.players ? cfg.players.columns : null);
    }

    this.parser = new ResultParser(cfg.nameCleaning, cfg.players);
    this.strategy = (cfg.crop && cfg.crop.strategy) || 'blot';
  }

  async parseScreenshot(source) {
    try {
      const { buffer } = await loadImage(source);
      console.log('[ocr-module] 图片加载完成');

      if (this.strategy === 'full-column') {
        return await this._parseFullColumn(buffer);
      }
      if (this.strategy === 'per-player-crop') {
        return await this._parsePerPlayer(buffer);
      }
      return await this._parseLegacy(buffer);
    } finally {
      await this.shutdown();
    }
  }

  async _parseFullColumn(buffer) {
    const crops = await this.processor.process(buffer);

    const columnResults = {};
    const enabledCols = Object.entries(this.config.players.columns)
      .filter(([, col]) => col.enabled);

    for (const [colName, _col] of enabledCols) {
      const bufs = crops[colName] || [];
      console.log('[ocr-module] 开始识别列 ' + colName + '（整列OCR）');
      const linesPerPlayer = await this.ocr.recognizeAll(bufs, colName);
      columnResults[colName] = linesPerPlayer[0] || [];
    }

    const { players, rawResults } = this.parser.parseFullColumn(columnResults, enabledCols);
    console.log('[ocr-module] 成功解析 ' + players.length + ' 位玩家');

    return { success: true, players, columnResults };
  }

  async _parsePerPlayer(buffer) {
    const crops = await this.processor.process(buffer);

    const columnResults = {};
    const enabledCols = Object.entries(this.config.players.columns)
      .filter(([, col]) => col.enabled);

    for (const [colName, _col] of enabledCols) {
      const bufs = crops[colName] || [];
      console.log('[ocr-module] 开始识别列 ' + colName + '，共 ' + bufs.length + ' 个区域');
      const linesPerPlayer = await this.ocr.recognizeAll(bufs, colName);
      columnResults[colName] = linesPerPlayer;
    }

    const { players, rawResults } = this.parser.parseMultiColumn(columnResults);
    console.log('[ocr-module] 成功解析 ' + players.length + ' 位玩家');

    return { success: true, players, columnResults };
  }

  async _parseLegacy(buffer) {
    const { namesBuffer, scoresBuffer } = await this.processor.process(buffer);
    console.log('[ocr-module] 图片裁剪完成');

    const nameLines = await this.ocr.recognize(namesBuffer);
    const scoreLines = await this.ocr.recognize(scoresBuffer);
    const players = this.parser.parse(nameLines, scoreLines);

    return { success: true, players, rawNames: nameLines, rawScores: scoreLines };
  }

  async shutdown() {
    await this.ocr.terminate();
  }
}

module.exports = { ValorantOcr, loadConfig };
