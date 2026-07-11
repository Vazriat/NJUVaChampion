'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const { Transform } = require('stream');

/**
 * 从 URL 下载图片并返回 Buffer
 * @param {string} url - 图片 URL
 * @returns {Promise<Buffer>}
 */
function loadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;

    mod.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} — 下载图片失败: ${url}`));
        return;
      }
      const data = new Transform();
      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => resolve(data.read()));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 从本地文件路径读取图片
 * @param {string} filePath - 本地文件路径
 * @returns {Promise<Buffer>}
 */
function loadFromFile(filePath) {
  return Promise.resolve(fs.readFileSync(filePath));
}

/**
 * 加载图片，自动识别来源类型
 * @param {object} source - 图片来源描述
 * @param {string} [source.url] - 图片 URL
 * @param {string} [source.filePath] - 本地文件路径
 * @param {Buffer} [source.buffer] - 直接传入 Buffer
 * @param {string} [source.base64] - Base64 编码的图片数据
 * @returns {Promise<{buffer: Buffer, sourceType: string}>}
 */
async function loadImage(source) {
  if (source.buffer) {
    return { buffer: source.buffer, sourceType: 'buffer' };
  }
  if (source.base64) {
    const buf = Buffer.from(source.base64, 'base64');
    return { buffer: buf, sourceType: 'base64' };
  }
  if (source.url) {
    const buf = await loadFromUrl(source.url);
    return { buffer: buf, sourceType: 'url' };
  }
  if (source.filePath) {
    const buf = await loadFromFile(source.filePath);
    return { buffer: buf, sourceType: 'file' };
  }
  throw new Error('未指定图片来源：请提供 url / filePath / buffer / base64 之一');
}

module.exports = { loadImage, loadFromUrl, loadFromFile };
