# 直播与回放模块 · 设计与开发方案

> 状态：设计定稿，待实施
> 最后更新：2026-10-31

## 1. 背景与已定决策

赛事的比赛需要直播与回放能力。裁判在现场开播，观众在站内观看正在进行的比赛；赛后补上回放链接。

经过技术验证与方案对比，确定以下前提：

| 决策 | 结论 | 依据 |
|------|------|------|
| 直播推流方式 | 裁判自己在 B 站开播，本站只做聚合与嵌入 | 自建推流受限于 2C4G 轻量与 3–6 Mbps 出带宽，一路 720p 只能支撑 1–3 人观看 |
| 站内播放 | 仅 B 站，用官方活动页播放器 iframe 嵌入 | `www.bilibili.com/blackboard/live/live-activity-player.html?cid={roomId}` 实测无 X-Frame-Options，1080p 正常播放，无广告与弹幕窗 |
| 其他平台（虎牙/斗鱼/抖音） | 不做站内播放，只做跳转卡片 | 这些平台没有等价的公开嵌入页；号角等同类站点也只嵌 B 站 |
| 直播链接归属 | 绑定到裁判账号，一次配置永久复用 | 避免每场重复填写 |
| 回放链接归属 | **独立于直播记录**，任何场次都可以有回放 | 没开直播的场次也需要回放；重赛不覆盖历史 |
| 重赛 | 允许对已完结的比赛重新开播 | 系统内比赛状态没有"退回"机制，硬拦会导致重赛无法直播 |
| 比赛时间 | 不引入 `scheduledAt` | 系统没有排期概念，直播起止由裁判点击自证 |

## 2. 范围

### 做

- 裁判绑定直播间（账号级，一次）
- 比赛开播 / 结束直播
- 比赛回放链接（多段，独立于直播）
- `/live` 页：正在直播 + 主播列表
- 比赛详情页：B 站播放器 / 其他平台跳转卡片 / 回放链接
- 管理端：隐藏频道、强制结束直播、删除回放

### 不做（明确划出）

- 自建推流、云直播、转码
- 赛程排期（`scheduledAt`）
- 比赛"进行中"状态（`TournamentMatch` 保持只有 PENDING / COMPLETED）
- 裁判赛前指派
- 回放站内播放（只做外链）
- 主播实时在线状态轮询（会打爆 B 站接口）
- 开播时临时更换房间号（换号去设置页改）

## 3. 数据模型

三张新表，`TournamentMatch` 一行不改。

```sql
-- 裁判的直播间，一个账号一条
CREATE TABLE referee_channel (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  platform    VARCHAR(20)  NOT NULL,              -- BILIBILI | HUYA | DOUYU | DOUYIN | OTHER
  room_id     VARCHAR(32)  NULL,                  -- 仅 B 站，存**真实** room_id
  raw_url     VARCHAR(500) NOT NULL,              -- 原始链接，跳转用
  status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | HIDDEN
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  UNIQUE KEY uk_channel_user (user_id)
);

-- 一次直播一条
CREATE TABLE live_stream (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_id      BIGINT      NOT NULL,
  tournament_id BIGINT      NOT NULL,
  referee_id    BIGINT      NOT NULL,
  channel_id    BIGINT      NULL,                 -- 频道被删后置空，不影响历史
  platform      VARCHAR(20) NOT NULL,             -- 快照
  room_id       VARCHAR(32) NULL,                 -- 快照
  status        VARCHAR(20) NOT NULL,             -- LIVE | ENDED
  started_at    DATETIME    NOT NULL,
  ended_at      DATETIME    NULL,
  active_key    BIGINT      NULL,                 -- LIVE 时 = match_id，否则 NULL
  UNIQUE KEY uk_live_active (active_key),
  KEY idx_live_match (match_id),
  KEY idx_live_referee (referee_id, status),
  KEY idx_live_status (status, started_at)
);

-- 回放链接，一场可多条，与直播无关
CREATE TABLE match_replay (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_id    BIGINT       NOT NULL,
  url         VARCHAR(500) NOT NULL,
  title       VARCHAR(100) NULL,
  uploaded_by BIGINT       NOT NULL,
  created_at  DATETIME     NOT NULL,
  KEY idx_replay_match (match_id, created_at)
);
```

### 设计说明

**`active_key` 唯一索引**：MySQL 唯一索引允许多个 `NULL`，所以 `LIVE` 时写 `match_id`、结束后置 `NULL`，即可保证"一场同时只有一路直播"，同时保留任意多条历史记录。

**`platform` / `room_id` 冗余到 `live_stream`**：裁判以后改了频道，历史直播记录不能跟着变。这是快照，不是外键同步。

**回放不挂 `live_stream`**：没开直播的场次也要能填回放，且重赛时不能覆盖上一段回放。所以独立成表，一场可多条，页面取最新一条。

## 4. 后端

### 4.1 新增类

```
entity/RefereeChannel.java
entity/LiveStream.java
entity/MatchReplay.java
repository/RefereeChannelRepository.java
repository/LiveStreamRepository.java
repository/MatchReplayRepository.java
service/LiveService.java              -- 频道 + 直播 + 回放，一个 service
service/LiveUrlResolver.java          -- 链接解析，独立单元测试
controller/LiveController.java        -- 公开只读
controller/RefereeLiveController.java -- 裁判端
controller/AdminLiveController.java   -- 管理端
dto/ ...                              -- 请求/响应体
```

不拆三个 service。三者耦合很紧（开播要读频道，回放要查比赛），拆开只会增加跳转。

### 4.2 接口

统一返回 `Result<T>`。路径前缀 `/api/live`、`/api/referee/live`、`/api/admin/live`。

#### 公开只读

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/live/streams?status=LIVE&page=1&size=20` | 正在直播列表（按 `started_at` 倒序） |
| GET | `/api/live/streams?matchId={id}` | 某场的直播历史 |
| GET | `/api/live/replays?matchId={id}` | 某场回放（倒序，最多 20 条） |
| GET | `/api/live/channels?page=1&size=20` | 主播列表（`status=ACTIVE`，按 `updated_at` 倒序） |

访问门槛与 `/api/tournaments/**` 一致——需要登录，未通过身份认证的用户同样被 `CertificationGateFilter` 拦截。**不要**把 `/api/live/` 加进白名单。

#### 裁判端（需 `isReferee`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/referee/live/channel` | 我的频道，未绑定返回 `data: null` |
| PUT | `/api/referee/live/channel` | 绑定/更新，body `{ url }`，内部解析 |
| DELETE | `/api/referee/live/channel` | 解绑（有 LIVE 时拒绝） |
| GET | `/api/referee/live/preview?matchId=` | 开播确认框数据（见下） |
| POST | `/api/referee/live/streams` | 开播，body `{ matchId }` |
| PATCH | `/api/referee/live/streams/{id}/end` | 结束直播 |
| POST | `/api/referee/live/replays` | 新增回放，body `{ matchId, url, title? }` |
| DELETE | `/api/referee/live/replays/{id}` | 删除自己上传的回放 |

`preview` 返回：

```json
{
  "channel": { "platform": "BILIBILI", "roomId": "22908869", "rawUrl": "https://live.bilibili.com/22908869" },
  "roomTitle": "【直播】UR vs WSIG VCTCN晋升赛",
  "roomLive": true,
  "matchName": "UR vs WSIG",
  "warnings": ["该场已有一场直播记录，确认是重赛？"]
}
```

`roomTitle` / `roomLive` 来自 B 站 `get_info`，缓存 30 秒。接口失败时降级为 `null`，不影响开播。

#### 管理端（ADMIN）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/live/channels?status=` | 频道列表 |
| PATCH | `/api/admin/live/channels/{id}` | 改 `status`（ACTIVE / HIDDEN） |
| PATCH | `/api/admin/live/streams/{id}/end` | 强制结束 |
| DELETE | `/api/admin/live/replays/{id}` | 删除回放 |

### 4.3 链接解析器

`LiveUrlResolver.resolve(String input)` → `{ platform, roomId, normalizedUrl }`，失败抛 `IllegalArgumentException`。

**B 站（唯一需要精确解析的平台）**

1. 从输入里提取 `live.bilibili.com/(\d+)`
2. 若是 `b23.tv/xxxx` 短链：HTTP 跟随 302，**最多 3 跳、5 秒超时、只允许 `b23.tv` / `bilibili.com` 域名**，拿到最终地址再解析
3. 调 `https://api.live.bilibili.com/room/v1/Room/get_info?room_id={x}`
   - 必须**不带 `Origin` 头**（实测带 Origin 直接 403），带正常 UA
   - `code != 0` → 房间不存在，报错
   - 取 `data.room_id` 作为**真实房间号**
4. 存 `roomId = 真实 room_id`，`normalizedUrl = https://live.bilibili.com/{真实room_id}`

> **短号必须转换。** 实测 `room_id=6` 的真实房间是 `7734200`；用 `cid=6` 拼 iframe 时 `<video>` 元素都不存在、零媒体请求，纯黑屏；用 `7734200` 立即 720p 播放。这不是优化，是功能能否用的前提。

**其他平台**

只识别域名（`huya.com` / `douyu.com` / `douyin.com` / `v.douyin.com`），`roomId` 尽力提取可为空，`normalizedUrl` 原样保存。不调用任何平台接口。

**识别失败**

抛错，由前端提示"无法识别该链接，支持的平台：B站 / 虎牙 / 斗鱼 / 抖音"。不落库。

### 4.4 校验矩阵

| 操作 | 校验 | 失败响应 |
|------|------|---------|
| 绑定频道 | 用户 `isReferee` | 403 "仅裁判可绑定直播间" |
| 绑定频道 | URL 可解析、协议为 https | 400 "无法识别该链接" |
| 开播 | `isReferee` | 403 |
| 开播 | 已绑定频道 | 400 "请先在设置页绑定直播间" |
| 开播 | `tournament.status == PROGRESSION` | 400 "赛事不在进行中，无法开播" |
| 开播 | 该场无 `LIVE` 记录（`active_key` 唯一索引兜底） | 400 "该场正在直播中" |
| 开播 | 本人无其他 `LIVE` 记录 | 400 "你还有一场在直播中，请先结束" |
| 开播 | **不检查 `match.status`** | — |
| 结束 | 本人或 ADMIN | 403 |
| 结束 | 已 ENDED 时幂等返回成功 | — |
| 加回放 | 本人是裁判或 ADMIN | 403 |
| 加回放 | URL 协议为 https | 400 |
| 加回放 | **不限制比赛状态** | — |
| 解绑频道 | 无 `LIVE` 记录 | 400 "正在直播中，请先结束" |

### 4.5 与现有系统的耦合点

只有两处，其余一行不改。

**① `MatchService.finalizeMatch()` 末尾**

```java
// 比赛完结，兜底关闭该场直播
liveService.endByMatch(matchId);
```

`LiveService` 只依赖 `MatchRepository` / `TournamentRepository`，不依赖 `MatchService`，无循环依赖。

**② `TournamentService` 赛事置为 `ENDED` 时**

关闭该赛事下所有 `LIVE` 记录，避免赛事结束后页面还挂着"正在直播"。

**明确不改**：`ResultSubmissionService`、`TournamentMatch`、赛程推进逻辑、重申报流程。直播与回放是"历史事实"，比赛结果是"当前判定"，两者互不影响。

## 5. 前端

### 5.1 新增

| 文件 | 说明 |
|------|------|
| `app/live/page.tsx` | 两块：正在直播（B 站直接嵌播放器）+ 主播列表（分页） |
| `components/LivePlayer.tsx` | 按 `platform` 分支：B 站 iframe / 其他平台跳转卡片 |
| `components/ReplayLinks.tsx` | 比赛页回放区块 |

### 5.2 修改

| 文件 | 改动 |
|------|------|
| `app/settings/page.tsx` | 加「我的直播间」区块（仅 `referee === true` 可见），显示已绑定的平台+房间号，支持修改/解绑 |
| `app/tournaments/[id]/page.tsx` | 比赛弹窗加：`开始直播` / `直播中 · 已播 23 分钟` + `结束直播`；弹窗底部加回放区块 |
| `app/referee/page.tsx` | 加「可开播的比赛」列表：`tournament.status = PROGRESSION` 且该场无 LIVE |
| `components/NavBar.tsx` | 加「直播」入口 |

### 5.3 播放器写法（安全关键）

**iframe 的 `src` 必须由 `platform + roomId` 模板拼死，绝不能直接使用 `rawUrl`。**

```tsx
// 正确
{platform === "BILIBILI" && roomId && (
  <iframe
    src={`https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${roomId}&quality=0`}
    className="aspect-video w-full rounded-xl border border-zinc-800"
    frameBorder={0}
    allowFullScreen
    allow="autoplay; encrypted-media"
  />
)}
```

若 `src={channel.rawUrl}`，裁判（或盗号者）可填任意站点地址，在站内渲染仿冒登录页——标准钓鱼漏洞。

`rawUrl` 只允许进 `<a href>`，且保存时已校验 https。

### 5.4 移动端

遵守 `AGENTS.md` 的「纯追加」规则：

- 播放器容器 `aspect-video w-full`，不写死高度
- 弹窗底部块 `max-md:p-4`、按钮 `max-md:min-h-11`
- 不新增 `sm:` 与 `max-md:` 同属性并存的写法

## 6. 安全清单

1. **iframe 只认 roomId**，URL 模板拼接（见 5.3）
2. **`rawUrl` 只进 `href`**，入库前校验协议为 https，拒绝 `javascript:` / `data:`
3. **短链 SSRF 防护**：白名单域名 + 最多 3 跳 + 5 秒超时 + 不跟随到内网地址
4. **接口限流**：开播/结束每用户每分钟最多 5 次（简单内存计数即可）
5. **频道 `status=HIDDEN`** 时，主播列表与播放器均不返回
6. **回放删除**只允许上传者本人或 ADMIN
7. B 站 `get_info` 调用**不带 `Origin` 头**，否则 403

## 7. 兜底与容错

| 场景 | 处理 |
|------|------|
| 播放器加载失败（跨域，抓不到 `onerror`） | 播放器下方固定「在 B 站打开」链接，始终可用 |
| 裁判忘了点结束 | 懒过期：查询前把 `started_at` 超过 **6 小时**的 `LIVE` 批量置 `ENDED`（不用定时任务） |
| B 站 API 不可用 | 开播仍允许，确认框不显示房间标题，降级提示"未能获取房间信息" |
| 直播列表里全是僵尸 | 由 6 小时过期兜住，同时管理端可强制结束 |
| 频道被删但历史直播还在 | `live_stream.channel_id` 置空，`platform` / `room_id` 快照仍在 |

## 8. 实施顺序

| 阶段 | 内容 | 预计 |
|------|------|------|
| 一 | 三张表 + Repository + `LiveUrlResolver` + 单元测试（短号 / 短链 / 非法输入） | 1 天 |
| 二 | 频道接口 + 设置页「我的直播间」 | 1 天 |
| 三 | `LiveStream` 开播/结束 + `preview` + 比赛弹窗播放器 | 1.5 天 |
| 四 | 回放接口 + 比赛页回放区块 | 0.5 天 |
| 五 | `/live` 页（正在直播 + 主播列表 + 分页） | 1 天 |
| 六 | 管理端 + `docs/api.md` + `AGENTS.md` 更新 | 0.5 天 |

合计约 5.5 个工作日。

## 9. 验收清单

**解析**
1. B 站短号 `live.bilibili.com/6` → 存 `7734200` → 播放器能出画面
2. B 站完整链接能识别；只填纯房间号会被拒绝并提示粘贴完整链接
3. `b23.tv` 短链能解析到直播间
4. 虎牙 / 斗鱼链接 → 识别为对应平台，无播放器，卡片可跳转
5. 乱码 / 非支持站点 → 明确报错，不落库

**开播**
6. 未绑定频道点开播 → 引导去设置页
7. 赛事未开始 → 拒绝
8. 同一场开播两次 → 第二次被拒
9. 同一裁判同时开两场 → 被拒
10. 已完结的比赛（重赛）→ 能开播，确认框多一行提示
11. 比赛审核通过 → 直播自动 `ENDED`
12. 6 小时未结束 → 自动 `ENDED`，该场可重新开播

**回放**
13. 没开过直播的场次也能加回放
14. 重赛后两段回放都在，比赛页显示最新一条
15. 非 https 链接被拒

**展示**
16. `/live` 页正在直播区能播放
17. 主播列表分页正常，`HIDDEN` 频道不出现
18. 移动端 375px 播放器不溢出、按钮不小于 44px

## 10. 已知风险

| 风险 | 影响 | 应对 |
|------|------|------|
| B 站活动页播放器没有公开 SLA | 哪天改版就失效 | URL 模板集中在一处，改一行即可；数据里存 roomId 不存 URL，不丢数据 |
| 播放器带「bilibili 直播」水印 | 无法去除 | 接受 |
| 画质由 B 站控制（`quality=0`） | 未登录可能被压到 480p | 接受 |
| 重申报改胜者会覆盖已开赛的后续轮次 | 对阵数据不一致（**既有问题**） | 本次不改；在管理员审核重申报的弹窗加警告文案 |
| 裁判直播内容不可控 | 站点为他人内容背书 | 频道可 `HIDDEN`、直播可强制结束、回放可删 |
