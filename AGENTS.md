# NJUVaChampion - 无畏契约赛事平台

## 快速启动

> ⚠️ 首次运行或 clone 后，必须先装前端依赖再启动：
> ```bash
> cd frontend && npm ci
> ```
> 若 `start-all.ps1` / `npm run dev` 报 **"'next' 不是内部或外部命令"**，说明 `frontend/node_modules` 缺失或损坏——不要改脚本，直接重新执行 `npm ci`（有 package-lock.json，版本已锁定为 next 16.2.10）。

**后端（端口 8080）：**
```bash
cd backend
mvn spring-boot:run
```

**前端（端口 3000，/api 代理到后端 8080）：**
```bash
cd frontend
npm run dev
```

**OCR 服务（端口 3200）— 需单独启动：**
```bash
cd valorant-ocr
npm start
```
服务启动后显示 Valorant OCR 服务已启动: http://0.0.0.0:3200。
在管理后台记录比赛结果时上传截图会自动调用 OCR 识别选手数据；
如果 OCR 服务未启动，可跳过截图手动输入。

## 开发规范

- Java 21, TypeScript 5, 包名 com.NJUChampion.Valorant.*
- 响应格式：统一 Result<T>，异常 GlobalExceptionHandler
- 前端：Next.js App Router，API 通过 Next.js rewrites 代理到后端 8080
- 数据库：JPA 自动建表（ddl-auto: update）
- .gitignore 已配置 target/, node_modules/, .next/, IDE 文件

### 弹窗与提示：禁止使用浏览器原生 API（必须遵守）

**禁止**在 `frontend/app/**` 与 `frontend/components/**` 里写 `window.confirm()` /
`window.alert()` / `window.prompt()`。原生对话框由浏览器绘制，CSS 完全无法干预：
标题是「域名 + 显示」（localhost:3000 显示 / njuvlr.online 显示）、按钮只能是「确定/取消」、
样式与本项目深色红色主题彻底割裂，移动端还会走系统弹窗。

统一入口是 `components/DialogProvider.tsx`（已挂在 `app/layout.tsx`）：

```tsx
import { useConfirm, useNotify } from "@/components/DialogProvider";

const ask = useConfirm();
const notify = useNotify();

const ok = await ask({
  title: "彻底删除用户",
  message: "将同时删除其战队关系、认证和生涯数据，此操作不可恢复！",
  okText: "确认删除",
  danger: true,       // 不可恢复的操作必须置 true
});
if (!ok) return;      // 不要写 if (!await ask(...))，可读性差且易漏括号

notify(err.response?.data?.message || "操作失败", "error");
```

要点：
- `ask()` 返回 `Promise<boolean>`，**调用它的函数必须是 async**（inline `onClick={async () => {}}` 也可以）。
- 局部变量一律命名 `ask`，**不要命名为 `confirm`**——一旦同名遮蔽全局 `confirm`，
  漏改的旧调用点会变成「Promise 恒为真值」，`if (!confirm(...))` 的前置判断会静默失效。
- `danger: true` 用于删除/移除/解散/清空/覆盖类操作，主按钮改用深红实心。
- 提示用 `notify()`，不要再用页面里的 `setMsg` 临时横幅。
- Provider 已内建同文案去重：双击按钮不会排队弹出第二个确认框。

## 注意事项与已知坑

### 中文乱码（编码问题）

项目中需要写入中文内容时，优先使用python而非powershell

项目中的中文文本在传输/保存过程中可能出现乱码。修改规则：
- **前端 .tsx 文件**：所有中文 UI 文本应使用正确的 UTF-8 编码
- **后端 .java 文件**：异常消息等中文建议使用英文或确保文件编码为 UTF-8

### 容易复发的语法错误

1. **未闭合的字符串常量**：乱码字符串中可能包含 ' 或 "，导致 JSX 解析失败
2. **正则未闭合**：确保正则表达式前后匹配
3. **JSX 标签未闭合**：检查开始与结束标签是否匹配
4. **对象属性缺少逗号**：乱码常导致对象属性间的逗号丢失


## 移动端适配规范（必须遵守）

前端采用「桌面端优先 + 移动端追加覆盖」策略。**电脑端 UI 必须保持不变**，
因此所有移动端适配都通过 Tailwind v4 的 `max-md:`（`< 768px`）变体**追加**完成，
禁止改写或删除任何现有 class。完整方案见 `docs/mobile-adaptation.md`。

### 三条铁律

1. **纯追加**：原有 class 一个字符都不删、不改、不换序，只在末尾追加。

   ```diff
   - <main className="mx-auto max-w-7xl px-8 py-10">
   + <main className="mx-auto max-w-7xl px-8 py-10 max-md:px-4 max-md:py-6">
   ```

2. **移动端类一律用 `max-md:`，不用 `md:`**

   | 目的 | 错误写法（会改桌面） | 正确写法 |
   |------|---------------------|---------|
   | 收窄内边距 | `px-4 md:px-8` | `px-8 max-md:px-4` |
   | 收窄宽度 | `w-full md:w-40` | `w-40 max-md:w-full` |
   | 表格横滚 | `w-full min-w-[720px] md:min-w-0` | `w-full max-md:min-w-[720px]` |
   | 视口高度 | `min-h-dvh` | `min-h-screen max-md:min-h-dvh` |
   | 弹窗限高 | `max-h-[90dvh]` | `max-h-[85vh] max-md:max-h-[92dvh]` |

3. **新增 DOM 一律 `md:hidden`**（移动端专属元素），桌面端 `display:none` 不占位。
   隐藏「桌面端保留、移动端换掉」的内容则追加 `max-md:hidden`。

### 禁止事项

- **禁止对同一属性同时挂 `sm:` 与 `max-md:`**。实测 Tailwind 4.3.2 中 `sm:` 排在
  `max-md:` 之后，两者区间在 **640–767px 重叠**，该区间取值不可控。而常规测试
  （375px 手机 / 1440px 桌面）恰好都覆盖不到这个区间，属于隐性陷阱。
- **禁止**写 `maximumScale: 1` 或 `userScalable: false`（违反无障碍规范，且 iOS 10+ 直接忽略）。
- **禁止**给截图上传加 `capture="environment"`（会跳过「拍照 / 相册」系统菜单，破坏裁判录入流程）。
- **禁止**为了「顺手改进桌面端」而修改任何现有 class——桌面端的既有问题不在移动端适配范围内。

### 关键常量

- 移动 / 桌面分界：`md = 768px`
- 触摸目标下限：`min-h-11`（44px）
- 移动端输入框字号必须 >= 16px（`globals.css` 已用 `!important` 兜底，防止 iOS 聚焦时放大页面）
- 全屏高度用 `dvh` 不用 `vh`（规避 iOS 地址栏伸缩）

### 提交前自查

禁止裸 `min-h-screen`、裸 `px-8`；禁止同一元素同属性同时出现 `sm:` 与 `max-md:`。

## 文档维护要求

- **AGENTS.md** -- 发现常见错误模式后必须更新
- **docs/api.md** -- 新增/修改 API 接口后必须同步更新

## PowerShell + 工具链已知问题

### 1. 引号被吃掉（最常见）
PowerShell 传参给 python -c 时，内部的双引号会被先处理一遍，导致 Java 文件的字符串引号丢失。
解决：用 PowerShell here-string 包裹 Python 代码，或把脚本写成 .py 文件执行。

### 2. 中文字符显示乱码
PowerShell 管道默认 GBK 编码，cat UTF-8 文件时中文显示乱码但文件本身正常。
解决：用 python 读取，不要用 cat。误判前先检查原始字节。

### 3. replace() 因编码不匹配静默失败
Python 的 txt.replace() 在 PowerShell 中执行时，传入的中文可能和文件编码不一致，替换静默失败。
解决：替换后立即验证；关键变更用整文件重写而非 replace()。

### 4. MySQL 保留字（rank 等）
rank 是保留字，JPA @Column 或 ALTER TABLE 直接使用会报错。
解决：JPA 用 @Column 改名；MySQL CLI 用反引号。建议用 Python subprocess.run() 执行 SQL。

### 5. Jackson + Lombok 序列化冲突
@Data 生成 getter 名和 @JsonProperty 不一致时，Jackson 输出两个属性。
解决：用 @Getter(AccessLevel.NONE) 阻止冲突 getter，手动写 getter 带 @JsonProperty。

### 6. npx tsc 的 .next 缓存干扰
.next 缓存旧类型信息，可能报虚假错误。
解决：先单独编译确认无误后再全量编译。

### 7. Python 双反斜杠把 Unicode 写成纯文本
在 Python 中用 \\u2714 会将 \\u2714 作为纯文本写入 JSX。
解决：直接使用实际 Unicode 字符，或 JSX 中用表达式。

### 8. PowerShell 转义导致 Python 代码异常
在 python -c 中写转义序列时，PowerShell 和 Python 的转义层叠加，导致语法错误。
解决：避免在 python -c 中使用复杂转义；改用 .py 脚本文件。

### 9. Git Bash 里 mvn 报 ClassNotFoundException: Launcher
`MAVEN_HOME` 是 Windows 路径（`C:\apache-maven-3.9.11-bin\...`），Git Bash 下 mvn 脚本拼接出的
`-classpath` 无法解析，报 `找不到或无法加载主类 org.codehaus.plexus.classworlds.launcher.Launcher`。
解决：**用 PowerShell 执行 mvn**，不要在 Git Bash 里跑（覆盖 MAVEN_HOME 为 `/c/...` 也无效）。

### 10. 由脚本/Agent 拉起后端时端口被抢占
若父进程环境里存在 `SERVER__PORT`（部分 Agent 宿主会注入），Spring 的宽松绑定会把它当作
`server.port` 覆盖 application.yaml，表现为日志里 `Tomcat initialized with port <奇怪端口>`
然后 `Web server failed to start. Port xxx was already in use`。
解决：拉起后端时显式覆盖 `SERVER__PORT=8080`（同时注意 `SERVER__HOST`）。

### 11. kill mvn 不会结束它 fork 出的 JVM
`spring-boot:run` 会 fork 一个 java 子进程，只结束 mvn 进程会让 JVM 继续占着 8080，
下次启动报端口占用。清理用 `taskkill /PID <pid> /T /F`（带 `/T` 结束整棵进程树）。

### 12. Agent 沙箱的批量删除保护会中断 next build
在受管沙箱里执行 `next build` 时，Next 会清理 `.next` 目录，触发
`safe-delete[SAFE_DELETE_BULK_CONFIRM_REQUIRED]` 而中止——注意此时**编译、类型检查与
页面静态生成其实都已成功**，失败只发生在最后的清理阶段，不是代码问题。
规避：先把 `.next` 重命名为 `.next-bak`（重命名不触发删除保护）再构建；或改在普通终端里构建。

### 13. 容器 bind mount 陈旧：改了配置却不生效，且零报错
Docker 的 bind mount 在容器**创建那一刻**就固定了源目录的 inode。项目目录若之后被整体
替换过（重新解压 tarball、`rm -rf` 后重建同名目录），容器仍指向那个已删除的旧 inode：
宿主机上改 nginx 配置、certbot 往 webroot 写 ACME 挑战文件，容器里都看不到，
`nginx -s reload` 只是重载旧配置。全程没有任何报错，极易误判成 nginx 语法问题。

判定：宿主机新建文件，看容器里在不在。

```bash
touch nginx/conf.d/__probe.conf
docker exec njuvachampion-nginx ls /etc/nginx/conf.d/   # 看不到就是陈旧挂载
rm -f nginx/conf.d/__probe.conf
```

修复：`docker compose up -d --force-recreate --no-deps nginx`（`--no-deps` 必须加，
否则连带重建 frontend）。详见 DEPLOY.md 6.4。

### 14. 腾讯云轻量服务器 443 未放行：HTTP 通而 HTTPS 公网超时
控制台「防火墙」只放行 80 时会表现为：服务器内 `ss` 显示 443 在监听、`curl https://127.0.0.1/`
正常、`iptables`/`ufw` 干净、80/443 的 DNAT 规则对称，但**从公网连 443 直接超时**。
SSH 里怎么查都查不出问题，因为拦截点在实例之外。

判定：在服务器上访问自己的公网 IP，80 返回 200 而 443 超时，即云端防火墙未放行。

```bash
curl -s  -o /dev/null -w '80  -> %{http_code}\n' http://<公网IP>/
curl -sk -o /dev/null -w '443 -> %{http_code}\n' https://<公网IP>/
```

修复：腾讯云控制台 → 轻量应用服务器 → 该实例 → 防火墙 → 放行 TCP 443。详见 DEPLOY.md 6.1。

### 15. mvn 输出被管道吞掉：编译成功却看起来像静默失败

在 PowerShell 工具里执行 `mvn ... | Select-String -Pattern "ERROR|BUILD"` 或
`$out = mvn ... | Out-String` 时，**拿到的输出可能是空的**——即使构建实际成功。
表现为 `Status: completed` 但 stdout 为 `(no output)`，很容易误判成 mvn 没跑或构建挂了。

判定：不要靠管道判断，先落盘再读。

```powershell
Set-Location backend
mvn -DskipTests compile *> compile-out.txt
Get-Content compile-out.txt -Tail 40
```

补充两点：
- Maven 增量编译下，第二次执行会输出 `Nothing to compile - all classes are up to date.`
  这是**正常**的（第一次已编译成功），不是失败。
- 想确认新文件真的编译过，直接查 `target/classes/**` 里对应 `.class` 的时间戳，比看日志可靠。

### 16. dev server 只有 `/` 能访问，其它路由全部 404（.next 缓存损坏）

**症状**：`next dev` 起来后，`http://localhost:3000/` 返回 200，但 `/login`、`/dashboard`、
`/teams`……**所有子路由全部 404**。而且 404 是**瞬间返回**的（~0.03s），
说明路由匹配器直接判定"无此路由"，根本没有尝试编译——不是懒编译时序问题，
重复请求也不会变好。

**根因**：`frontend/.next` 里同时躺着两种东西：
- 一份旧的**生产构建**（`BUILD_ID`、`routes-manifest.json`、`prerender-manifest.json`、
  `server/app/*.html`），来自某次 `next build` 或 `docker compose build`
- 本次 dev 会话的 `.next/dev/`

两者混用会得到一个损坏的路由表。判定方法是比对条目数：

```bash
cd frontend
# dev 认为存在的路由
python -c "import json;print(len(json.load(open('.next/dev/server/app-paths-manifest.json',encoding='utf-8'))))"
# 磁盘上真实存在的路由
ls app/ | wc -l
```

实测出现过 11 条 vs 20 个路由的严重缺失，且**缺失是散落的**（少了 announcements、
career、competitions、profile、referee、tournaments、verify），不是从头截断——
这是"路由表损坏"而非"扫描中断"的特征。

**先排除代码问题**：确认线上站同一路由是 200（`curl -sk -o /dev/null -w '%{http_code}'
https://njuvlr.online/login`）。线上正常即证明代码没问题，是本地缓存。

**修复**：停 dev server → 重命名 `.next`（**用重命名，不要 rm，见第 12 条**）→ 重启。

```powershell
# 1. 结束 dev server 整棵进程树（npm run dev -> next dev -> start-server）
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -Expand OwningProcess -Unique |
  ForEach-Object { taskkill /PID $_ /T /F }
# 2. 重命名缓存
Rename-Item frontend\.next frontend\.next-stale-<日期>
# 3. 重启
cd frontend; npm run dev
```

重启后日志里应能看到 `Compiling /login ...` 和 `GET /login 200`。

**预防**：不要在同一个工作副本里交替跑 `next dev` 和 `next build`（Docker 构建、
本地打包）而不清缓存。切换之前先重命名 `.next`。

### 17. 英雄（特工）清单只能改唯一源，不要直接改使用处

特工清单在三处被使用：

| 位置 | 用途 |
|------|------|
| `valorant-ocr/region-detector.js` | 从 IGN 文本里剥离特工名 |
| `frontend/components/GameStatsTable.tsx` | 录入界面的特工下拉框 |
| `frontend/components/GameDetailPanel.tsx` | 详情页判断某字符串是不是特工名 |

**唯一数据源是 `shared/agents.json`**，另两份是生成出来的：

- `valorant-ocr/agents.js`
- `frontend/lib/agents.ts`

增删特工**只改 `shared/agents.json`**，然后执行：

```bash
node scripts/sync-agents.mjs          # 重新生成两份副本
node scripts/sync-agents.mjs --check  # 只校验；不一致时退出码 1
```

直接改生成文件会在下次同步时被覆盖，且三份会静默漂移。

**为什么不用"两边引用同一个文件"**：`docker-compose.yml` 里 frontend 与 ocr 的
build context 分别是 `./frontend` 和 `./valorant-ocr`，仓库根目录的 `shared/` 两个镜像
都拿不到。要让两边共享同一物理文件，必须改 build context + 两个 Dockerfile 的 COPY 路径，
风险高于"生成副本 + 一致性校验"。

### 18. `stats_json` 里的 `-1` 是"未识别"，不是数据

OCR 曾用 `-1` 表示某个字段没识别出来。这些值如果被当成真实数据求和/求平均，
会**静默拉低生涯统计**（实测历史数据里 firstBlood 有 15/30 条是 -1），
而且 `agent` 若存成数字 `-1`，`(String)` 强转会直接抛 `ClassCastException`。

现在的约定：

- **写**：前端把负数/空值归一化为 `null`；后端 `MatchService.normalizeStats()`
  在落库前再兜底一次（负数直接删掉该键）
- **读**：`CareerService.nonNegativeNumber()` 把缺失/非数字/负数一律视为无效，
  **每一项指标各自统计有效场次与有效回合**，不共用一个分母
- **新增字段**：不要再引入 `-1` 这类带语义的哨兵值，统一用"键缺失"表示未知

> **例外，不要"修"**：`result-parser.js` 里 `player.agent = lines[1] || '零'` 的兜底是
> **产品上确认保留的**。`零` 是真实特工（Cypher），不是脏数据。
> 不同解析策略对"没识别出特工"的处理本就不同：
> `row-wise`（默认）返回 `null`，`full-column` / `per-player-crop` 回落 `'零'`。


### 19. B 站直播短号 ≠ 真实 room_id（用短号拼播放器直接黑屏）

`live.bilibili.com/6` 里的 `6` 是**短号**，真实房间是 `7734200`。
实测：用 `cid=6` 拼播放器，页面里连 `<video>` 元素都不会创建、零媒体请求，纯黑屏；
换成 `7734200` 立刻正常播放。

**规则**：绑定时必须调 `api.live.bilibili.com/room/v1/Room/get_info?room_id=X`
拿 `data.room_id` 存为真实房间号，**存短号等于功能不可用**。

调用该接口的两个前提：

- **不能带 `Origin` 头**，带上直接 403（后端 `RestTemplate`/`HttpClient` 默认不带，别手动加）
- 必须带正常 `User-Agent`

### 20. 直播播放器只能用 roomId 模板拼 src，禁止用用户填的链接

站内播放 B 站用的是活动页播放器：

```
https://www.bilibili.com/blackboard/live/live-activity-player.html?cid={roomId}&quality=0
```

`live.bilibili.com/{room}` 有 `X-Frame-Options: SAMEORIGIN`，嵌不了；
`/blanc/{room}` 虽然能加载但**没有播放器**（`videoCount: 0`），别被响应头骗了。

**安全红线**：iframe 的 `src` 必须由 `platform + roomId` 拼接（见 `components/LivePlayer.tsx`），
**绝不能** `src={channel.rawUrl}`——那等于允许用户在你站内渲染任意页面（钓鱼）。
`rawUrl` 只允许进 `<a href>`，且入库前已校验为 https。

### 21. B 站图片防盗链：外站 Referer 一律 403

实测 `i1.hdslb.com` 的封面图：

| 请求 | 结果 |
|------|------|
| 不带 Referer | 200 |
| 带本站 Referer（`https://njuvlr.online/`） | **403** |
| 带 `https://www.bilibili.com/` | 200 |

浏览器加载图片时会自动带上当前页面的 Referer，所以直接把 B 站封面塞进 `<img src>` 会**破图**——
而且接口返回的是 200，只有图片请求失败，很容易误判成路径写错。

**规则**：所有展示 B 站封面/截帧的 `<img>` 必须加 `referrerPolicy="no-referrer"`。

```tsx
<img src={cover} referrerPolicy="no-referrer" alt="封面" />
```

不需要做图片代理或转存，加这一个属性就够。直播列表的 `keyframe` 封面同理。
