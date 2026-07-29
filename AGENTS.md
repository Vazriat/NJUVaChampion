# NJUVaChampion - 无畏契约赛事平台

## 快速启动

**后端（端口 8080）：**
```bash
cd Valorant
mvn spring-boot:run
```

**前端（端口 3000，/api 代理到后端 8080）：**
```bash
cd nvc
npm run dev
```

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
