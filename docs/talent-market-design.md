# 人才市场模块 设计文档（v2）

> 状态：**已实现并端到端实测通过**（后端编译、前端 `tsc --noEmit`、真实启动建表、全流程 API 实测）。第 8.1 节挂起未做。
> v1 → v2 主要变化：入队改为审批制、队长可踢人、**取消人数上限**、帖子字段精简为单一自由文本、队员同时仅可申请一支战队。
> v2 → v3 追加：定向通知（§9）、管理员下架帖子（§10）。
> v3 → v4 追加：个人主页与队伍页入口、抽出共用帖子卡片（§11）。
>
> ⚠️ 全部改动**尚未 commit**，一直停留在工作区。

---

## 0. 本轮已确定的决策

| # | 决策 |
|---|------|
| 1 | 入队需要队长审批；队长可以踢人 |
| 2 | 队长可在人才市场直接发起邀请；队员可根据招募帖直接申请入队 |
| 3 | 队伍**保持无人数上限** |
| 4 | 帖子不设结构化字段，**统一为一个自由文本字段**，用户想写什么写什么 |
| 5 | 队员同时只能有 1 条待处理申请；要申请其它战队必须先取消 |

---

## 1. 结论

- 新表从 3 张降到 **2 张**：`recruitment_posts`（帖子）+ `team_applications`（入队申请/邀请）。
- 因为字段精简后"队伍招募帖"与"选手求职帖"结构完全一致，**合并为一张表**，用 `type` 区分。这不是省事，是避免两套完全重复的 CRUD。
- `team_applications` 统一承载**三条入口**：市场里队员申请、市场里队长邀请、战队页直接"申请加入"。三者状态机与落库动作完全一样，只是发起方和来源不同。
- **无人数上限**意味着 v1 里所有"满 5 人"相关规则全部作废（校验、自动关帖），移除。
- 改动集中在 2 处既有代码：`TeamService`（`join` 语义改为提交申请，新增 `dismissMember`）、`frontend/app/teams/[id]/page.tsx`（按钮语义与队长审批区）。

---

## 2. 数据模型（2 张新表）

### 2.1 `recruitment_posts` — 人才市场帖子

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| type | VARCHAR(20), NOT NULL | `TEAM` 队伍招人 / `PLAYER` 选手求职 |
| team_id | BIGINT, NULL | 仅 `TEAM` 类型有值 |
| user_id | BIGINT, NOT NULL | 发布者（TEAM 类型时即该队队长） |
| content | TEXT, NOT NULL | **唯一的内容字段**，自由文本 |
| status | VARCHAR(20), DEFAULT 'OPEN' | OPEN / CLOSED |
| created_at / updated_at | DATETIME | |

> `type` 是系统判别字段、`status` 是状态字段、时间戳是审计字段——都不属于"用户填写的字段"。用户填写的确实只有 `content` 一个。

### 2.2 `team_applications` — 入队申请 / 邀请

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| type | VARCHAR(20), NOT NULL | `APPLY` 队员申请入队 / `INVITE` 队长邀请队员 |
| team_id | BIGINT, NOT NULL | 目标队伍 |
| post_id | BIGINT, NULL | 来源帖子；为 NULL 表示来自战队页直接申请 |
| initiator_user_id | BIGINT, NOT NULL | 发起方（APPLY 时是队员，INVITE 时是队长） |
| target_user_id | BIGINT, NOT NULL | 接收方（处理权限判定见 §2.3） |
| content | VARCHAR(300), NULL | 附言，同样是自由文本 |
| status | VARCHAR(20), DEFAULT 'PENDING' | PENDING / ACCEPTED / REJECTED / CANCELLED |
| handled_at | DATETIME, NULL | 处理时间 |
| created_at | DATETIME | |

### 2.3 处理人判定（重要设计点）

`APPLY` 的处理人应当是该队的**当前队长**。但如果把队长 id 固化进 `target_user_id`，队长一旦转让（`TeamService.onUserDisabled` 会改 `Team.captainId`），这条 PENDING 申请就会永远卡在旧队长名下，新队长处理不了。

**规则**：

- `APPLY`：`target_user_id` 存创建时的队长快照，仅用于展示；**实际处理权限实时判定 `caller.id == team.captainId`**。
- `INVITE`：`target_user_id` 即被邀请的队员，处理权限判定 `caller.id == target_user_id`。

---

## 3. 业务规则

### 3.1 发帖

1. `type = TEAM`：调用者必须是该队 `captainId`（**不要用 `TeamMember.role == "CAPTAIN"`**，`captainId` 才是权威字段）；队伍 `status == 1`。
2. `type = PLAYER`：调用者当前不得加入任何队伍。
3. 一个队伍同时只能有 **1 条 OPEN 的 TEAM 帖**。
4. 一个用户同时只能有 **1 条 OPEN 的 PLAYER 帖**。
5. 仅作者可修改 `content`、可关闭帖子（置 CLOSED）。
6. 无人数上限 → **不存在"满员自动关帖"**。

> 规则 3、4 是防刷屏的关键。没有它市场会被同一批人的重复帖淹没。

### 3.2 发起申请 / 邀请

| 入口 | type | 发起方 | 目标方 |
|------|------|--------|--------|
| 市场 · 招募帖详情 | APPLY | 任意未入队队员 | 该帖所属队伍 |
| 市场 · 求职帖详情 | INVITE | 该队队长 | 求职帖作者 |
| 战队页 · "申请加入" | APPLY | 任意未入队队员 | 该队伍 |

约束：

1. **队员同时只能有 1 条 PENDING 的 APPLY**（决策 5）。要换队必须先撤回（`DELETE`，置 CANCELLED）。
2. 队长可同时发出的 INVITE **不设上限**（见 §7 待确认 1）。
3. 同一（用户, 队伍）组合同时只能有 1 条 PENDING（不分 type）。
4. 发起方未加入任何队伍（APPLY 时）；目标队伍 `status == 1`。
5. 队员可**随时撤回**自己的 APPLY；队长可撤回自己发出的 INVITE。
6. 帖子为 CLOSED 时，不能再基于它发起。

### 3.3 同意的处理（ACCEPT）

处理人调用后，在同一个 `@Transactional` 内：

1. 校验：调用者是合法处理人（§2.3）
2. 校验：接收方当前未加入任何队伍
3. 校验：目标队伍存在且 `status == 1`
4. 校验：接收方账号 `status == 1`（未被禁用）
5. 写入 `team_members`（`role = "MEMBER"`）
6. **连带**（必须实现，漏了就是脏数据）：
   - 该用户**其它所有 PENDING 记录**（无论 APPLY 还是 INVITE）→ `CANCELLED`
   - 该用户自己的 OPEN PLAYER 帖 → `CLOSED`
7. **不关闭**任何招募帖（无人数上限，队伍永远可继续招人）

> 第 6 条漏掉的后果：人已经进了 A 队，B 队队长点同意后系统又把他塞进 B 队，出现一人两队。

### 3.4 拒绝 / 撤回

- REJECT：仅处理人可操作，置 `REJECTED`，不影响帖子状态。
- 撤回：仅发起方可操作，置 `CANCELLED`。
- 二者结束后，队员即可申请其它战队（约束只看 PENDING）。

### 3.5 踢人（DISMISS，新增能力）

新接口 `DELETE /api/teams/{teamId}/members/{userId}`：

1. 校验：调用者 `== team.captainId`；目标不是队长本人；目标确实是该队成员。
2. 删除 `team_members` 记录。
3. 连带：该用户所有 PENDING 记录 → `CANCELLED`。
4. 不自动改动该用户已 CLOSED 的求职帖（由用户自行处理）。
5. **历史战绩不受影响**：`PlayerGameStat` 存的是 `userId` + `playerName` 快照，不依赖 `team_members` 当前状态。已确认无需处理。

---

## 4. 接口设计

### 4.1 帖子 `/api/recruitment-posts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recruitment-posts` | 列表，参数 `type`（TEAM/PLAYER）、`keyword`、`page` |
| GET | `/api/recruitment-posts/{id}` | 详情，附带"我能否发起"与已发起状态 |
| POST | `/api/recruitment-posts` | 发帖 `{ type, content }` |
| PUT | `/api/recruitment-posts/{id}` | 改内容（仅作者） |
| DELETE | `/api/recruitment-posts/{id}` | 关闭帖子（仅作者，置 CLOSED） |
| GET | `/api/recruitment-posts/mine` | 我发布的 |

### 4.2 申请与邀请 `/api/team-applications`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/team-applications` | 发起 `{ type, teamId, targetUserId?, postId?, content? }` |
| GET | `/api/team-applications/inbox` | 我收到的（待处理优先） |
| GET | `/api/team-applications/mine` | 我发起的 |
| POST | `/api/team-applications/{id}/accept` | 同意 → 触发 §3.3 |
| POST | `/api/team-applications/{id}/reject` | 拒绝 |
| DELETE | `/api/team-applications/{id}` | 撤回 |

### 4.3 战队接口改造 `/api/teams`

| 方法 | 路径 | 变化 |
|------|------|------|
| POST | `/api/teams/{id}/join` | **语义变更**：改为"提交入队申请"，返回申请记录。路径保留以免前端大面积改动 |
| GET | `/api/teams/{id}/applications` | 新增。该队待处理申请（仅队长可看） |
| DELETE | `/api/teams/{id}/members/{userId}` | 新增。踢人（仅队长） |

---

## 5. 既有代码改动清单

| 文件 | 改动 |
|------|------|
| `backend/.../service/TeamService.java` | `join()` 语义改为创建 APPLY 记录，不再直接写 `team_members`；新增 `dismissMember()`；新增 `listTeamApplications()`。**不引入人数上限** |
| `backend/.../controller/TeamController.java` | 新增 `GET /{id}/applications`、`DELETE /{id}/members/{userId}` |
| `frontend/lib/api.ts` | 新增 `recruitmentPostApi`、`teamApplicationApi`；`teamApi` 补 `applications`、`dismissMember` |
| `frontend/app/teams/[id]/page.tsx` | "加入战队"→"申请加入"；显示"已申请，等待队长处理"；队长视角新增待审批区 + 成员行"踢出"按钮 |
| `frontend/components/NavBar.tsx` | `links` 数组（约 45-55 行）追加 `{ href: "/recruit", label: "人才市场" }` |
| `docs/api.md` | 同步新增接口表（`AGENTS.md` 强制要求） |

---

## 6. 前端新增页面

| 文件 | 内容 |
|------|------|
| `app/recruit/page.tsx` | 列表，双 Tab（队伍招募 / 选手求职），关键词搜索，发帖入口 |
| `app/recruit/new/page.tsx` | 发帖，**一个 textarea**，按身份自动决定 `type` |
| `app/recruit/mine/page.tsx` | 三区：我发的帖 / 我收到的 / 我发起的（含取消） |

### 移动端适配铁律（照 `AGENTS.md`）

页面骨架照抄 `app/teams/page.tsx` / `app/hall/page.tsx`：

```
<div className="min-h-screen bg-zinc-950 text-white max-md:min-h-dvh">
  <NavBar />
  <main className="mx-auto max-w-5xl px-8 py-10 max-md:px-4 max-md:py-8">
```

- 移动端适配**纯追加** `max-md:`，不改任何现有 class
- 新增移动端专属 DOM 用 `md:hidden`
- 禁止同一属性同时挂 `sm:` 与 `max-md:`（640–767px 区间取值不可控）
- 触摸目标 `min-h-11`

---

## 7. 决策结果（2026-09-19 定稿）

| # | 问题 | 结果 |
|---|------|------|
| 1 | 队长可同时发出的 INVITE 是否设上限？ | **不设上限**（已实现） |
| 2 | 帖子是否需要过期时间？ | **不加**。列表按 `created_at` 倒序，老帖自然沉底（已实现） |
| 3 | 申请长期无人处理时，队员怎么解锁？ | **选手可随时自行撤回**；`/recruit/mine` 展示待处理列表（已实现） |
| 4 | 被拒绝后能否立刻再申请同一队？ | **允许**，无冷却（已实现） |
| 5 | 赛事报名是否要加"队伍人数 ≥ 5"校验？ | **已加**：`TournamentService.registerTeam()` 校验 `countByTeamId >= TeamService.ROSTER_SIZE`（5） |
| 6 | 是否给管理员帖子下架能力？ | **已实现**：`POST /api/admin/recruitment-posts/{id}/take-down` + 后台"人才市场"tab |
| 7 | `users.game_id` 加唯一约束 / 修 OCR 匹配池 | **挂起**，后续按 §8.1 建议单独处理 |

已实现的额外能力：
- 选手可撤回自己的入队申请；队长可撤回自己发出的邀请（`DELETE /api/team-applications/{id}`）
- **定向通知**（见 §9）
- **管理员下架帖子**（见 §10）

---

## 9. 定向通知（第三轮追加）

原先只提到"不做站内私信，定向通知缺失"。本轮补上了通知，但**不是私信**——是单向的系统消息投递。

### 9.1 设计取舍

| 决策 | 理由 |
|------|------|
| 新建 `user_notifications` 表 | 现有 `announcements` / `tournament_announcements` 都是广播式（谁能看都行），没有按 `userId` 定向投递的能力，无法复用 |
| UI 上叫**「消息」**，不叫「通知」 | 避免与既有广播通知撞名。详见 §9.5 |
| 不做会话/未读数双人已读 | 那是私信。本模块只需"系统告诉我发生了什么" |
| 不引入 WebSocket / 定时轮询 | 未读数在**路由变化时**刷新一次。用户正常操作就会切换页面，够用；省掉长连接和轮询的心跳 |
| 通知与业务同事务 | 业务回滚时通知一并回滚，不产生"幽灵通知"（如：入队失败却收到"已通过"） |
| 通知写入不 try-catch | `NotificationService` 不依赖外部系统，不会失败。包一层反而会掩盖真实问题 |

### 9.2 字段

`user_notifications`：`id / user_id / type / title / content / ref_type / ref_id / is_read / created_at`

**注意 `is_read`**：MySQL 中 `READ` 是保留字，不能直接做列名，因此 Java 字段取名 `readFlag` 映射到列 `is_read`（与 AGENTS.md 第 4 条同源问题）。

### 9.3 通知触发点

| type | 时机 | 接收方 |
|------|------|--------|
| APPLICATION_RECEIVED | 选手提交申请 | 该队队长 |
| INVITE_RECEIVED | 队长发出邀请 | 被邀请选手 |
| APPLICATION_ACCEPTED | 申请/邀请被同意 | 选手（APPLY）/ 当前队长（INVITE） |
| APPLICATION_REJECTED | 被拒绝 | 发起方 |
| APPLICATION_CANCELLED | 被撤回 | 对方 |
| TEAM_DISMISSED | 被踢出战队 | 被踢者 |
| POST_TAKEN_DOWN | 帖子被下架 | 帖子作者 |

`notifyOther(actor, target, ...)` 在 `actor == target` 时跳过，避免自己收到自己的通知。

### 9.4 前端

- `NavBar` 加"消息"入口 + 未读角标（桌面右上、移动端抽屉内各一处，仅对已认证用户显示）
- `app/notifications/page.tsx`：标题"我的消息"，列表、单条已读、全部已读；点击按 `refType` 跳转
- `app/dashboard` 模块网格加"我的消息"卡片（带未读角标）

### 9.5 与既有广播通知的关系：完全独立

系统里原本已有两套**广播式**通知（`announcements` 全局公告、`tournament_announcements` 赛事通知），
由 `NotificationPanel` 组件在 dashboard 右侧栏与 `/announcements` 页面呈现。
本模块是第三套，性质不同：**按 userId 定向投递**。

**技术层面：零耦合，已实测交叉验证。**

| 检查项 | 结果 |
|--------|------|
| 是否改动任何既有通知文件 | 否（`NotificationPanel.tsx`、`AnnouncementController`、`AnnouncementService` 等均未改动） |
| 新代码是否引用 `Announcement` 实体 | 否，完全不涉及 |
| API 路径是否冲突 | 否，`/api/announcements` 与 `/api/notifications` 各自独立 |
| `lib/api.ts` 导出名是否冲突 | 否，`announcementApi` / `tournamentAnnouncementApi` / `notificationApi` 各自独立 |
| `CertificationGateFilter` 是否改动 | 否 |
| 既有全局通知接口是否仍可用 | ✅ 全部 200（`/api/announcements/latest`、`/api/announcements`、`/api/tournament-notifications/my`、`/api/admin/announcements`） |
| 交叉验证：发一条广播公告 | ✅ 出现在 `/api/announcements/latest`，**不出现**在 `/api/notifications` |

**概念层面：曾经撞名，已修。**

最初本模块的 UI 也叫"通知"，而既有广播系统自称"全部通知"/"最新通知"。后果是 dashboard 上
会同时出现两个"通知"——右侧栏的"最新通知"指向 `/announcements`（广播），模块网格里的"通知"
指向 `/notifications`（定向）。同一个词，两个目的地。

**处理**：把**本模块**的 UI 文案统一改为**「消息」**（NavBar 为"消息"，页面标题与 dashboard 卡片为"我的消息"），
既有广播通知的文案一个字没动。

> 另一个更彻底的方案是把**广播侧**改名为「公告」——它的路由本来就是 `/announcements`，
> 叫"通知"才是那个不一致的点。但那要动既有 UI，超出本模块范围，留给你决定。

---

## 10. 管理员下架帖子（第三轮追加）

- `GET /api/admin/recruitment-posts`：全部帖子（含已关闭），支持按类型/状态/关键词过滤。数据量小，在内存里过滤，避免为每种参数组合写一个派生查询
- `POST /api/admin/recruitment-posts/{id}/take-down`：置 `CLOSED` 并通知作者

**为什么用 `POST /take-down` 而不是 `DELETE`**：这里不做物理删除，用 DELETE 会误导调用方以为记录没了。

**为什么不做"恢复上架"**：下架后作者可能已发了一条新帖，此时恢复旧帖会直接违反"一队/一人同时只能有 1 条 OPEN 帖"的约束。要让恢复安全，得先处理冲突（关掉新的再恢复旧的），复杂度和收益不成正比。作者的下架帖内容并未丢失，重新发一条即可。

---

## 11. 入口补齐：个人主页与队伍页（第四轮追加）

### 11.1 问题

原先人才市场只有 NavBar 一个入口。后果是：**信息发出来了，但没人能从"人"或"队伍"这一侧看到它。**

- 别人点进你的个人主页 → 看不到你在找工作，也没法顺手邀请你
- 从队伍页进来的人 → 看不到这支队伍在招人（除非专门去人才市场里翻）

也就是说，人才市场变成了一个只能"从市场侧找信息"的单向入口，而正常的组队行为是从人/队伍出发的。

### 11.2 改动

| 位置 | 新增内容 |
|------|----------|
| `app/dashboard` | 模块网格新增"人才市场"卡片（**dashboard 不引入 NavBar**，用的是自己的 header，所以必须在这里单独给入口） |
| `app/profile/[id]` | "人才市场"区块：展示该用户当前 OPEN 的帖子 + 操作按钮；本人访问且无帖时给发布引导；本人额外给"我的申请与发布"入口 |
| `app/teams/[id]` | 队名旁"招募中"徽标 + "招募中"区块（展示队伍招募帖 + 直接申请） |
| `components/RecruitmentPostCard` | **新抽出的共用卡片** |

> 排查全站后确认：`admin` / `admin/tournaments/[id]` / `login` / `register` / 根页都不引入 NavBar，
> 但这几处要么是登录前页面、要么是管理后台（NavBar 自身在 `/admin` 下也返回 null），属于有意设计。
> **只有 `dashboard` 是真实缺口**——它既是登录后的落地页，又没有 NavBar。
> 同样的道理，"通知"也在 dashboard 上补了一张带未读角标的卡片。

### 11.3 两个设计决定

**① 抽出 `RecruitmentPostCard`，把"申请/邀请"的交互逻辑收进组件内部。**
人才市场列表页、个人主页、队伍页三处需要的卡片与按钮行为完全一致。若各写一份，三份确认文案与错误处理会各自漂移。现在三个页面只负责传 `post` / `myTeamId` / `onChanged`。

**② 个人主页的发布引导要判身份，否则会把人带进死胡同。**
`/recruit/new` 对"已在战队但不是队长"的用户是拒绝的（既不能替队伍招人，也不该再找工作）。所以主页的空状态文案分两种：

- `!user.team || user.team.role === "CAPTAIN"` → 显示"你还没有发布招募或求职信息" + 去发布
- 否则 → 显示"你已在战队中且不是队长，无法替队伍发布招募"，**不给链接**

### 11.4 后端支撑

复用 `GET /api/recruitment-posts`，新增两个查询参数：

- `userId`：个人主页用。因为"队长至多一条招募帖、未入队者至多一条求职帖"，结果必然是 0 或 1 条
- `teamId`：队伍页用

只返回 `OPEN` 帖子——所以帖子一旦关闭或过期，个人主页与队伍页上的展示会同步消失，不需要额外的状态同步逻辑。




---

## 8. 附带发现（不属于本模块，但会影响数据正确性）

> 状态：**8.1 已挂起，本轮不动**；8.2 已在本轮修复。

### 8.1 比赛录入的 IGN 匹配池会随队伍变大而变脏（挂起）

`frontend/components/GameRecordWizard.tsx:82-88` 的实现是：

```ts
teamApi.detail(team1Id).then(r => r.data.data?.members || []),
teamApi.detail(team2Id).then(r => r.data.data?.members || []),
```

即把**整队全部成员**拉下来，作为 OCR 识别出的 IGN → `userId` 的匹配池（`autoAssignTeams()`）。然后 `MatchService.recordGame()` 直接把前端传的 `userId` 落库。

队伍无人数上限后，8 人队的候选池是 8 个名字，OCR 认错更容易把战绩记到没上场的人头上。而 `CareerService` 是按 `userId` 永久累加统计的——**错了就是永久错的战绩**。

更基础的隐患：`User.gameId`（`backend/.../entity/User.java:29-30`）**没有唯一约束**，只有 `username` 和 `email` 是 unique。所以两个用户可以填同一个游戏 ID，匹配池里出现重名时无法区分。

**建议**：这两条与本模块解耦，单独评估。若要处理，优先级是给 `users.game_id` 加唯一约束（存量数据可能冲突，需先清洗）。

### 8.2 赛事报名目前无人数下限（本轮已修复）

`TournamentService.registerTeam()` 原本只校验：赛事处于报名阶段、调用者是队长、参赛队数未满、未重复报名，**没有校验队伍人数**。

配合决策 3（无上限），结果是 1 人队也能报名 5v5 赛事。已补上 `countByTeamId >= TeamService.ROSTER_SIZE`（5）。

### 8.3 无需处理的部分

- 历史战绩：`PlayerGameStat` 存 `userId` + `playerName` 快照，踢人/退队/换队都不会让既有战绩错乱。
- 队伍评分：`TeamService.toRatingVO()` 只取段位最高的 5 人计分，队伍人数再多也不影响评分口径。
- 数据库：JPA `ddl-auto: update` 自动建表，2 张新表无迁移脚本。
- 认证门槛：`CertificationGateFilter` 白名单**不要**加新接口路径，人才市场需认证后才能访问。
