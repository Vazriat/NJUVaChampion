# NJUVaChampion - 无畏契约赛事平台

## 快速启动

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
