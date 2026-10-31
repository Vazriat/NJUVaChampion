# API 文档

## 基础信息

- **Base URL**: /api
- **认证方式**: Authorization: Bearer <JWT-Token>
- **响应格式**: Result<T> = { code: number, message: string, data: T }
- **后端端口**: 8080（前端通过 Next.js rewrites 代理）

---

## 身份认证门槛（code 40301）

所有普通用户（非 ADMIN）必须先通过**在校生（STUDENT）或校友（ALUMNI）身份认证**，才能使用平台业务功能（战队、赛事、报名、比赛记录、搜索、通知等）。

- 未通过认证时，访问白名单之外的接口返回 `HTTP 403`，响应体：`Result { code: 40301, message: "请先完成在校生/校友身份认证" }`
- 判定依据：`certifications` 表中存在 type 为 STUDENT/ALUMNI 且 status 为 APPROVED 的记录（与 User.verifiedType 无关，REFEREE/RANK 认证不算身份认证）
- 审核通过后**无需重新登录**，实时生效（每个请求实时查表判定）
- 管理员（ADMIN）豁免；未登录游客不受影响（维持现有公开接口规则）

### 未认证期间可用接口（白名单）

| 路径 | 说明 |
|------|------|
| /api/auth/** | 登录 / 注册 |
| /api/certification/** | 认证申请、我的认证记录、删除认证 |
| /api/user/** | 个人资料查看与修改 |
| /api/career/** | 生涯数据（公开只读） |
| /uploads/** | 上传文件访问 |

前端在收到 code 40301 时自动跳转到 `/verify?required=1` 引导用户完成认证。

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
| GET | /api/user/profile | 获取当前用户资料（含 verifiedType / verifiedRank / referee 裁判标记） |
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
| POST | /api/teams/{id}/join | **提交入队申请**（已改为审批制，不再直接入队；返回申请记录） |
| POST | /api/teams/{id}/leave | 退出战队（队长不可退出） |
| GET | /api/teams/{id}/applications | 该队申请与邀请（含已处理），**仅队长可查看** |
| DELETE | /api/teams/{id}/members/{userId} | 踢出队员，**仅队长**；不能踢自己；连带作废该用户的待处理申请 |

> 入队为队长审批制：队伍**不设人数上限**。队员同时只能有 1 条待处理的入队申请。

### 人才市场帖子 /api/recruitment-posts（需 Token）

一种帖子两种类型：`TEAM` 队伍招人、`PLAYER` 选手求职。内容只有一个自由文本字段。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/recruitment-posts | 列表，参数 `type`（TEAM/PLAYER，可空）、`keyword`（可空，全文模糊匹配）、`userId`、`teamId` |
| GET | /api/recruitment-posts/mine | 我发布的帖子 |
| GET | /api/recruitment-posts/{id} | 详情 |
| POST | /api/recruitment-posts | 发帖 `{ type, content }` |
| PUT | /api/recruitment-posts/{id} | 修改内容，**仅作者** |
| DELETE | /api/recruitment-posts/{id} | 关闭帖子（置 CLOSED），**仅作者** |

发帖约束：
- `TEAM`：调用者必须是该队队长（`teams.captain_id`），且队伍未解散；同一队伍同时只能有 1 条 OPEN 招募帖
- `PLAYER`：调用者不得已加入任何战队；同一用户同时只能有 1 条 OPEN 求职帖

返回字段中 `canApply` 表示当前用户能否发起，`applicationStatus` / `applicationId` 表示与该帖相关的待处理记录。

列表查询参数：

| 参数 | 用途 | 说明 |
|------|------|------|
| `type` | 人才市场双 Tab | `TEAM` / `PLAYER`，不传则两类都返回 |
| `keyword` | 搜索框 | 对 `content` 做忽略大小写的模糊匹配 |
| `userId` | **个人主页** | 只返回该用户当前 OPEN 的帖子。由于队长至多一条招募帖、未入队者至多一条求职帖，结果通常是 0 或 1 条 |
| `teamId` | **队伍页** | 只返回该队伍当前 OPEN 的招募帖 |

`userId` / `teamId` 可与 `type` 组合，过滤在返回集上叠加。所有查询只返回 `OPEN` 状态的帖子——已关闭的帖子不会出现在个人主页或队伍页上。

### 入队申请与邀请 /api/team-applications（需 Token）

统一承载三条入口：市场里队员申请（`APPLY`）、市场里队长邀请（`INVITE`）、战队页直接申请（`APPLY`，`postId` 为 null）。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/team-applications | 发起 `{ type, teamId, targetUserId?, postId?, content? }`（`INVITE` 必须给 `targetUserId`） |
| GET | /api/team-applications/inbox | 我收到的（作为队长收到的申请 + 我收到的邀请） |
| GET | /api/team-applications/mine | 我发起的（我提交的申请 + 我发出的邀请） |
| POST | /api/team-applications/{id}/accept | 同意 → 写入战队成员 |
| POST | /api/team-applications/{id}/reject | 拒绝 |
| DELETE | /api/team-applications/{id} | 撤回，**仅发起方**（选手撤回申请 / 队长撤回邀请） |

处理权限：
- `APPLY`：实时判定 `调用者 == 当前队长`（`teams.captain_id`）。记录里的 `targetUserId` 只是创建时的队长快照，队长转让后申请不会卡在旧队长名下
- `INVITE`：判定 `调用者 == targetUserId`

同意后的连带处理（同一事务内）：
1. 作废该用户**其它所有** PENDING 记录（避免一人两队）
2. 关闭该用户的 OPEN 求职帖
3. 不关闭招募帖（队伍无人数上限）

### 定向消息 /api/notifications（需 Token）

发给当前登录用户本人的消息。与 `announcements`（广播公告）的区别：此处按 `userId` 定向投递。

> **命名说明**：系统里有两套互不相干的"通知"，UI 上刻意用了不同的词以免混淆：
> - **通知** = `announcements` / `tournament_announcements`，管理员发布、所有人可见。页面 `/announcements`，dashboard 右侧栏"最新通知"。
> - **消息** = 本模块 `user_notifications`，系统按 userId 定向投递。页面 `/notifications`，NavBar 的"消息"与 dashboard 的"我的消息"卡片。
>
> 两者数据、接口、表完全独立，已交叉验证互不干扰。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/notifications | 我的通知，未读优先按时间倒序，最多返回 50 条 |
| GET | /api/notifications/unread-count | 未读数 `{ count }` |
| POST | /api/notifications/{id}/read | 标记单条已读 |
| POST | /api/notifications/read-all | 全部标记已读，返回 `{ updated }` |

通知触发点：

| type | 触发时机 | 接收方 |
|------|----------|--------|
| APPLICATION_RECEIVED | 选手提交入队申请 | 该队队长 |
| INVITE_RECEIVED | 队长发出邀请 | 被邀请的选手 |
| APPLICATION_ACCEPTED | 申请/邀请被同意 | 选手（APPLY）/ 当前队长（INVITE） |
| APPLICATION_REJECTED | 申请/邀请被拒绝 | 发起方 |
| APPLICATION_CANCELLED | 申请/邀请被撤回 | 对方 |
| TEAM_DISMISSED | 被队长踢出战队 | 被踢的队员 |
| POST_TAKEN_DOWN | 帖子被管理员下架 | 帖子作者 |

`refType` 取值 `TEAM_APPLICATION` / `RECRUITMENT_POST` / `TEAM`，前端据此决定跳转目标（后端不感知前端路由）。通知与业务操作共用同一事务，业务回滚时通知一并回滚。

### 赛事 /api/tournaments（需 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tournaments | 赛事列表 |
| GET | /api/tournaments/{id} | 赛事详情（含报名队伍、对阵表、联赛积分榜 leagueStandings；对阵含 team1Wins/team2Wins 小局胜局数、team1Score/team2Score 总比分、hasPendingSubmission 待审核申报标记，赛事含 groupName） |
| GET | /api/tournaments/{id}/player-stats | 参赛选手在该赛事的数据表（acs/kd/kpr/首杀率/存活率/回合助攻等） |
| GET | /api/tournaments/{id}/announcements | 该赛事已发布的通知列表 |
| GET | /api/tournament-notifications/my | 当前用户参赛赛事的最新通知 |
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
| POST | /api/certification/apply | 提交认证申请。type: STUDENT（在校生）/ ALUMNI（校友）/ RANK（段位）/ REFEREE（裁判）。STUDENT 需 studentName+studentId+enrollmentYear+xuexinBase64；RANK 需 rank+evidenceBase64s；ALUMNI 需 enrollmentYear+evidenceBase64s；REFEREE 仅需 description |
| GET | /api/certification/my | 我的认证记录 |
| DELETE | /api/certification/{id} | 删除自己的认证 |

认证规则：同组互斥（identity 组的在校生/校友只能保留一个活跃认证）；在校生/校友认证需填写入学年份 `enrollmentYear`（整数，如 2023，范围为 1900 ~ 明年）；段位需从规范化段位列表中选择；段位认证通过后可通过重新提交申请更新段位，旧认证会标记为 SUPERSEDED。

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

## 生涯接口 /api/career

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/career/{userId} | 生涯总览：avgAcs、avgKd、回合数据（killsPerRound/deathsPerRound/assistsPerRound/firstBloodRate/survivalRate，均为小数）、生涯总 K/D/A（totalKills/totalDeaths/totalAssists）、胜率、常用特工、参赛赛事 |
| GET | /api/career/{userId}/matches | 生涯比赛记录（按小局返回选手数据） |
| GET | /api/career/{userId}/analysis?ranks=黄金,白银&tournaments=1,2 | 数据分析：以所选大段（可多选，逗号分隔）全部有数据用户为基础集；可选 tournaments 按赛事 ID 过滤数据集。返回六维数据（acs/kd/kpr/survivalRate/assistsPerRound/firstBloodRate）的当前用户值、基础集均值、baseSetSize，以及每维详细排名 topRank/botRank（1~3，不在前三则 null） |

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

### 人才市场管理 /api/admin/recruitment-posts

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/recruitment-posts | 全部帖子（含已关闭），参数 `type`（TEAM/PLAYER）、`status`（OPEN/CLOSED）、`keyword` |
| POST | /api/admin/recruitment-posts/{id}/take-down | 下架帖子（置 CLOSED 并**通知作者**） |

> 下架不做物理删除，因此用 `POST /take-down` 而非 `DELETE`，语义更准确。
> 下架后作者可以重新发布一条新帖（旧帖已是 CLOSED，不占用"一队/一人一帖"的名额）。
> 暂不提供"恢复上架"：恢复可能与"一队一帖"约束冲突（作者期间可能已发新帖）。

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
| GET | /api/admin/tournaments/{id}/swiss/standings | 瑞士轮积分榜（wins/losses/buchholz，含战队名 teamName；BU=交手对手胜场之和，按胜场+BU 降序） |
| DELETE | /api/admin/tournaments/{id} | 删除赛事（级联删除对阵、小局、选手数据、截图文件、积分表） |
| GET | /api/admin/tournaments/{id}/announcements | 赛事通知列表（含草稿） |
| POST | /api/admin/tournaments/{id}/announcements | 创建赛事通知 |
| PUT | /api/admin/tournaments/{id}/announcements/{nid} | 修改赛事通知 |
| POST | /api/admin/tournaments/{id}/announcements/{nid}/publish | 发布赛事通知 |
| DELETE | /api/admin/tournaments/{id}/announcements/{nid} | 删除赛事通知 |
| GET | /api/admin/tournaments/{id}/rank-review | 段位审核列表（段位认证早于赛事/父活动创建时间的选手） |
| POST | /api/admin/tournaments/{id}/rank-review/pass | 通过/豁免某选手 { userId } |
| DELETE | /api/admin/tournaments/{id}/rank-review/pass?userId= | 取消豁免 |

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
| GET | /api/admin/competitions/{id}/rank-review | 活动分组前段位审核列表（以活动创建时间为基准） |
| POST | /api/admin/competitions/{id}/rank-review/pass | 通过/豁免某选手 { userId } |
| DELETE | /api/admin/competitions/{id}/rank-review/pass?userId= | 取消豁免 |

### 比赛小局 /api/admin/matches

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/admin/matches/{matchId}/games/init | 初始化小局（BO1/BO3/BO5） | { boType } |
| PUT | /api/admin/matches/{matchId}/games/{gameId} | 记录单小局（比分/截图/选手数据） |
| POST | /api/admin/matches/{matchId}/finalize | 结算比赛，推进赛程 | { team1Wins, team2Wins }（校验：仅按所选 BO 限制，胜者须达 BO 半数+1 胜） |
| GET | /api/admin/matches/{matchId}/detail | 比赛详情（含小局与选手数据；另含 pendingSubmission / approvedSubmission 申报信息，供录入弹窗提示） |

### 赛果申报（裁判上报 + 管理员审核）

**流程**：已通过裁判认证（REFEREE 认证）的用户完整录入赛果（BO/总比分/每局比分/截图/选手数据）→ 提交申报（PENDING）→ 管理员审核（可修正后通过，或驳回附原因）→ 通过后由后端将申报内容**落库到正式比赛数据**并推进赛程。

**状态机**：PENDING → APPROVED / REJECTED；本人可撤销 PENDING → CANCELLED；驳回后可重新申报。

**裁判端 /api/result-submissions**（需 REFEREE 认证；仍在身份认证门槛内）：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/result-submissions | 提交申报（body 见下） |
| PUT | /api/result-submissions/{id} | 修改自己的 PENDING 申报 |
| GET | /api/result-submissions/my | 我的申报列表 |
| GET | /api/result-submissions/{id} | 我的申报详情（含 payload） |
| DELETE | /api/result-submissions/{id} | 撤销自己的 PENDING 申报 |

**管理端 /api/admin/result-submissions**（ADMIN）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/result-submissions?status=&tournamentId= | 申报列表 |
| GET | /api/admin/result-submissions/{id} | 申报详情（含 payload、截图、裁判与比赛信息） |
| POST | /api/admin/result-submissions/{id}/approve | 通过 { reviewNote?, 修正后的完整赛果可选 }；缺省用申报原稿 |
| POST | /api/admin/result-submissions/{id}/reject | 驳回 { reviewNote（原因，必填） } |

**申报 body（POST/PUT）**：

```json
{
  "matchId": 123, "boType": 3,
  "team1Wins": 2, "team2Wins": 1, "note": "备注",
  "games": [
    { "gameNumber": 1, "team1Score": 13, "team2Score": 9,
      "screenshotBase64": "data:image/png;base64,...",
      "screenshotPath": "已存在截图路径（编辑回传时）",
      "playerStats": [
        { "userId": 8, "playerName": "RazePro", "teamId": 3,
          "stats": { "agent": "雷兹", "acs": 286, "kills": 19, "deaths": 12, "assists": 4, "firstBlood": 3 } }
      ] }
  ]
}
```

**规则**：总比分与管理员录入共用同一 BO 校验（胜者须达 BO/2+1 胜）；同一比赛仅允许一条 PENDING 申报（前端会对自己的待审核申报提供「修改 / 撤销并重新申报」引导，对他人的待审核申报提示不可重复申报）；审核通过时若比赛尚未初始化小局则自动创建占位；已录小局不会被清空，按申报内容覆盖对应局号；申报截图保存于 /uploads/submissions/{id}/。


---

## 直播与回放

设计说明见 `docs/live-module.md`。访问门槛与 `/api/tournaments/**` 一致（需 Token，未通过身份认证会被 `CertificationGateFilter` 拦截）。

### 公开只读

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/live/streams?page=1&size=20` | 正在直播列表，按开播时间倒序 |
| GET | `/api/live/streams?matchId=66` | 某场比赛的直播历史 |
| GET | `/api/live/replays?matchId=66` | 某场比赛的回放（倒序，最新在前） |
| GET | `/api/live/channels?page=1&size=20` | 主播列表（已绑定频道且未隐藏的裁判） |

直播条目返回：

```json
{
  "id": 2, "matchId": 66, "tournamentId": 8, "refereeId": 7,
  "platform": "BILIBILI", "roomId": "7734200", "rawUrl": "https://live.bilibili.com/7734200",
  "status": "LIVE", "startedAt": "2026-10-31T18:05:00", "endedAt": null,
  "team1Name": "WDG", "team2Name": "4", "tournamentName": "瑞士轮测试"
}
```

> `rawUrl` 只用于跳转。站内播放器必须用 `platform + roomId` 模板拼接，禁止把 `rawUrl` 塞进 iframe。

### 裁判端（需已通过 REFEREE 认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/referee/live/channel` | 我的直播间，未绑定返回 `data: null` |
| PUT | `/api/referee/live/channel` | 绑定/更新，body `{ "url": "https://live.bilibili.com/6" }` |
| DELETE | `/api/referee/live/channel` | 解绑（有直播进行中时拒绝） |
| GET | `/api/referee/live/matches` | 可开播的比赛：进行中赛事里尚未开打且无直播的场次 |
| GET | `/api/referee/live/preview?matchId=66` | 开播确认框数据 |
| POST | `/api/referee/live/streams` | 开播，body `{ "matchId": 66 }` |
| PATCH | `/api/referee/live/streams/{id}/end` | 结束直播（幂等） |
| POST | `/api/referee/live/replays` | 新增回放，body `{ "matchId": 66, "url": "https://...", "title": "可选" }` |
| DELETE | `/api/referee/live/replays/{id}` | 删除自己上传的回放 |

绑定环节会把 B 站短号转换为真实 `room_id`（`live.bilibili.com/6` → `7734200`）。用短号拼播放器会黑屏，所以这一步不能省。

`preview` 返回：

```json
{
  "matchName": "WDG vs 4", "tournamentName": "瑞士轮测试",
  "channel": { "platform": "BILIBILI", "roomId": "7734200", "rawUrl": "https://live.bilibili.com/7734200" },
  "canStart": true, "blockReason": null, "activeStreamId": null,
  "warnings": ["该场比赛已完结，确认是重赛并重新开播？"],
  "roomTitle": "【预告】1号1点全球总决赛瑞士轮第五轮", "roomLive": true
}
```

`canStart=false` 时 `blockReason` 给出原因（未绑定频道 / 赛事不在进行中 / 该场正在直播 / 你还有另一场在播）。

### 管理端（需 ADMIN 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/live/channels?status=&page=1&size=20` | 频道列表（不传 status 查全部） |
| PATCH | `/api/admin/live/channels/{id}/status` | body `{ "status": "HIDDEN" }`，隐藏/恢复 |
| PATCH | `/api/admin/live/streams/{id}/end` | 强制结束直播 |
| DELETE | `/api/admin/live/replays/{id}` | 删除任意回放 |

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
