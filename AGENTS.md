# NJUVaChampion — 无畏契约赛事平台

## 项目结构

```
NJUVaChampion/
├── AGENTS.md                 ← 项目说明（本文件）
├── .gitignore                ← Git 忽略规则
├── Valorant/                 ← Spring Boot 后端
│   ├── pom.xml               ← Maven 构建（Spring Boot 3.4.0, Java 21）
│   ├── mvnw / mvnw.cmd       ← Maven Wrapper
│   └── src/main/
└── nvc/                      ← Next.js 前端（React）
    ├── package.json           ← Next.js 16.2.10, React 19.2.4
    ├── next.config.ts         ← API 代理到后端 8080
    ├── tsconfig.json
    ├── app/                   ← 页面
    ├── lib/                   ← API 服务层
    └── components/            ← 通用组件
```

## 后端技术栈

| 技术 | 说明 |
|------|------|
| Spring Boot 3.4.0 | 框架 |
| Spring Data JPA | ORM / 自动建表 |
| Spring Security | 认证鉴权（JWT 无状态） |
| MySQL 8 | 数据库（库名：`njuvachampion`） |
| JJWT 0.12.6 | JWT Token 生成与校验 |
| Lombok | 简化代码 |

## 后端包结构

`Valorant/src/main/java/com/NJUChampion/Valorant/`

| 包 | 文件 | 功能 |
|---|------|------|
| — | `ValorantApplication.java` | Spring Boot 入口 |
| `entity/` | `User.java` | 用户实体（id, username, password, gameId, email, role, status, createdAt, updatedAt） |
| `entity/` | `Team.java` | 战队实体（id, name, logo, description, captainId, status, createdAt, updatedAt） |
| `entity/` | `TeamMember.java` | 队员关系实体（id, teamId, userId, role, joinedAt） |
| `repository/` | `UserRepository.java` | 用户数据访问 |
| `repository/` | `TeamRepository.java` | 战队数据访问 |
| `repository/` | `TeamMemberRepository.java` | 队员关系数据访问 |
| `dto/` | `RegisterRequest.java`, `LoginRequest.java` | 注册/登录请求 |
| `dto/` | `UpdateUsernameRequest.java`, `UpdateEmailRequest.java`, `UpdateGameIdRequest.java`, `UpdatePasswordRequest.java` | 信息修改请求 |
| `dto/` | `CreateTeamRequest.java` | 创建战队请求 |
| `dto/` | `UserVO.java`, `TeamVO.java` | 用户/战队响应 VO（含嵌套信息） |
| `service/` | `UserService.java` | 注册、登录、修改信息业务逻辑 |
| `service/` | `TeamService.java` | 战队创建、加入、退出业务逻辑 |
| `controller/` | `UserController.java` | `/api/auth/register`, `/api/auth/login` |
| `controller/` | `ProfileController.java` | `/api/user/profile`, `/api/user/username`, `/api/user/email`, `/api/user/game-id`, `/api/user/password` |
| `controller/` | `PublicUserController.java` | `/api/users`（公开用户列表/详情，不含管理员） |
| `controller/` | `TeamController.java` | `/api/teams`（CRUD + join/leave） |
| `controller/` | `AdminController.java` | `/api/admin/users`, `/api/admin/teams`（管理员增删改查） |
| `config/` | `SecurityConfig.java` | Spring Security 配置（无状态 JWT，`/api/admin/**` 需 ADMIN 角色） |
| `config/` | `WebConfig.java` | CORS 跨域配置 |
| `config/` | `DataInitializer.java` | 启动时自动创建管理员账号（admin / admin123） |
| `config/jwt/` | `JwtAuthFilter.java` | JWT 鉴权过滤器 |
| `util/` | `JwtUtil.java` | JWT 工具（生成、校验、解析） |
| `common/` | `Result.java` | 统一响应包装 `Result<T>` |
| `common/` | `GlobalExceptionHandler.java` | 全局异常处理 |

## 数据库表

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户 | id(自增), username(唯一), password(BCrypt), game_id, email(唯一), role(PLAYER/ADMIN), status(1正常/0禁用), created_at, updated_at |
| `teams` | 战队 | id(自增), name(唯一), logo, description, captain_id, status(1正常/0解散), created_at, updated_at |
| `team_members` | 队员关系 | id(自增), team_id, user_id, role(CAPTAIN/MEMBER), joined_at |

**游戏 ID 格式：** 1-8 位主体 + `#` + 4-5 位数字标记码，如 `玩家#1234`；显示给其他人时只展示主体部分（`getDisplayGameId()`）。

## API 接口

### 认证（`/api/auth`）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（username, password, gameId?, email?） |
| POST | `/api/auth/login` | 登录，返回 JWT token |

### 用户个人（`/api/user`，需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取当前登录用户资料 |
| PUT | `/api/user/username` | 修改用户名（管理员不可用） |
| PUT | `/api/user/email` | 修改邮箱（管理员不可用） |
| PUT | `/api/user/game-id` | 修改游戏 ID（管理员不可用） |
| PUT | `/api/user/password` | 修改密码（需旧密码，管理员不可用） |

### 公开用户（`/api/users`，需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表（不含管理员，含战队信息） |
| GET | `/api/users/{id}` | 用户详情（不含管理员） |

### 战队（`/api/teams`，需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/teams` | 创建战队（name, logo?, description?） |
| GET | `/api/teams` | 全部战队列表 |
| GET | `/api/teams/my` | 我的战队 |
| GET | `/api/teams/{id}` | 战队详情（含队员列表） |
| POST | `/api/teams/{id}/join` | 加入战队（上限5人） |
| POST | `/api/teams/{id}/leave` | 退出战队 |

### 管理员（`/api/admin`，需 ADMIN 角色）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/users/{id}` | 用户详情 |
| PUT | `/api/admin/users/{id}` | 修改用户（含重置密码为 123456） |
| DELETE | `/api/admin/users/{id}` | 禁用用户（status=0） |
| GET | `/api/admin/teams` | 战队列表 |
| GET | `/api/admin/teams/{id}` | 战队详情 |
| PUT | `/api/admin/teams/{id}` | 修改战队 |
| DELETE | `/api/admin/teams/{id}` | 解散战队（status=0） |

## 前端结构

`nvc/`

| 路径 | 说明 |
|------|------|
| `app/layout.tsx` | 根布局（全局字体、元数据） |
| `app/page.tsx` | 首页（登录/注册入口） |
| `app/login/page.tsx` | 登录页（管理员跳转 /admin，普通用户跳转 /dashboard） |
| `app/register/page.tsx` | 注册页 |
| `app/dashboard/page.tsx` | 仪表盘（欢迎信息、各模块入口、所属战队、账号信息） |
| `app/admin/page.tsx` | 管理后台（概览、用户管理、战队管理，含编辑弹窗） |
| `app/settings/page.tsx` | 账号设置（修改用户名、游戏ID、邮箱、密码） |
| `app/hall/page.tsx` | 用户大厅（所有用户列表，可进入个人主页） |
| `app/profile/[id]/page.tsx` | 个人主页（显示用户信息和所属战队） |
| `app/teams/page.tsx` | 战队列表 |
| `app/teams/create/page.tsx` | 创建战队 |
| `app/teams/[id]/page.tsx` | 战队详情（队员列表、加入/退出按钮） |
| `components/NavBar.tsx` | 导航栏（Logo 回 dashboard，链接到用户大厅/战队管理，登录用户信息） |
| `components/AuthGuard.tsx` | 登录保护组件 |
| `lib/api.ts` | Axios 实例 + 所有 API 函数 |
| `lib/auth.ts` | Token/User 本地存储管理 |

## 关键业务逻辑

1. **管理员账号：** 启动时自动创建（admin/admin123），角色为 ADMIN，仅有管理功能，无个人主页，不可修改个人信息
2. **登录跳转：** ADMIN 角色跳转到 `/admin`，普通用户跳转到 `/dashboard`
3. **战队上限：** 每个战队最多 5 人（含队长），每人只能加入一个战队
4. **游戏 ID 显示：** 完整格式 `主体#标记码`，公开显示只展示 `主体` 部分
5. **管理员重置密码：** 仅能重置为固定值 `123456`

## 启动方式

**后端（端口 8080）：**
```bash
cd Valorant
mvn spring-boot:run
```

**前端（端口 3000，自动代理 /api 到后端 8080）：**
```bash
cd nvc
npm run dev
```

## 开发规范

- Java 21, TypeScript 5
- 包名 `com.NJUChampion.Valorant.*`
- 统一使用 `Result<T>` 作为 API 响应格式
- 异常统一由 `GlobalExceptionHandler` 处理
- 密码使用 BCrypt 加密存储
- JWT Token 通过 `Authorization: Bearer <token>` 传递
- 数据库自动建表（`ddl-auto: update`）
- 前端使用 Next.js App Router
- API 通过 Next.js rewrites 代理到后端 8080
- `.gitignore` 已配置排除 `target/`, `node_modules/`, `.next/`, IDE 文件等
