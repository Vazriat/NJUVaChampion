'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PaddleOcrEngine {
  constructor(ocrConfig = {}) {
    this.defaultLanguage = ocrConfig.language || 'en';
    this.pythonPath = ocrConfig.pythonPath || this._detectPython();
    this.bridgeScript = ocrConfig.bridgeScript ||
      path.join(__dirname, 'paddle_ocr_bridge.py');
    this._processes = {};
    this.columnLanguages = {};
  }

  _getProcessState(lang) {
    if (!this._processes[lang]) {
      this._processes[lang] = {
        process: null,
        initialized: false,
        lineBuffer: '',
        pendingResolve: null,
        pendingReject: null,
        timeout: null,
      };
    }
    return this._processes[lang];
  }

  async _ensureProcess(lang) {
    const state = this._getProcessState(lang);
    if (state.initialized) return;
    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(this.pythonPath, ['-u', this.bridgeScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env },
        });
        state.process = proc;
        state.lineBuffer = '';

        proc.stdout.on('data', (d) => {
          state.lineBuffer += d.toString();
          this._tryProcessLines(state);
        });

        proc.stderr.on('data', () => {});

        proc.on('error', (err) => {
          if (!state.initialized) reject(err);
        });

        proc.on('exit', () => {
          state.initialized = false;
          if (state.pendingReject) {
            state.pendingReject(new Error('process exited'));
          }
        });

        this._sendToState(state, { action: 'init', lang: lang })
          .then(resp => {
            if (resp && resp.status === 'ok') {
              state.initialized = true;
              resolve();
            } else {
              reject(new Error('init failed: ' + JSON.stringify(resp)));
            }
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  _detectPython() {
    const candidates = [
        path.join(os.homedir(), '.conda', 'envs', 'valorant-ocr', 'python.exe'),
        path.join(os.homedir(), 'anaconda3', 'envs', 'valorant-ocr', 'python.exe'),
      'python3',
      'python',
    ];
    for (const c of candidates) {
      try { fs.accessSync(c); return c; } catch (_) {}
    }
    return 'python';
  }

  async init(lang) {
    return this._ensureProcess(lang || this.defaultLanguage);
  }

  _tryProcessLines(state) {
    while (state.lineBuffer.includes('\n')) {
      const idx = state.lineBuffer.indexOf('\n');
      const line = state.lineBuffer.slice(0, idx).trim();
      state.lineBuffer = state.lineBuffer.slice(idx + 1);
      if (!line) continue;
      try {
        const resp = JSON.parse(line);
        if (state.pendingResolve) {
          const resolve = state.pendingResolve;
          const reject = state.pendingReject;
          state.pendingResolve = null;
          state.pendingReject = null;
          if (state.timeout) clearTimeout(state.timeout);
          resolve(resp);
        }
      } catch (_) {}
    }
  }

  _sendToState(state, msg) {
    return new Promise((resolve, reject) => {
      if (!state.process || !state.process.stdin.writable) {
        return reject(new Error('subprocess not running'));
      }
      state.pendingResolve = resolve;
      state.pendingReject = reject;
      state.timeout = setTimeout(() => {
        if (state.pendingResolve) {
          state.pendingResolve = null;
          state.pendingReject = null;
          reject(new Error('request timeout'));
        }
      }, 120000);
      state.process.stdin.write(JSON.stringify(msg) + '\n');
    });
  }

  _send(msg, lang) {
    const state = this._getProcessState(lang || this.defaultLanguage);
    return this._sendToState(state, msg);
  }

  // 原有：只返回文字
  async recognize(imageBuffer, params) {
    const lang = (params && params.language) || this.defaultLanguage;
    await this._ensureProcess(lang);
    const tmpPath = this._saveTemp(imageBuffer);
    try {
      const resp = await this._send({ action: 'recognize', images: [tmpPath] }, lang);
      if (resp && resp.status === 'ok' && resp.results && resp.results[0]) {
        return resp.results[0].map(r => r.text).filter(t => t);
      }
      return [];
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }

  // 原有：批量识别（只返回文字）
  async recognizeAll(imageBuffers, columnName) {
    const lang = (columnName && this.columnLanguages && this.columnLanguages[columnName])
      ? this.columnLanguages[columnName] : this.defaultLanguage;
    console.log('[ocr-engine] ' + columnName + ' 使用语言: ' + lang);
    await this._ensureProcess(lang);
    const tmpPaths = imageBuffers.map(buf => this._saveTemp(buf));
    try {
      const resp = await this._send({ action: 'recognize', images: tmpPaths }, lang);
      if (resp && resp.status === 'ok' && resp.results) {
        return resp.results.map(r => r.map(t => t.text).filter(t => t));
      }
      return imageBuffers.map(() => []);
    } finally {
      for (const p of tmpPaths) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    }
  }

  // 新增：识别整行图片，返回 [{text, confidence, box}]
  // 每个子图独立识别（用 ch 语言，支持中英文混排）
  async recognizeRows(imageBuffers) {
    const lang = 'ch';
    console.log('[ocr-engine] 行识别 使用语言: ' + lang);
    await this._ensureProcess(lang);
    const tmpPaths = imageBuffers.map(buf => this._saveTemp(buf));
    try {
      const resp = await this._send({ action: 'recognize', images: tmpPaths }, lang);
      if (resp && resp.status === 'ok' && resp.results) {
        return resp.results; // 返回完整 [{text, confidence, box}]
      }
      return imageBuffers.map(() => []);
    } finally {
      for (const p of tmpPaths) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    }
  }

  _saveTemp(buf) {
    const tmpDir = os.tmpdir();
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const name = 'paddle_' + stamp + '.png';
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, buf);
    return p;
  }

  async terminate() {
    for (const [lang, state] of Object.entries(this._processes)) {
      if (state.process) {
        try {
          state.process.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
        } catch (_) {}
        setTimeout(() => {
          if (state.process && !state.process.killed) {
            state.process.kill();
          }
        }, 3000);
        state.process = null;
        state.initialized = false;
      }
    }
  }
}

module.exports = PaddleOcrEngine;
