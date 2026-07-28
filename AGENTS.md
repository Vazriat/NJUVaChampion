# NJUVaChampion - 无畏契约赛事平台

## 快速启动

**后端（端口 8080）：**
`bash
cd Valorant
mvn spring-boot:run
`

**前端（端口 3000，/api 代理到后端 8080）：**
`bash
cd nvc
npm run dev
`

---

## 项目结构

`
NJUVaChampion/
├── AGENTS.md                <- 开发说明（本文件）
├── Valorant-OCR-master/      <- Valorant 战绩截图 OCR 识别微服务
├── docs/
│   ├── api.md               <- API 接口文档（所有公开/管理员接口、数据模型、赛制说明、搜索接口）
│   ├── architecture.md      <- 架构与算法文档（数据库表结构、包结构、对阵图算法、BracketTree 组件说明、开发细节）
│   └── todo.md              <- 待做任务清单（任务分类、已完成记录）
├── Valorant/                <- Spring Boot 后端（Java 21, Spring Boot 3.4.0）
│   └── src/main/java/com/NJUChampion/Valorant/
│       ├── entity/          <- 实体类（User, Team, TeamMember, Tournament, TournamentTeam, TournamentMatch）
│       ├── repository/      <- JPA Repository
│       ├── service/         <- 业务逻辑
│       ├── controller/      <- 接口控制器（含 SearchController 全局搜索）
│       ├── dto/             <- 请求/响应 DTO
│       ├── common/          <- Result<T> 统一响应 + 全局异常处理
│       ├── config/          <- Security, CORS, JWT 过滤, 数据初始化
│       └── util/            <- JWT 工具
└── nvc/                     <- Next.js 前端（React 19, Next.js 16）
    ├── app/                 <- 页面（App Router）
    ├── lib/api.ts           <- Axios 实例 + API 函数
    ├── lib/auth.ts          <- Token/User 本地存储
    └── components/          <- 通用组件（NavBar, AuthGuard, CreateTournamentModal, BracketTree）
`

---

## 文档目录

| 文件 | 内容 | 维护者 |
|------|------|--------|
| docs/api.md | 全部 REST API 接口说明，含请求/响应格式、赛制支持表 | 新增 API 时同步更新 |
| docs/architecture.md | 数据库表结构、后端/前端包结构、赛事对阵算法、种子分配、自动晋级逻辑 | 修改表结构或算法时更新 |
| docs/todo.md | 待做任务清单，记录需要完成的开发任务和已知问题 | 发现新任务或完成时更新 |

---


---

## Valorant-OCR 战绩识别模块

Valorant-OCR-master/ 是一个独立的 Node.js OCR 微服务，用于识别 Valorant 结算截图（1920×1080），提取每位玩家的 IGN、特工、ACS、KDA、首杀。

### 环境要求

| 依赖 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 LTS | 运行 OCR 主程序 |
| Python | 3.9 - 3.10 | PaddleOCR 引擎 |
| Conda | 任意版本 | 管理 Python 虚拟环境 |

### 完整安装步骤

**步骤 1：创建 Conda 环境**

```powershell
conda create -n valorant-ocr python=3.10 -y
```

> 如果 `conda create` 遇到权限错误，可执行：
> ```powershell
> conda config --remove-key envs_dirs
> conda config --add envs_dirs C:\Users\%USERNAME%\.conda\envs
> ```

**步骤 2：安装 PaddlePaddle + PaddleOCR**

```powershell
# 注意：必须先装 paddlepaddle，再装 paddleocr
conda run -n valorant-ocr pip install paddlepaddle==2.6.2
conda run -n valorant-ocr pip install paddleocr==2.8.1
```

**步骤 3：下载中文 OCR 模型**

```powershell
# 首次运行会自动下载模型到 C:\Users\%USERNAME%\.paddlex\official_models\
conda run -n valorant-ocr python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch')"
```

> 首次下载约 6 个模型文件（~200MB），后续复用缓存。

**步骤 4：安装 Node.js 依赖**

```powershell
cd Valorant-OCR-master
npm install
```

> 如果遇到 npm EPERM 权限错误，使用不同缓存目录重试：
> ```powershell
> npm config set cache <其他可写路径>
> npm install
> ```

### 运行方式

**本地识别单张截图：**

```powershell
cd Valorant-OCR-master
npm run ocr:local ./截图.png
# 结果打印到控制台 + 自动保存到 result.json
```

**启动 HTTP 服务（端口 3200）：**

```powershell
cd Valorant-OCR-master
npm start
```

**HTTP API：**

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /health` | GET | 健康检查 |
| `POST /ocr` | POST | 传入截图，返回识别结果 |

`POST /ocr` 请求体（四选一）：
```json
{ "url": "https://example.com/screenshot.png" }
{ "filePath": "C:/screenshots/game.png" }
{ "base64": "iVBORw0KGgo..." }
```

### 输出格式

```json
{
  "success": true,
  "players": [
    { "name": "爱已围城", "agent": "猎枭", "acs": 286,
      "kda": { "kills": 19, "deaths": 7, "assists": 4 }, "firstBlood": 3 }
  ]
}
```

### 引擎配置

编辑 `Valorant-OCR-master/default-config.json`，`ocr.engine` 可选：

- `"paddle"`（默认）— PaddleOCR，推荐，准确率高
- `"tesseract"` — Tesseract.js，纯 JS 无需 Python

IGN 列自动走中文模型，数字列（ACS/KDA/首杀）自动走英文模型。

### 关键文件说明

| 文件 | 说明 |
|------|------|
| `paddle_ocr_bridge.py` | Python 子进程，stdin/stdout JSON 行协议通信 |
| `paddle-ocr-engine.js` | PaddleOCR 引擎封装，管理多语言子进程 |
| `index.js` | ValorantOcr 主类，编排裁剪→识别→解析 |
| `image-processor.js` | 图片裁剪 + Otsu 二值化预处理 |
| `result-parser.js` | OCR 结果解析，提取 IGN/Agent/ACS/KDA/首杀 |
| `server.js` | Express 服务入口 |

### 注意事项

- PaddleOCR 首次模型加载需 ~10-15s，后续复用子进程
- 截图建议 1920×1080，非此尺寸自动缩放裁剪坐标
- 设置 `$env:DEBUG_SAVE='true'` 可输出调试裁剪图
- 默认端口 3200，可在 `default-config.json` 中修改
- `result.json` 为最近一次识别输出，不纳入版本控制

## 关键业务规则

| 规则 | 说明 |
|------|------|
| 管理员账号 | admin / admin123（启动时自动创建），仅有管理功能 |
| 登录跳转 | ADMIN -> /admin，普通用户 -> /dashboard |
| 战队上限 | 每队最多 5 人（含队长），每人只能加入一个战队 |
| 无人战队 | captainId=0，管理员创建用于测试比赛流程 |
| 游戏 ID | 格式 主体#标记码，公开显示只展示主体部分 |
| 密码重置 | 管理员仅能重置为固定值 123456 |
| 密码存储 | BCrypt 加密 |
| JWT | 无状态，通过 Authorization: Bearer <token> 传递 |
| 数据库 | MySQL 8，库名 njuvachampion，JPA ddl-auto: update |
| 响应格式 | 统一 Result<T>，异常由 GlobalExceptionHandler 处理 |

## 赛事业务

| 概念 | 说明 |
|------|------|
| 状态流转 | SETUP -> REGISTRATION -> PROGRESSION -> ENDED |
| 种子分配 | 1,8,4,5,2,7,3,6（标准单败排序） |
| 双败淘汰 | 胜者组(WINNERS)/败者组(LOSERS)/总决赛(GRAND_FINAL) |
| 阶段(stage) | 用于区分双败淘汰的各组 |
| 自动晋级 | 记录胜负后胜者自动填入下一轮对应位置 |
| 自动结束 | 决赛记录胜负后赛事自动结束并设置冠军 |

## 赛制支持

| 类型 | 赛制 | 队伍数 |
|------|------|--------|
| CUP | SINGLE_ELIM（单败淘汰） | 2/4/8/16 |
| CUP | DOUBLE_ELIM（双败淘汰） | 4/8 |
| CUP | SWISS_ELIM（瑞士轮+淘汰赛） | 16 |
| LEAGUE | SINGLE_RR（单循环） | >= 2 |
| LEAGUE | DOUBLE_RR（双循环） | >= 2 |

## 开发规范

- Java 21, TypeScript 5, 包名 com.NJUChampion.Valorant.*
- 响应格式：统一 Result<T>，异常 GlobalExceptionHandler
- 前端：Next.js App Router，API 通过 Next.js rewrites 代理到后端 8080
- 数据库：JPA 自动建表（ddl-auto: update）
- .gitignore 已配置 target/, node_modules/, .next/, IDE 文件

## 注意事项与已知坑

### 中文乱码（编码问题）

项目中的中文文本在传输/保存过程中可能出现乱码。当前前端文件存在使用 GBK 编码的中文字符串，表现为 锟斤拷 或问号等乱码。后端异常信息也包含中文。修改规则：

- **前端 .tsx 文件**：所有中文 UI 文本应使用正确的 UTF-8 编码
- **后端 .java 文件**：异常消息等中文建议使用英文或确保文件编码为 UTF-8
- 如果遇到 Unterminated string constant 或 Unexpected token 等语法错误，优先检查附近是否存在乱码导致字符串未正确闭合

### 容易复发的语法错误

1. **未闭合的字符串常量**：乱码字符串中可能包含 ' 或 "，导致 JSX 解析失败。修复方法：替换为正确的 UTF-8 中文或使用英文
2. **正则未闭合**：确保正则表达式前后匹配
3. **JSX 标签未闭合**：检查 </...> 是否匹配开头的 <...>
4. **对象属性缺少逗号**：乱码常导致对象属性间的逗号丢失

### 管理员界面

- 创建无人战队：POST /api/admin/teams（captainId=0）
- 添加队伍到赛事：POST /api/admin/tournaments/{id}/register
- 从赛事移除队伍：POST /api/admin/tournaments/{id}/unregister
- 创建无人战队按钮 **只应出现在战队管理(tab=teams)界面**
- 赛事管理下的添加队伍弹窗应从队伍列表检索选择，而非手动输入 ID

## 文档维护要求

- **AGENTS.md** — 新增业务规则或发现常见错误模式后必须更新
- **docs/api.md** — 新增/修改 API 接口后必须同步更新
- **docs/architecture.md** — 修改数据库表结构、算法或项目结构后同步更新
