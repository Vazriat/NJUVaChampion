'use strict';

const { createWorker } = require('tesseract.js');

/**
 * OCR 引擎 — 封装 Tesseract.js，支持多列不同参数
 */
class OcrEngine {
  /**
   * @param {object} ocrConfig - OCR 全局配置 { language, psm }
   * @param {object} [columnConfigs] - 按列的 OCR 配置覆盖
   */
  constructor(ocrConfig, columnConfigs) {
    this.language = ocrConfig.language || 'eng';
    this.defaultPsm = ocrConfig.psm || 6;
    this.worker = null;
    this.initialized = false;
    this.columnConfigs = columnConfigs || {};
  }

  async init() {
    if (this.initialized) return;
    this.worker = await createWorker(this.language, undefined, { langPath: __dirname });
    this.initialized = true;
    console.log(`[ocr] Tesseract Worker 已初始化 (lang=${this.language})`);
  }

  /**
   * 对图片列表进行 OCR 识别
   * @param {Buffer[]} imageBuffers - 图片 Buffer 列表
   * @param {string} [columnName] - 列名，用于应用特定列的 OCR 参数
   * @returns {Promise<string[][]>} - 每位球员的识别结果行列表
   */
  async recognizeAll(imageBuffers, columnName) {
    if (!this.initialized) {
      await this.init();
    }

    // 获取该列的特定参数
    const colConfig = (columnName && this.columnConfigs) || {};
    const colParams = colConfig[columnName] || {};

    const results = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const buf = imageBuffers[i];

      // 应用参数
      const params = {
        tessedit_pageseg_mode: colParams.psm || this.defaultPsm,
      };
      if (colParams.charWhitelist) {
        params.tessedit_char_whitelist = colParams.charWhitelist;
      }
      await this.worker.setParameters(params);

      const { data } = await this.worker.recognize(buf);
      const lines = data.text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      results.push(lines);
    }

    return results;
  }

  /**
   * 对单张图片进行 OCR 识别
   * @param {Buffer} imageBuffer - 图片 Buffer
   * @param {object} [params] - OCR 参数覆盖
   * @returns {Promise<string[]>} - 识别的文本行
   */
  async recognize(imageBuffer, params) {
    if (!this.initialized) {
      await this.init();
    }
    const p = { tessedit_pageseg_mode: this.defaultPsm, ...params };
    if (p.charWhitelist) {
      p.tessedit_char_whitelist = p.charWhitelist;
      delete p.charWhitelist; // remove extra key
    }
    await this.worker.setParameters(p);
    const { data } = await this.worker.recognize(imageBuffer);
    return data.text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.initialized = false;
      this.worker = null;
      console.log('[ocr] Tesseract Worker 已销毁');
    }
  }
}

module.exports = OcrEngine;
