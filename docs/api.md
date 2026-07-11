# API 文档

## 基础信息

- **Base URL**: /api
- **认证方式**: Authorization: Bearer <JWT-Token>
- **响应格式**: Result<T> = { code: number, message: string, data: T }
- **后端端口**: 8080（前端通过 Next.js rewrites 代理）

---

## 公开接口

### 认证 /api/auth

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | /api/auth/register | 注册 | { username, password, gameId?, email? } |
| POST | /api/auth/login | 登录，返回 JWT | { username, password } |

### 用户 /api/user（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/user/profile | 获取当前用户资料 |
| PUT | /api/user/username | 修改用户名（管理员不可用） |
| PUT | /api/user/email | 修改邮箱（管理员不可用） |
| PUT | /api/user/game-id | 修改游戏 ID（管理员不可用） |
| PUT | /api/user/password | 修改密码（需旧密码，管理员不可用） |

### 公开用户 /api/users（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 用户列表（不含管理员，含战队信息） |
| GET | /api/users/{id} | 用户详情 |

### 战队 /api/teams（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/teams | 创建战队 |
| GET | /api/teams | 全部战队列表 |
| GET | /api/teams/my | 我的战队 |
| GET | /api/teams/captain | 我担任队长的战队列表 |
| GET | /api/teams/{id} | 战队详情（含队员列表） |
| POST | /api/teams/{id}/join | 加入战队（上限 5 人） |
| POST | /api/teams/{id}/leave | 退出战队 |

### 赛事 /api/tournaments（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tournaments | 赛事列表 |
| GET | /api/tournaments/{id} | 赛事详情（含报名队伍和对阵表） |
| POST | /api/tournaments/{id}/register | 报名参赛（需 teamId） |
| POST | /api/tournaments/{id}/unregister | 取消报名（需 teamId） |


## 搜索接口（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/search?q=keyword | 全局搜索（用户/战队/赛事） |

## 管理员接口（需 ADMIN 角色）

### 用户管理 /api/admin/users

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 用户列表 |
| GET | /api/admin/users/{id} | 用户详情 |
| PUT | /api/admin/users/{id} | 修改用户（含重置密码为 123456） |
| DELETE | /api/admin/users/{id} | 禁用用户（status=0） |

### 战队管理 /api/admin/teams

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/teams | 战队列表 |
| GET | /api/admin/teams/{id} | 战队详情 |
| POST | /api/admin/teams | 创建战队（含创建无人战队） |
| PUT | /api/admin/teams/{id} | 修改战队 |
| DELETE | /api/admin/teams/{id} | 解散战队（status=0） |

### 赛事管理 /api/admin/tournaments

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/tournaments | 创建赛事 |
| POST | /api/admin/tournaments/{id}/publish | 发布赛事（SETUP -> REGISTRATION） |
| POST | /api/admin/tournaments/{id}/start | 开始赛事，生成对阵表（REGISTRATION -> PROGRESSION） |
| POST | /api/admin/tournaments/{id}/register | 管理员手动添加单个队伍 | { teamId } |
| POST | /api/admin/tournaments/{id}/batch-register | 管理员批量添加队伍 | { teamIds: [id1, id2, ...] } |
| POST | /api/admin/tournaments/{id}/unregister | 管理员手动移除队伍 | { teamId } |
| PUT | /api/admin/tournaments/{id}/matches/{matchId} | 记录比赛结果 | { winnerTeamId, gamesPerMatch? } |
| DELETE | /api/admin/tournaments/{id} | 删除赛事（含关联数据） |


---

## 数据模型

### 赛事状态流转

SETUP -> REGISTRATION -> PROGRESSION -> ENDED

### 赛制支持

| 类型 | 赛制 | 队伍数限制 |
|------|------|-----------|
| CUP（杯赛） | SINGLE_ELIM（单败淘汰） | 2/4/8/16 |
| CUP（杯赛） | DOUBLE_ELIM（双败淘汰） | 4/8 |
| CUP（杯赛） | SWISS_ELIM（瑞士轮+淘汰赛） | 16 |
| LEAGUE（联赛） | SINGLE_RR（单循环） | >= 2 |
| LEAGUE（联赛） | DOUBLE_RR（双循环） | >= 2 |

### 双败淘汰阶段

| 阶段(stage) | 说明 |
|------------|------|
| WINNERS | 胜者组 |
| LOSERS | 败者组 |
| GRAND_FINAL | 总决赛 |
