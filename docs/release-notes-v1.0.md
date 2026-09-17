# NJUVaChampion v1.0 版本公告

> **发布状态：** 正式版（域名 + HTTPS 全站启用）
> **发布日期：** 2026 年 9 月 17 日
> **访问地址：** <https://njuvlr.online>
> **分支 / 标签：** `hyl` / `v1.0`

---

## 一句话公告（可直接发群）

**无畏契约赛事平台 v1.0 正式版上线了！** 访问地址从 IP 换成 **https://njuvlr.online**，全站 HTTPS，`www.` 和裸 IP 都会自动跳转到主域名。本次完成手机浏览器专项适配，手机上可以直接用。覆盖用户注册/认证、战队管理、杯赛与联赛对阵、赛果录入（结算截图自动 OCR 识别）、生涯数据、公告通知等功能。欢迎使用并反馈问题。

---

## v1.0 相对 v0 的变化

### 1. 域名与 HTTPS 上线

- 主域名 `njuvlr.online`，`www.njuvlr.online` 与裸 IP 的 HTTP 请求全部 301 到 HTTPS
- Let's Encrypt 证书，一张证书覆盖两个域名，有效期 90 天
- 自动续期：每日 4 点、16 点各检查一次，续期后自动 reload nginx
- 裸 IP 访问方式保留，方便内网/应急排查

### 2. 手机端专项适配

导航、列表、表单、弹窗（15+ 处）、表格（8 处，移动端横向滚动）、对阵图、选手数据表、赛果录入向导、认证中心、管理后台全部适配；触摸目标不小于 44px，输入框字号 ≥16px（避免 iOS 聚焦时放大页面），全屏高度改用 `dvh` 规避 iOS 地址栏伸缩。

**桌面端零影响**——所有改动以 `max-md:` 变体纯追加完成，未删除或改写任何既有 class。完整方案与逐项改动清单见 `docs/mobile-adaptation.md`。

### 3. 修复：每日备份曾静默失败 23 天

备份脚本缺可执行位，cron 每天报 `Permission denied` 而无人察觉，最后一份有效备份停留在 8 月 25 日，且当时那份上传目录备份是个 87 字节的空包。已修复并加固：

- 补上可执行位，并写进 git 索引（`100755`）
- 定时任务改用 `bash <绝对路径>` 调用，不再依赖权限位
- 失败时显式往日志写 `[backup] FAILED at <时间>`，不再无声无息

### 4. 修复：容器 bind mount 陈旧导致改配置不生效

项目目录在容器启动后被整体替换过，Docker 的 bind mount 仍钉在已删除的旧 inode 上——宿主机改 nginx 配置、certbot 写 ACME 挑战文件，容器里都读不到，`nginx -s reload` 只是重载旧配置，全程零报错。已重建容器修复，判定与修复方法写入 `DEPLOY.md` 6.4 与 `AGENTS.md` 第 13 条。

### 5. 修复：含数据库密码的 `.env.bak` 有被提交的风险

`.gitignore` 原先只列了 5 个具体的 `.env.*` 文件名，漏掉了 `.env.bak`。已改为 `.env*` 一次性收口并反向放行 `.env.example`；服务器上那份 `~/.env-archive/env.bak-20260826`（600 权限）已移出仓库目录。

### 6. 其他工程加固

- 新增 `.gitattributes`，锁定 `sh`/`conf`/`Dockerfile`/`yml` 为 LF（CRLF 会让 Linux 上的 shebang 报 `bad interpreter`）
- 新增 `scripts/renew-cert.sh`：`certbot renew` 幂等，跑完统一 `nginx -t` + reload，避免「证书续了但 nginx 仍在用旧证书」
- 证书使用权威镜像源拉取（腾讯云访问 Docker Hub 会超时，`daemon.json` 已配 `mirror.ccs.tencentyun.com`）

---

## 功能清单

### 1. 账号与认证
- 注册 / 登录（JWT 无状态认证，24h 有效）
- 在校生（STUDENT）、校友（ALUMNI）身份认证；段位（RANK）与裁判（REFEREE）认证
- 身份认证门槛：未认证用户引导前往认证页，管理员豁免
- 个人资料：用户名、邮箱、游戏 ID、密码、公开信息展示

### 2. 战队
- 创建 / 加入 / 退出战队，队长与成员角色
- 战队详情（成员列表、公开档案）

### 3. 赛事
- 赛事类型：杯赛（CUP）/ 联赛（LEAGUE）
- 赛制：单败、双败、瑞士轮；联赛单循环 / 双循环
- 赛事状态流转：筹备 → 报名 → 进行 → 结束
- 蛇形种子、自动晋级、冠军自动产生
- 报名活动与分组子赛事、赛事公告

### 4. 赛果录入（核心亮点）
- BO1/BO3 等多局制，逐局记录比分与选手数据
- **结算截图自动 OCR**：上传截图即自动识别 10 名选手的 ID、英雄、ACS、KDA、首杀（离线 PaddleOCR，无第三方 API 费用）
- 选手与战队队员自动匹配（IGN 自动归类）
- 赛果申报与管理员审核：裁判/队长提交，管理员复核后生效

### 5. 数据与信息
- 选手生涯数据：ACS、KD、KPR、首杀率、存活率、回合助攻等
- 赛事选手数据表、积分榜、瑞士轮积分
- 赛事通知、平台公告、首屏横幅
- 用户大厅 / 全局搜索 / 个人主页

---

## 技术架构（面向开发）

| 组件 | 技术 | 说明 |
|---|---|---|
| 前端 | Next.js 16 + React 19 + Tailwind CSS v4 | App Router，`/api`、`/uploads`、`/ocr` 服务端代理；桌面优先 + `max-md:` 追加的响应式策略 |
| 后端 | Java 21 + Spring Boot 3.4（JPA + Security + JWT） | 统一 `Result<T>` 响应 / 全局异常处理 |
| 数据库 | MySQL 8（utf8mb4） | 18 张表，JPA 自动建表 |
| OCR | PaddleOCR 2.10.0 + paddlepaddle 2.6.2（Python 3.10） | 离线识别，宿主机 conda 环境挂载 |
| 反向代理 | nginx 1.27 | 80 仅放行 ACME 挑战，其余 301 到 HTTPS；443 分主域名站与 www 跳转 |
| 部署 | Docker Compose（nginx / frontend / backend / ocr / mysql 五容器） | 仅 22 / 80 / 443 对公网开放 |
| 服务器 | 腾讯云轻量 2C4G + Ubuntu 22.04 + 2G swap | 每日 3:30 备份数据库与上传目录，保留 7 天 |

## 发布信息

- Git 标签：`v1.0`（分支 `hyl`）
- 部署文档：`DEPLOY.md`（第 6 节含完整 HTTPS 流程与本次踩坑记录）
- 移动端方案：`docs/mobile-adaptation.md`
- 接口文档：`docs/api.md`
- 备份脚本：`scripts/backup.sh` —— cron 每日 3:30 执行，日志 `~/backups/backup.log`
- 续期脚本：`scripts/renew-cert.sh` —— cron 每日 4:00、16:00 执行，日志 `~/logs/renew-cert.log`

---

## 注意事项 / 已知限制

1. **管理员账号** `admin` 初始密码**线下发放**，请登录后立即修改，勿公开展示
2. **OCR 依赖宿主机 conda 环境**（`DEPLOY.md` 第 2.5 节含一次性准备步骤）；更换服务器需按文档重装
3. **数据库使用 JPA `ddl-auto: update`**：常规改版无需手工迁移；重大结构变更仍需人工确认
4. **证书到期通知邮箱未登记**。证书本身会自动续期，但收不到 Let's Encrypt 的到期/吊销预警。补登记：
   ```bash
   docker run --rm -v /home/ubuntu/njuvachampion/certbot/conf:/etc/letsencrypt \
     certbot/certbot update_account -m 你的邮箱 --no-eff-email
   ```
5. **HSTS 未开启**（有意为之）。开启后一旦证书出问题浏览器会强制拦截，属单向操作；确认 HTTPS 稳定运行后再评估
6. **数据备份目录**：服务器 `~/backups/`（建议定期下载一份到本地/网盘双重保管）；证书归档 `~/env-archive/`
7. **改 nginx 配置后不生效**时，先排查容器 bind mount 是否陈旧，见 `DEPLOY.md` 6.4

---

## 后续规划

- [x] 域名解析 + HTTPS（ICP 备案后）
- [x] 手机端适配（导航、对阵图、赛果录入）
- [ ] 管理后台权限细化与操作审计
- [ ] 赛果回放 / 申诉流程完善
- [ ] 数据看板与导出
- [ ] 证书到期通知邮箱登记；HSTS 评估
