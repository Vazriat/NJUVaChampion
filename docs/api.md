# API 接口文档

> 基址：`http://localhost:8080/api`（前端通过 Next.js rewrites 代理，开发时直接用 `/api`）
> 认证：`Authorization: Bearer <token>`（JWT，24h 过期）
> 响应格式：`Result<T>` 统一包装

---

## 一、认证（公开）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（username, password, gameId?, email?） |
| POST | `/api/auth/login` | 登录，返回 JWT + user |

---

## 二、用户个人（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取当前登录用户资料 |
| PUT | `/api/user/username` | 修改用户名（管理员不可用） |
| PUT | `/api/user/email` | 修改邮箱（管理员不可用） |
| PUT | `/api/user/game-id` | 修改游戏 ID（管理员不可用） |
| PUT | `/api/user/password` | 修改密码（需旧密码，管理员不可用） |

---

## 三、公开用户（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表（不含管理员，含战队信息） |
| GET | `/api/users/{id}` | 用户详情（不含管理员） |

---

## 四、战队（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/teams` | 创建战队（name, logo?, description?） |
| GET | `/api/teams` | 全部战队列表 |
| GET | `/api/teams/my` | 我的战队（单条或 null） |
| GET | `/api/teams/captain` | 我担任队长的战队列表 |
| GET | `/api/teams/{id}` | 战队详情（含成员列表） |
| POST | `/api/teams/{id}/join` | 加入战队（上限 5 人，每人限 1 队） |
| POST | `/api/teams/{id}/leave` | 退出战队 |

---

## 五、管理员（需 ADMIN 角色）

### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/users/{id}` | 用户详情 |
| PUT | `/api/admin/users/{id}` | 修改用户（可重置密码为 123456） |
| DELETE | `/api/admin/users/{id}` | 禁用用户（status=0） |

### 战队管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/teams` | 战队列表 |
| GET | `/api/admin/teams/{id}` | 战队详情 |
| PUT | `/api/admin/teams/{id}` | 修改战队 |
| DELETE | `/api/admin/teams/{id}` | 解散战队（status=0） |

---

## 六、赛事 — 选手端（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tournaments` | 赛事列表 |
| GET | `/api/tournaments/{id}` | 赛事详情（含报名队伍、对阵表） |
| POST | `/api/tournaments/{id}/register` | 报名参赛（请求体含 teamId） |
| POST | `/api/tournaments/{id}/unregister` | 取消报名（请求体含 teamId） |

## 七、赛事 — 管理员端（需 ADMIN 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/tournaments` | 创建赛事（name, description?, maxTeams?） |
| POST | `/api/admin/tournaments/{id}/publish` | 发布赛事（→ REGISTRATION） |
| POST | `/api/admin/tournaments/{id}/start` | 开始比赛，生成对阵表（→ PROGRESSION） |
| PUT | `/api/admin/tournaments/{id}/matches/{matchId}` | 记录比赛结果（winnerTeamId） |
| DELETE | `/api/admin/tournaments/{id}` | 删除赛事（级联删除对阵 + 报名数据） |
