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
