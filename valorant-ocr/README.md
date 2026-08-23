# Valorant-OCR 项目指南

`valorant-ocr/` 是一个独立的 Node.js OCR 微服务，用于识别 Valorant 结算截图，提取每位玩家的 IGN、特工、ACS、KDA、首杀。支持**三种调用方式**：CLI 命令行、HTTP API、程序化 SDK 调用。

## 注意维护特工列表


## 环境要求

| 依赖 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 LTS | 运行 OCR 主程序 |
| Python | 3.9 - 3.10 | PaddleOCR 引擎 |
| Conda | 任意版本 | 管理 Python 虚拟环境 |

## 完整安装步骤

**步骤 1：创建 Conda 环境**
```powershell
conda create -n valorant-ocr python=3.10 -y
```

**步骤 2：安装 PaddlePaddle + PaddleOCR**
```powershell
conda run -n valorant-ocr pip install paddlepaddle==2.6.2
conda run -n valorant-ocr pip install paddleocr==2.8.1
```

**步骤 3：下载中文 OCR 模型**
```powershell
conda run -n valorant-ocr python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch')"
```

**步骤 4：安装 Node.js 依赖**
```powershell
cd valorant-ocr
npm install
```

---

## 调用方式

### 方式一：CLI 命令行（调试/一次识别）
```powershell
cd valorant-ocr
npm run ocr:local ./截图.png
```
结果打印到控制台，同时自动保存到 `result.json`。

### 方式二：HTTP API 服务（推荐集成方式）
```powershell
cd valorant-ocr
npm start
```
服务默认监听 `http://0.0.0.0:3200`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/ocr` | 传入截图，返回识别结果 |

**POST /ocr 请求体（四种方式任选其一）：**
```json
{ "filePath": "C:/screenshots/screenshot.png" }
{ "url": "https://example.com/screenshot.png" }
{ "base64": "iVBORw0KGgo..." }
{ "buffer": "base64编码的二进制数据" }
```

**调用示例（curl）：**
```powershell
curl -X POST http://localhost:3200/ocr ^
  -H "Content-Type: application/json" ^
  -d "{ "filePath": "./valorantnorank.png" }"
```

**调用示例（Python）：**
```python
import requests
r = requests.post("http://localhost:3200/ocr", json={"filePath": "./screenshot.png"})
print(r.json()["players"])
```

### 方式三：程序化 SDK 调用（Node.js 内嵌）
```javascript
const { ValorantOcr } = require('./index');

const ocr = new ValorantOcr();
const result = await ocr.parseScreenshot({ filePath: './screenshot.png' });

console.log(result.players);
await ocr.shutdown();
```

支持四种 source 类型：`filePath`、`url`、`base64`、`buffer`。

---

## 输出格式

```json
{
  "success": true,
  "players": [
    {
      "name": "爱已围城",
      "agent": "猎枭",
      "acs": 286,
      "kda": { "kills": 19, "deaths": 7, "assists": 4 },
      "firstKill": 3
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 玩家游戏 ID |
| `agent` | string / -1 | 所选特工（识别失败时为 -1） |
| `acs` | number / -1 | 平均战斗评分 |
| `kda.kills` | number / -1 | 击杀数 |
| `kda.deaths` | number / -1 | 死亡数 |
| `kda.assists` | number / -1 | 助攻数 |
| `firstKill` | number / -1 | 首杀次数 |

## 工作流程

| 阶段 | 说明 |
|------|------|
| **区域检测** | 垂直：亮度跳变找行分隔线；水平：颜色扫描找左右边界 |
| **坐标映射** | 标准图参考坐标比例映射：`mappedX = dataLeft + (refX - 262) / 1335 * dataWidth` |
| **Pass 1** | 整行OCR (PaddleOCR ch)，获取文字边界框，计算每列精确裁剪范围 |
| **Pass 2** | 按列分语言重跑：IGN->ch，ACS->en，KDA/FB->en+Otsu二值化；数字列比对 Pass1 vs Pass2 选优 |
| **结果解析** | name/agent 分离（空格分割+特工列表模糊匹配）、KDA分割、null->-1 |

## 引擎配置

| `ocr.engine` | 引擎 | 优点 | 依赖 |
|---------------|------|------|------|
| `"paddle"`（默认） | PaddleOCR | 准确率高，支持中文 | Python 3.9+ + Conda |
| `"tesseract"` | Tesseract.js | 纯 JS 无需 Python | 需 `eng.traineddata` |

## 策略配置

| `strategy` | 说明 | 适用场景 |
|-------------|------|---------|
| `row-wise`（默认） | 两通行式OCR，自动检测区域 | 通用，兼容非标准截图 |
| `per-player-crop` | 逐列逐人裁剪后OCR | 标准截图（1920x1080） |
| `full-column` | 整列裁剪后OCR | 兼容旧版 |
| `blot` | 旧版蒙版方案 | 已废弃 |

## 关键文件说明

| 文件 | 职责 |
|------|------|
| `index.js` | ValorantOcr 主类，编排裁剪->识别->解析全流程 |
| `server.js` | Express HTTP 服务入口（POST /ocr + GET /health） |
| `paddle_ocr_bridge.py` | Python 子进程，stdin/stdout JSON 行协议通信 |
| `paddle-ocr-engine.js` | PaddleOCR 引擎封装，管理多语言子进程 + 批量识别 |
| `image-processor.js` | 图片裁剪预处理（独立裁剪、行裁剪、全列裁剪） |
| `region-detector.js` | 战绩图区域检测（垂直行分隔线 + 水平颜色边界） |
| `result-parser.js` | OCR 结果解析（列分配、KDA分割、agent提取） |
| `config.js` | 配置加载（default-config.json 合并环境变量） |

## 注意事项

- PaddleOCR 首次模型加载需 10-15s，后续复用子进程
- 截图建议 1920x1080，非此尺寸自动缩放裁剪坐标（比例映射）
- 设置 `$env:DEBUG_SAVE='true'` 可输出调试裁剪图
- 默认端口 3200，可在 `default-config.json` 中修改
- `result.json` 为最近一次识别输出，不纳入版本控制

---

## 智能 KDA 解析

OCR 有时会把 KDA 中的 "/" 误识别为 "7"（如 `19/14/5` 变成 `19/1475`）。解析器采用三级兜底策略：

1. **标准正则** — `kills/deaths/assists` 直接匹配
2. **7→/ 容错** — 用 `7` 或 `/` 分割，取前 3 段数字
3. **数字串拆分** — 纯数字串按位数尝试拆分为 kills(1-2位)/deaths(1-2位)/assists(剩余)，每个 ≤99 即接受

`result-parser.js` 中 `parseMultiColumn` 和 `parseFullColumn` 两个方法都实现了此逻辑。

## 首杀默认值

`firstBlood` OCR 识别结果为 null 时，默认填 `1`（因为首杀通常是较小的正整数）。