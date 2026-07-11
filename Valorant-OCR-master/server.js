'use strict';

const express = require('express');
const cors = require('cors');
const { loadConfig, ValorantOcr } = require('./index');

/**
 * Express HTTP 服务
 *
 * API:
 *   POST /ocr  — 识别结算截图
 *   GET  /health — 健康检查
 */
async function startServer() {
  const config = loadConfig();
  const serverConfig = config.server || { port: 3200, host: '0.0.0.0' };

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // OCR 接口
  app.post('/ocr', async (req, res) => {
    try {
      const { url, filePath, buffer, base64 } = req.body;
      const source = { url, filePath, buffer, base64 };

      const ocr = new ValorantOcr({ config });
      const result = await ocr.parseScreenshot(source);
      await ocr.shutdown();

      res.json(result);
    } catch (err) {
      console.error('[server] OCR 错误:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`[server] Valorant OCR 服务已启动: http://${serverConfig.host}:${serverConfig.port}`);
    console.log(`[server] 策略: ${config.crop.strategy || 'blot'}`);
  });
}

startServer().catch(err => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});
