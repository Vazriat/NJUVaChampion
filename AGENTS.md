# NJUVaChampion — 无畏契约（Valorant）赛事平台

## 项目结构

```
NJUVaChampion/
├── AGENTS.md          ← 项目核心说明（本文件）
├── docs/              ← 详细文档（API / 架构算法）
├── Valorant/          ← Spring Boot 后端（端口 8080）
└── nvc/               ← Next.js 前端（端口 3000）
```

## 技术栈

- **后端：** Spring Boot 3.4.0 / JPA / Security / MySQL 8 / JJWT 0.12.6 / Lombok
- **前端：** Next.js 16.2.10 / React 19.2.4 / Axios / Tailwind CSS v4 / TypeScript 5

## 启动方式

```bash
# 后端（需先启动 MySQL）
cd Valorant && mvn spring-boot:run    # → http://localhost:8080

# 前端
cd nvc && npm run dev                  # → http://localhost:3000（/api 代理到 8080）
```

## 业务规则

1. **管理员**：启动时自动创建 admin / admin123，角色 ADMIN；无个人主页，不可修改个人信息
2. **登录跳转**：ADMIN → `/admin`，普通用户 → `/dashboard`
3. **战队限制**：每队最多 5 人（含队长），每人只能加入一个战队
4. **游戏 ID**：格式 `主体#标记码`（如 `玩家#1234`），公开显示仅展示主体部分
5. **管理员重置密码**：仅能重置为固定值 `123456`
6. **密码**：BCrypt 加密存储
7. **响应格式**：统一 `Result<T>`（code/message/data）
8. **赛事报名**：`maxTeams` 可配置（默认 2），每队每赛事限报一次
9. **赛事状态**：SETUP → REGISTRATION → PROGRESSION → ENDED

## 开发规范

- Java 21 + TypeScript 5，包名 `com.NJUChampion.Valorant.*`
- 统一 `Result<T>` 响应，全局异常处理
- JWT 通过 `Authorization: Bearer <token>` 传递（24h 过期）
- JPA `ddl-auto: update` 自动管理表结构
- 前端 Next.js App Router + Tailwind CSS v4，深色主题（紫/红/橙点缀）
- `.gitignore` 已排除 `target/`、`node_modules/`、`.next/`、IDE 文件

## 文件编码规范

- 所有 `.ts` / `.tsx` 前端文件必须使用 **UTF-8 无 BOM** 编码
- 禁止使用 GBK / GB2312 等非 UTF-8 编码保存含中文的代码文件，否则打包时会抛出 `Unterminated string constant` 错误
- 写入中文文本时使用 `System.Text.UTF8Encoding` 的 `$false` 参数（无 BOM），避免 PowerShell 默认添加 BOM（`0xEF 0xBB 0xBF`）导致 Next.js 编译异常

## 文档维护规则

- `AGENTS.md` 和 `docs/` 下的文档需要在每次代码改动后同步检查更新
- `docs/api.md`：API 路径、参数、权限变动时更新
- `docs/architecture.md`：实体字段变更、算法调整、项目结构变动时更新
- AGENTS.md 保持精简，只记录最关键的规范、规则和注意事项