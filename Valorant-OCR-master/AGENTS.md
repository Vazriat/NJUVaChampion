# Valorant-OCR 项目指南

## 项目简介

Node.js OCR 微服务，对 Valorant 结算截图（1920×1080）进行 OCR 识别，提取每位玩家的 IGN、特工、ACS、KDA、首杀等统计数据。默认使用 **PaddleOCR** 引擎。

## 环境安装

### 前置依赖

1. **Node.js** ≥ 18 LTS
2. **Python 3.9+**（PaddleOCR 需要）
3. **Conda** 环境（推荐）

### 安装步骤

```powershell
# 1. 创建 Conda 环境
conda create -n valorant-ocr python=3.9
conda activate valorant-ocr

# 2. 安装 PaddleOCR（必须先装 paddlepaddle）
pip install paddlepaddle -i https://mirror.baidu.com/pypi/simple
pip install paddleocr -i https://mirror.baidu.com/pypi/simple

# 3. 下载中文模型（首次需手动触发）
python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch', use_angle_cls=False, show_log=False)"

# 4. 安装 Node.js 依赖
cd C:\Users\PC\Desktop\Valorant-OCR-master
npm install
```

### 运行方式

#### 本地识别单张截图
```powershell
$env:DEBUG_SAVE='true'  # 可选：保存调试裁剪图
npm run ocr:local ./valorantnorank.png
# 结果输出到控制台 + 保存到 result.json
```

#### 启动 HTTP 服务
```powershell
npm start
# POST /ocr，GET /health
```

#### 查看调试裁剪图（需要时）
```powershell
$env:DEBUG_SAVE='true'
npm run ocr:local ./valorantnorank.png
# debug-*.png 生成在项目根目录
```

## 模块结构

| 文件 | 说明 |
|------|------|
| `paddle_ocr_bridge.py` | Python OCR 子进程，stdin/stdout JSON 通信 |
| `paddle-ocr-engine.js` | PaddleOCR 引擎封装，支持多语言进程 |
| `index.js` | ValorantOcr 主类 |
| `config.js` | 配置加载 |
| `default-config.json` | 默认配置 |
| `image-loader.js` | 图片来源：URL / 文件 / Buffer |
| `image-processor.js` | 图片裁剪（per-player-crop 策略）+ Otsu 二值化 |
| `ocr-engine.js` | Tesseract.js OCR 引擎（fallback） |
| `result-parser.js` | OCR 结果解析，IGN/Agent/ACS/KDA/首杀提取 |
| `server.js` | Express 服务入口 |
| `result.json` | 最近一次 OCR 识别结果 |
| `valorantnorank.png` | 测试截图 |

## 截图布局（1920×1080）

左上角为原点，共 10 行（两队 × 5 人），行高 53px。

| 数据 | 区域 |
|------|------|
| IGN + 特工 | (330,320) ~ (550,858)，两行字，第一行 ID，第二行特工 |
| ACS | (633,320) ~ (820,858) |
| KDA | (820,320) ~ (980,858)，格式 0/0/0 |
| 首杀 | (1150,320) ~ (1260,858) |

team1 从 Y=320 开始，team2 从 Y=590 开始。

## 引擎配置

`default-config.json` 中 `ocr.engine` 控制引擎：

- `"paddle"`（默认）— PaddleOCR，推荐
- `"tesseract"` — Tesseract.js fallback

### 多语言路由

IGN 列需要识别中文，其他数字列用英文。引擎支持双进程：

- **IGN** → `language: "ch"`（列级覆盖）
- **ACS/KDA/首杀** → `language: "en"`（全局默认）

在列的配置中添加 `"language": "ch"` 即可让该列走中文模型。

### 二值化预处理

数字列（KDA、首杀）启用 Otsu 二值化以提升白字识别率：

```json
"kda": { "preprocess": "threshold", ... }
"firstBlood": { "preprocess": "threshold", ... }
```

注意：IGN 列不启用二值化，中文模型在原始灰度图上表现更好。

## 裁剪策略

当前使用 `per-player-crop` 策略，逐行逐列裁剪。每个列独立配置：

| 列 | x | width | yOffset | height | scale | 预处理 |
|----|---|-------|---------|--------|-------|--------|
| ign | 330 | 220 | 5 | 45 | 3 | 无 |
| acs | 633 | 187 | 12 | 30 | 3 | 无 |
| kda | 820 | 160 | 10 | 30 | 3 | threshold |
| firstBlood | 1150 | 110 | 12 | 30 | 3 | threshold |

## 识别结果格式

`result.json` 结构：

```json
{
  "success": true,
  "players": [
    {
      "name": "爱已围城",
      "agent": "猎枭",
      "acs": 286,
      "kda": { "kills": 19, "deaths": 7, "assists": 4 },
      "firstBlood": 3
    }
  ],
  "columnResults": { ... }
}
```

- IGN 列裁剪覆盖 ID 和特工两行，OCR 识别后自动拆分：`lines[0]` = ID, `lines[1]` = 特工
- 特工缺失时默认为 `"零"`

## 关键改动

1. **多语言引擎** — `paddle-ocr-engine.js` 维护多个 Python 子进程（每个语言一个），根据列配置的 `language` 字段路由请求
2. **IGN+Agent 同列提取** — IGN 裁剪区域覆盖两行字，`result-parser.js` 从 `lines[0]/lines[1]` 分别提取 ID 和特工名
3. **Otsu 二值化** — `image-processor.js` 中实现，对数字列自适应二值化提升 OCR 准确率
4. **固定输出文件** — `npm run ocr:local` 结果写入 `result.json`

## PaddleOCR 桥接协议

Python 子进程通过 stdin/stdout JSON 行通信：

```
→ {"action":"init","lang":"ch"}
← {"status":"ok"}

→ {"action":"recognize","images":["/path/to/crop.png"]}
← {"status":"ok","results":[[{"text":"爱已围城","confidence":0.95}],[]]}

→ {"action":"shutdown"}
← {"status":"ok"}
```

## 注意事项

- PaddleOCR 首次启动需 ~10-15s 加载模型（后续复用）
- `debug-*.png` 是调试输出（`$env:DEBUG_SAVE='true'` 启用），可安全删除
- 非 1920×1080 截图自动缩放裁剪参数
- 每次识别后自动调用 `shutdown()` 释放子进程
- 中文模型需提前下载，参见"环境安装"章节
