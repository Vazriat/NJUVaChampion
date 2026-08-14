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
| POST | /api/teams/{id}/join | 加入战队 |
| POST | /api/teams/{id}/leave | 退出战队 |

### 赛事 /api/tournaments（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tournaments | 赛事列表 |
| GET | /api/tournaments/{id} | 赛事详情（含报名队伍、对阵表、联赛积分榜 leagueStandings） |
| POST | /api/tournaments/{id}/register | 报名参赛（需 teamId） |
| POST | /api/tournaments/{id}/unregister | 取消报名（需 teamId） |

### 报名活动 /api/competitions（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/competitions | 报名活动列表 |
| GET | /api/competitions/{id} | 活动详情（含报名队伍与分组子赛事） |
| POST | /api/competitions/{id}/register | 报名（仅队长，需 teamId） |
| POST | /api/competitions/{id}/unregister | 取消报名（仅队长，需 teamId） |

### 认证 /api/certification（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/certification/apply | 提交认证申请。type: STUDENT（在校生）/ ALUMNI（校友）/ RANK（段位）/ REFEREE（裁判）。STUDENT 需 studentName+studentId+xuexinBase64；RANK 需 rank+evidenceBase64s；ALUMNI 需 evidenceBase64s；REFEREE 仅需 description |
| GET | /api/certification/my | 我的认证记录 |
| DELETE | /api/certification/{id} | 删除自己的认证 |

认证规则：同组互斥（identity 组的在校生/校友只能保留一个活跃认证）；段位需从规范化段位列表中选择。

### 认证审核 /api/admin/certifications（需 ADMIN 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/certifications | 认证列表，?status=PENDING 等过滤 |
| GET | /api/admin/certifications/{id} | 认证详情 |
| POST | /api/admin/certifications/{id}/approve | 通过（RANK 类型需 body { rank }） |
| POST | /api/admin/certifications/{id}/reject | 驳回 { reason } |
| POST | /api/admin/certifications/{id}/revoke | 撤销 |


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
| DELETE | /api/admin/users/{id} | 禁用用户（status=0，自动处理队长转让/战队解散） |
| DELETE | /api/admin/users/{id}/purge | 彻底删除用户（级联删除战队关系、认证记录与文件、生涯战绩，不可恢复） |

### 战队管理 /api/admin/teams

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/teams | 战队列表（含已解散战队） |
| GET | /api/admin/teams/ratings | 战队评分榜，?sort=score（按评分，默认）或 lexicographic（按段位字典序） |
| GET | /api/admin/teams/{id} | 战队详情 |
| POST | /api/admin/teams | 创建战队（含创建无人战队） |
| PUT | /api/admin/teams/{id} | 修改战队 |
| DELETE | /api/admin/teams/{id} | 解散战队（status=0，移除全部队员） |
| DELETE | /api/admin/teams/{id}/purge | 彻底删除战队（仅当无未删除赛事的报名/对阵/积分记录时允许） |

### 赛事管理 /api/admin/tournaments

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/tournaments | 创建赛事（联赛可选 hasPlayoffs / playoffFormat / playoffSize） |
| POST | /api/admin/tournaments/{id}/publish | 发布赛事（SETUP -> REGISTRATION） |
| POST | /api/admin/tournaments/{id}/start | 开始赛事，生成对阵表（REGISTRATION -> PROGRESSION） |
| POST | /api/admin/tournaments/{id}/register | 管理员手动添加单个队伍 | { teamId } |
| POST | /api/admin/tournaments/{id}/batch-register | 管理员批量添加队伍 | { teamIds: [id1, id2, ...] } |
| POST | /api/admin/tournaments/{id}/unregister | 管理员手动移除队伍 | { teamId } |
| GET | /api/admin/tournaments/{id}/league/standings | 联赛常规赛积分榜（胜/负/净胜局降序） |
| DELETE | /api/admin/tournaments/{id} | 删除赛事（级联删除对阵、小局、选手数据、截图文件、积分表） |

### 报名活动管理 /api/admin/competitions

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/competitions | 创建报名活动（SETUP） | { name, description? } |
| POST | /api/admin/competitions/{id}/publish | 发布活动（SETUP -> REGISTRATION） |
| POST | /api/admin/competitions/{id}/group | 手动分组：每组生成一个独立子赛事（REGISTRATION -> GROUPED） | { groups: [{ name, format, teamIds }] } |
| POST | /api/admin/competitions/{id}/register | 管理员添加单个队伍 | { teamId } |
| POST | /api/admin/competitions/{id}/batch-register | 管理员批量添加队伍 | { teamIds: [...] } |
| POST | /api/admin/competitions/{id}/unregister | 管理员移除队伍 | { teamId } |
| DELETE | /api/admin/competitions/{id} | 删除活动（仅删报名记录，子赛事保留） |

### 比赛小局 /api/admin/matches

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/matches/{matchId}/games/init | 初始化小局（BO1/BO3/BO5） | { boType } |
| PUT | /api/admin/matches/{matchId}/games/{gameId} | 记录单小局（比分/截图/选手数据） |
| POST | /api/admin/matches/{matchId}/finalize | 结算比赛，推进赛程 | { team1Wins, team2Wins } |
| GET | /api/admin/matches/{matchId}/detail | 比赛详情（含小局与选手数据） |


---

## 数据模型

### 赛事状态流转

SETUP -> REGISTRATION -> PROGRESSION -> ENDED

### 报名活动状态流转

SETUP（筹备中）-> REGISTRATION（报名中）-> GROUPED（已分组，生成子赛事）

### 赛制支持

| 类型 | 赛制 | 队伍数限制 |
|------|------|-----------|
| CUP（杯赛） | SINGLE_ELIM（单败淘汰） | 2/4/8/16 |
| CUP（杯赛） | DOUBLE_ELIM（双败淘汰） | 4/8 |
| CUP（杯赛） | SWISS_ELIM（瑞士轮+淘汰赛） | 16 |
| LEAGUE（联赛） | SINGLE_RR（单循环） | >= 2 |
| LEAGUE（联赛） | DOUBLE_RR（双循环） | >= 2 |

### 联赛季后赛（可选）

- 创建联赛时通过 `hasPlayoffs` 开启，`playoffFormat` 为 SINGLE_ELIM / DOUBLE_ELIM，`playoffSize` 为 2 / 4 / 8（须 <= 最大参赛队伍数）
- 常规赛（stage=REGULAR）结束后按积分榜取前 playoffSize 名进入季后赛；若实际参赛队伍少于 playoffSize，自动缩小到可容纳的最大 2 的幂（不足 4 队时双败退回单败）
- 常规赛积分：胜场数降序，同分按净胜局（小局比分差）降序

### 双败淘汰阶段

| 阶段(stage) | 说明 |
|------------|------|
| WINNERS | 胜者组 |
| LOSERS | 败者组 |
| GRAND_FINAL | 总决赛 |
