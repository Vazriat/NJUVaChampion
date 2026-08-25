# 系统架构与算法文档

## 数据库表结构

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| username | VARCHAR(50) UNIQUE | 用户名 |
| password | VARCHAR(255) | BCrypt 加密密码 |
| game_id | VARCHAR(50) | 游戏 ID，格式 `主体#标记码` |
| email | VARCHAR(100) UNIQUE | 邮箱 |
| role | VARCHAR(20) | PLAYER（普通） / ADMIN（管理员） |
| status | INT | 1=正常，0=禁用 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### teams（战队表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| name | VARCHAR(100) UNIQUE | 战队名 |
| logo | VARCHAR(500) | 队标 URL |
| description | VARCHAR(500) | 描述 |
| captain_id | BIGINT | 队长 User ID（可为 null，管理员可创建无人战队） |
| status | INT | 1=正常，0=解散 |
| created_at / updated_at | DATETIME | 时间戳 |

### team_members（队员关系表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| team_id | BIGINT | 战队 ID |
| user_id | BIGINT | 用户 ID |
| role | VARCHAR(20) | CAPTAIN（队长）/ MEMBER（队员） |
| joined_at | DATETIME | 加入时间 |

### tournaments（赛事表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| name | VARCHAR(100) | 赛事名称 |
| description | VARCHAR(500) | 描述 |
| status | VARCHAR(20) | SETUP / REGISTRATION / PROGRESSION / ENDED |
| max_teams | INT | 最大报名队伍数 |
| bracket_type | VARCHAR(30) | 兼容旧字段，现由 type+format 派生 |
| type | VARCHAR(10) | CUP / LEAGUE |
| format | VARCHAR(20) | CUP: SINGLE_ELIM / DOUBLE_ELIM / SWISS_ELIM；LEAGUE: SINGLE_RR / DOUBLE_RR |
| current_stage | INT | 多阶段赛事当前阶段（null/0/1） |
| champion_team_id | BIGINT | 冠军战队 ID |
| status_flag | INT | 1=正常，0=删除（软删） |
| created_at / updated_at | DATETIME | 时间戳 |

### tournament_teams（赛事报名关系表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| tournament_id | BIGINT | 赛事 ID |
| team_id | BIGINT | 战队 ID |
| seed | INT | 种子编号 |
| registered_at | DATETIME | 报名时间 |

唯一约束：`(tournament_id, team_id)`

### tournament_matches（比赛对阵表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK AUTO | 主键 |
| tournament_id | BIGINT | 赛事 ID |
| stage | VARCHAR(20) | WINNERS（胜者组）/ LOSERS（败者组）/ GRAND_FINAL（总决赛） |
| round | INT | 轮次 |
| position | INT | 本轮中的位置索引 |
| team1_id | BIGINT | 队伍1 ID |
| team2_id | BIGINT | 队伍2 ID |
| winner_id | BIGINT | 胜者 ID |
| status | VARCHAR(20) | PENDING（待赛）/ COMPLETED（已完成） |
| games_per_match | INT | 该场比赛局数，默认 1（BO1），在记录胜负时设置 |
| created_at / updated_at | DATETIME | 时间戳 |

---

## 后端包结构

```
backend/src/main/java/com/NJUChampion/Valorant/
├── ValorantApplication.java        # Spring Boot 入口
├── common/
│   ├── Result.java                 # 统一响应 Result<T>
│   └── GlobalExceptionHandler.java # 全局异常处理
├── util/
│   └── JwtUtil.java                # JWT 生成/校验/解析（HS256）
├── config/
│   ├── SecurityConfig.java         # 无状态 JWT 安全配置
│   ├── WebConfig.java              # CORS 跨域配置
│   ├── DataInitializer.java        # 启动自动创建管理员
│   └── jwt/JwtAuthFilter.java      # JWT 鉴权过滤器
├── entity/                         # 实体（6个）
├── repository/                     # JPA Repository（6个）
├── dto/                            # 请求/响应 DTO
├── service/                        # 业务逻辑
│   ├── UserService.java
│   ├── TeamService.java
│   └── TournamentService.java
└── controller/                     # REST 控制器
    ├── UserController.java
    ├── ProfileController.java
    ├── PublicUserController.java
    ├── TeamController.java
    ├── AdminController.java
    ├── TournamentController.java
    └── AdminTournamentController.java
```

---

## 前端结构

```
frontend/
├── app/
│   ├── layout.tsx                  # 根布局（Geist 字体）
│   ├── page.tsx                    # 首页
│   ├── login/page.tsx              # 登录页
│   ├── register/page.tsx           # 注册页
│   ├── dashboard/page.tsx          # 仪表盘
│   ├── admin/page.tsx              # 管理后台
│   ├── settings/page.tsx           # 账号设置
│   ├── hall/page.tsx               # 用户大厅
│   ├── profile/[id]/page.tsx       # 个人主页
│   ├── teams/
│   │   ├── page.tsx                # 战队列表
│   │   ├── create/page.tsx         # 创建战队
│   │   └── [id]/page.tsx           # 战队详情
│   └── tournaments/
│       ├── page.tsx                # 赛事列表
│       └── [id]/page.tsx           # 赛事详情（对阵图）
├── components/
│   ├── NavBar.tsx                  # 导航栏
│   ├── AuthGuard.tsx               # 登录保护
│   └── CreateTournamentModal.tsx   # 创建赛事弹窗
└── lib/
    ├── api.ts                      # Axios 实例 + 拦截器 + API 函数 + 类型
    └── auth.ts                     # localStorage Token/User 管理
```

---

## 赛事系统

### 状态流转

```
SETUP → REGISTRATION → PROGRESSION → ENDED
```

| 状态 | 含义 | 触发操作 |
|------|------|----------|
| SETUP | 筹备中 | 管理员 publish() → REGISTRATION |
| REGISTRATION | 报名中 | 管理员 start() → PROGRESSION（需 ≥2 队） |
| PROGRESSION | 进行中 | 逐场记录胜负；决赛完成 → ENDED |
| ENDED | 已结束 | 展示冠军，不可再操作 |

### 种子分配算法

蛇形排序（左右交替填充）：

```java
private int[] getSeedOrder(int totalTeams) {
    int[] order = new int[totalTeams];
    int left = 0, right = totalTeams - 1;
    int seed = 1;
    while (left <= right) {
        order[left++] = seed++;
        if (left <= right) order[right--] = seed++;
    }
    return order;
}
```

以 8 队为例：种子顺序 `[1, 8, 4, 5, 2, 7, 3, 6]`

对阵安排：

```
1/4决赛    半决赛      决赛
1 vs 8   ─┐
          ├─ ? ─┐
4 vs 5   ─┘     │
                ├─ 冠军
2 vs 7   ─┐     │
          ├─ ? ─┘
3 vs 6   ─┘
```

### 淘汰赛逻辑

- **轮次数** = `log2(总队伍数)`（8 队 → 3 轮）
- **对阵生成**：按种子顺序依次填入第一轮 `position 0~3` 的 `team1` 和 `team2`
- **自动晋级**：
  - `nextPosition = position / 2`
  - `position % 2 == 0` → 胜者填入下一轮对应位置的 `team1`
  - `position % 2 == 1` → 胜者填入 `team2`
- **自动结束**：决赛轮（`round == totalRounds - 1`）记录胜负后，赛事自动 ENDED 并设置 `championTeamId`

### 删除赛事

级联删除顺序：对阵表 → 报名数据 → 赛事本身。

---

## 开发细节

| 项目 | 说明 |
|------|------|
| 数据库 | MySQL 8，库名 `njuvachampion`，用户 `root`，密码由部署环境注入（环境变量 `DB_PASSWORD`），不写入仓库 |
| JPA | `ddl-auto: update`，自动建表 |
| JWT | HS256，密钥 Base64 编码，24h 过期；生产由环境变量 `APP_JWT_SECRET` 注入 |
| CORS | 全局允许所有来源和方法 |
| 前端代理 | `next.config.ts` 中 `rewrites` 将 `/api/*` 转发到 `http://127.0.0.1:8080/api/*`，`/ocr` 转发到 OCR 服务 `http://127.0.0.1:3200/ocr` |
| UI 风格 | 深色背景 + 紫色/红色/橙色渐变（Valorant 主题），Tailwind CSS v4 |

## 对阵图可视化（BracketTree）

components/BracketTree.tsx 使用纯 CSS 定位绘制对阵图：

- **布局参数**：每场比赛卡片 200×64px，水平间距 72px，垂直间距根据轮次自动计算
- **对阵线**：使用 ::before / ::after 伪元素绘制连接线（border-left + border-bottom）
- **轮次标注**：根据比赛数量自动生成标签（1/8决赛、1/4决赛、半决赛、决赛）
- **双败支持**：区分胜者组/败者组/总决赛，败者组轮次从底部向上计算
- **可点击**：点击比赛卡片触发 onMatchClick 回调，管理员可记录胜负
