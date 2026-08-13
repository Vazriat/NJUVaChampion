# NJUVaChampion - 无畏契约赛事平台

一个面向《无畏契约》(Valorant) 的校园电竞赛事管理平台,支持单败淘汰、双败淘汰、瑞士轮、循环赛等多种赛制。

---

## 数据库配置

### 数据库信息

| 项目 | 值 |
|------|-----|
| **数据库类型** | MySQL 8 |
| **数据库名** | `njuvachampion` |
| **连接地址** | `jdbc:mysql://127.0.0.1:3306/njuvachampion?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowMultiQueries=true` |
| **用户名** | `root` |
| **密码** | `***REMOVED***` |
| **建表方式** | JPA `ddl-auto: update` (启动时自动建表) |

### 创建数据库

在 MySQL 中执行以下语句创建数据库:

```sql
CREATE DATABASE IF NOT EXISTS njuvachampion
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

---

## 备份迁移 SQL

```bash
mysqldump -u root -p --no-data njuvachampion > njuvachampion_schema.sql
```

---

## 快速启动

### 前提条件

- JDK 21 (后端)
- Node.js 20+ (前端)
- MySQL 8 (数据库)
- Maven (后端构建)

### 1. 创建数据库

```sql
CREATE DATABASE IF NOT EXISTS njuvachampion
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

### 2. 启动后端 (端口 8080)

```bash
cd Valorant
mvn spring-boot:run
```

> JPA 启动时自动建表,并创建管理员账号 `admin / admin123`。

### 3. 启动前端 (端口 3000)

```bash
cd nvc
npm run dev
```

### 一键启动 (Windows)

在项目根目录执行一条命令即可并行拉起后端、前端、OCR 三个服务(各自独立窗口):

```powershell
.\start-all.ps1
```

一键停止:

```powershell
.\stop-all.ps1
```

> 脚本会检查 `java`/`mvn`/`node`/`npm` 是否在 PATH 中、MySQL 是否监听 3306、以及 `valorant-ocr` conda 环境是否存在(OCR 使用 PaddleOCR 引擎)。请先确保 MySQL 已启动。
