# NJUVaChampion v0 Docker 部署指南

> 拓扑：nginx(80/443) → frontend(3000) → backend(8080) + ocr(3200)；MySQL 仅容器内网可见。
> 所有内部端口（3000/3200/8080/3306）不对公网暴露，只有 22/80/443 开放。

## 0. 前置

- 腾讯云轻量服务器 2C4G（上海需备案；香港免备案），Ubuntu 22.04 LTS
- 已在安全组/防火墙放行 22、80、443
- 域名：njuvlr.online / www.njuvlr.online（已备案并配好 HTTPS，见第 6 节；
  v0 阶段的裸 IP 访问仍保留）

## 1. 安装 Docker（Ubuntu 22.04）

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
docker --version && docker compose version   # 确认两个都有
sudo systemctl enable --now docker
```

## 2. 获取代码并配置

```bash
git clone <你的仓库地址> njuvachampion && cd njuvachampion
cp .env.example .env
```

编辑 `.env`，把四个 change-me 换成随机值：

```bash
openssl rand -base64 48   # 生成一个，共生成 4 次（DB_ROOT / DB_USER 密码 / JWT / 管理员）
```

说明：
- `APP_JWT_SECRET` 必须是 Base64、解码后 ≥32 字节，`openssl rand -base64 48` 直接可用
- `ADMIN_INIT_PASSWORD` 是首次启动自动创建 admin 的密码，上线后登录后台立即修改

## 2.5 OCR 依赖：宿主机 Miniconda + PaddleOCR（一次性）\n\n本部署用 PaddleOCR（与开发环境同版本），Python 环境放在宿主机、由 OCR 容器挂载使用：\n\n\`\`\`bash\n# 安装 Miniconda（清华镜像）\ncurl -fsSL https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-latest-Linux-x86_64.sh -o /tmp/miniconda.sh\nbash /tmp/miniconda.sh -b -p $HOME/miniconda3\n\n# 清华 conda 源\ncat > ~/.condarc <<'EOF'\nchannels:\n  - defaults\ndefault_channels:\n  - https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main\ncustom_channels:\n  conda-forge: https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud\nEOF\n\n# 创建环境（Python 3.10，与本地一致）\n~/miniconda3/bin/conda create -y -n valorant-ocr python=3.10\n~/miniconda3/envs/valorant-ocr/bin/pip install -i https://mirrors.cloud.tencent.com/pypi/simple \\\n    paddlepaddle==2.6.2 paddleocr==2.10.0\n\n# 系统库（OpenCV/Paddle 需要）\nsudo apt-get install -y libgl1 libglib2.0-0\n\n# 预下载模型（避免运行时下载）\n~/miniconda3/envs/valorant-ocr/bin/python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='en', use_angle_cls=False, show_log=False)"\n\`\`\`\n\ndocker-compose.yml 会自动把 \`~/miniconda3/envs/valorant-ocr\` 与 \`~/.paddleocr\` 挂载进 OCR 容器（路径可用环境变量 \`OCR_CONDA_ENV_PATH\` / \`OCR_PADDLE_HOME\` 覆盖）。\n\n## 3. 构建并启动（首次约 10~30 分钟）

```bash
docker compose up -d --build
docker compose ps            # 五个服务都应为 running
docker compose logs -f backend   # 看到 Spring Boot Started 即成功
docker compose logs -f frontend  # 看到 Ready 即成功
```

访问 `http://服务器公网IP/`，用 admin + ADMIN_INIT_PASSWORD 登录。

## 4. 验证 OCR

管理后台 -> 记录比赛 -> 上传结算截图，识别结果会自动填入选手表。
OCR 服务日志：`docker compose logs -f ocr`。

## 5. 数据备份（重要！）

备份统一走 `scripts/backup.sh`（数据库 + 上传目录，并自动清理 7 天前的旧包）：

```bash
./scripts/backup.sh          # 手动跑一次验证
```

建议 crontab 每天 3:30 备份。**必须用 `bash` 显式调用**，不要裸写脚本路径：

```bash
crontab -e
# 30 3 * * * bash /home/ubuntu/njuvachampion/scripts/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```

> ⚠️ 两种失败方式都会让备份静默停摆，务必确认：
> 1. 裸路径调用依赖脚本的可执行位。仓库里 `scripts/backup.sh` 已置为 `100755`，
>    但若服务器上被 reset 成 `644`，cron 只会往 log 里写 `Permission denied` 而不报警。
>    用 `bash <路径>` 调用可绕开该依赖。
> 2. 脚本内部需要 `sudo`（`sudo docker compose ...`）。确认该用户 sudo 免密，
>    否则 cron 无人值守时会卡在密码提示上。
>
> 上线后请查一次 `~/backups/backup.log` 和 `ls -lh ~/backups/`，
> 确认当天有新的 `db-*.sql.gz` 和 `uploads-*.tar.gz`。空包（几十字节）说明挂载路径有问题。

定期下载一份到本地（云盘/学校电脑），不要把鸡蛋放一个篮子里。

## 6. HTTPS（备案 + 域名就绪后）

正式域名：**njuvlr.online**（主域名），`www.njuvlr.online` 301 跳主域名。
仓库已附带正式配置 `nginx/conf.d/https.conf`，换域名部署时才需要改（参考
`https.conf.example`）。

### 6.1 前置检查（少一样都会失败）

```bash
# 域名解析到本机公网 IP
getent hosts njuvlr.online www.njuvlr.online
```

**腾讯云控制台「防火墙」必须放行 TCP 80 和 443。** 只放 80 不够——443 未放行时
表现为「HTTP 正常、HTTPS 从公网超时」，而 SSH 进去查 `iptables`/`ufw`/`ss` 一切
正常、DNAT 规则也对称，极易误判成 nginx 配错。判定方法：

```bash
# 服务器访问自己的公网 IP。80 通、443 超时 => 云端防火墙没放行，与 nginx 无关
curl -s -o /dev/null -w '80 -> %{http_code}\n'  http://<公网IP>/
curl -sk -o /dev/null -w '443 -> %{http_code}\n' https://<公网IP>/
```

### 6.2 签发证书（webroot，nginx 容器需在跑）

```bash
cd ~/njuvachampion
docker run --rm \
  -v /home/ubuntu/njuvachampion/certbot/conf:/etc/letsencrypt \
  -v /home/ubuntu/njuvachampion/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  --register-unsafely-without-email --agree-tos --no-eff-email \
  -d njuvlr.online -d www.njuvlr.online
```

`--register-unsafely-without-email` 表示不登记到期通知邮箱（证书照签，只是收不到
Let's Encrypt 的到期/吊销提醒）。想收通知就换成 `-m 你的邮箱`；已签发后补登记：

```bash
docker run --rm -v /home/ubuntu/njuvachampion/certbot/conf:/etc/letsencrypt \
  certbot/certbot update_account -m 你的邮箱 --no-eff-email
```

腾讯云访问 Docker Hub 会超时，但 `daemon.json` 已配 `mirror.ccs.tencentyun.com`
镜像源，`docker pull certbot/certbot` 正常。

### 6.3 启用 HTTPS

```bash
docker compose exec nginx nginx -t          # 先验语法
docker compose exec nginx nginx -s reload
```

> reload 后立刻 curl 可能仍被旧 worker 响应（表现为该 301 的却是 200），等 1~2 秒再验证。

### 6.4 ⚠️ bind mount 陈旧：改了配置却不生效的头号原因

Docker 的 bind mount 在**容器创建那一刻**就固定了源目录的 inode。如果项目目录之后
被整体替换过（重新解压 tarball、`rm -rf` 后重建同名目录等），容器仍指向那个已被
删除的旧 inode——**宿主机改 nginx 配置、certbot 往 webroot 写挑战文件，容器里都看
不到**，`nginx -s reload` 只是重载旧配置，全程零报错，非常难查。

判定（宿主机新建文件，看容器里有没有）：

```bash
touch ~/njuvachampion/nginx/conf.d/__probe.conf
docker exec njuvachampion-nginx ls /etc/nginx/conf.d/   # 没有 __probe.conf 就是陈旧挂载
rm -f ~/njuvachampion/nginx/conf.d/__probe.conf
```

修复（重建容器会重新绑定目录）：

```bash
docker compose up -d --force-recreate --no-deps nginx
```

`--no-deps` 必须加，否则会连带重建 frontend。

### 6.5 自动续期

用 `scripts/renew-cert.sh`：`certbot renew` 是幂等的（未到期直接跳过），脚本无论
是否真的续了证都会 `nginx -t` 后 reload 一次，避免「证书续了但 nginx 仍在用旧证书」。

```bash
./scripts/renew-cert.sh          # 手动跑一次验证
crontab -e
# 0 4,16 * * * bash /home/ubuntu/njuvachampion/scripts/renew-cert.sh >> /home/ubuntu/logs/renew-cert.log 2>&1 || echo "[renew] FAILED at $(date)" >> /home/ubuntu/logs/renew-cert.log
```

同样用 `bash <绝对路径>` 显式调用（理由见第 5 节）。日志：`~/logs/renew-cert.log`。

## 7. 升级发布（手动，一键脚本）

**发布主线是 `master`**：开发在 `hyl` 上进行，通过 PR 合入 `master`；服务器跟踪 `master`。

合并后**不会自动上线**——需要有人主动跑一次部署。这是有意的：自动部署意味着任何一次
草率合并都会直接进生产，对比赛期间是不可接受的风险。

```bash
cd ~/njuvachampion
git log --oneline -1          # 看看当前跑的是哪一版
bash scripts/deploy.sh        # 一键上线
```

`scripts/deploy.sh` 的步骤（每步都有日志，失败时明确告诉你「容器动没动」）：

1. 前置检查：git / docker 可用、在项目根目录、**工作区干净**（不干净直接中止）
2. 记录当前版本，给**当前运行中的**镜像打回滚标签 `rollback-<时间>-<完整sha>`
3. `git fetch` + `git merge --ff-only origin/master`
4. **部署前备份**数据库与上传目录（可 `--no-backup` 跳过）
5. `COMPOSE_PARALLEL_LIMIT=1 docker compose build` —— **构建门禁**
6. 只有构建成功才 `docker compose up -d` 切换容器；构建失败则代码回退、容器不动
7. 部署后核对：站点状态码、各服务容器镜像与 `:latest` 是否对齐
8. 清理超量的旧回滚标签（默认保留最近 3 个，用 `KEEP_ROLLBACKS` 调整）

参数：`--branch=<分支>` 换分支、`--force` 强制重建、`--no-backup` 跳过备份。

出问题回滚：

```bash
bash scripts/rollback.sh                                    # 列出所有回滚点
bash scripts/rollback.sh rollback-20260917-201500-<sha>     # 回滚（支持唯一前缀）
```

回滚会同时切回旧镜像**并把代码 `git reset` 到对应提交**，保证「repo HEAD」与
「运行中的镜像」一一对应。但这只是应急止血——`origin/master` 上那个有问题的提交仍在，
下次跑 `deploy.sh` 会把它重新部署上来。彻底修复请在本地 `git revert` 后走 PR 合并。

数据库结构无需手动迁移（JPA `ddl-auto: update` 自动更新）。

### 7.1 ⚠️ 这台服务器连不上 GitHub 的 HTTPS，必须走 SSH

实测结论（2026-09-17，从这台腾讯云轻量服务器出发）：

| 通路 | 结果 |
|---|---|
| `github.com:443`（HTTPS） | **TCP 连不上**；`git fetch` 报 `GnuTLS recv error (-110)` 或 443 连接超时 |
| `github.com:22`（SSH） | TCP 可连 |
| `ssh.github.com:443`（SSH over 443） | TCP 可连，`ssh -T` 能走到认证环节 |

**这个 HTTPS 故障是概率性的**，所以不能凭「刚才还能通」判断：`git ls-remote` 可能成功、
紧接着 `git fetch` 就失败。`git config http.version HTTP/1.1` 只能缓解不能根治
（实测仍会连续 6 次失败，且失败形态会从报错变成**卡住 45 秒后超时**）。

因此服务器侧改用 SSH 远程，并让 `github.com` 走 443 端口的 SSH 入口。
`~/.ssh/config` 已配好：

```
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/njuv_deploy
  IdentitiesOnly yes
```

**还需在 GitHub 仓库 Settings → Deploy keys → Add deploy key 加入
`~/.ssh/njuv_deploy.pub` 的内容，只读，不要勾选 Allow write access。** 验证：

```bash
ssh -T git@github.com
# 期望：Hi Vazriat/NJUVaChampion! You've successfully authenticated...
```

未加公钥时的报错是瞬时的 `Permission denied (publickey)`；如果变成卡住几十秒超时，
那才是网络层问题，不是密钥问题——两者要分清。

当时做的切换（供参考，正常情况下不需要再做）：

```bash
git remote set-url origin git@github.com:Vazriat/NJUVaChampion.git
git remote set-branches origin '*'    # 原先是单分支克隆，只跟踪 hyl，连 origin/master 都没有
```

### 7.2 不要在部署目录里手工改文件

服务器上的工作区应当始终等于某个提交。一旦手工改了 `nginx/conf.d/*`、`scripts/*`
这类文件，下次 `git pull` 会直接拒绝（`local changes would be overwritten`），
而且**清理本地改动这一步会把这些文件从磁盘上删掉**——nginx 内存里还跑着旧配置，
表面看不出问题，但任何 reload 或容器重启都会让配置残缺甚至站点起不来。

正确做法是改仓库、走 PR 合并、再跑 `scripts/deploy.sh`。`deploy.sh` 开头就会检查
工作区是否干净，不干净直接中止，不会带着脏状态往下走。

临时应急改了的话，pull 之前先把要留下的文件复制到 `~/deploy-backup/<时间戳>/`
再撤销本地改动。

### 7.3 2C4G 上要串行构建

三个镜像并行构建有 OOM 风险（可用内存约 2.2G + 2G swap）。串行构建：

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose build && docker compose up -d
```

实测串行构建约 3 分钟，内存占用始终健康。**若构建失败，不要执行 `up -d`**，
保持旧容器继续服务，修好再上。（`scripts/deploy.sh` 已内置串行构建与「构建失败
就不切容器」的门禁；手动执行时记得照抄这个环境变量。）

### 7.4 镜像摘要漂移：一个会误报的坑，和一个真的坑

#### 7.4.1 会误报的那个：BuildKit 的 attestation

BuildKit 默认给镜像注入 provenance attestation，里面的元数据（构建时间戳等）**每次
构建都不同**，于是 manifest list 摘要每次都变——即使所有层都是缓存命中、平台镜像
逐字节相同。构建日志里能直接看到：

```
exporting manifest      sha256:3281e30a33...   ← 两次构建相同
exporting config        sha256:c8afb33a...     ← 两次构建相同
exporting manifest list sha256:44452c19...     ← 只有这行每次都不一样
```

后果是「容器镜像 vs `:latest`」的核对会**每次重建都误报漂移**，报警器一叫就没人
信了。所以 `scripts/deploy.sh` 构建时固定带上：

```bash
BUILDX_NO_DEFAULT_ATTESTATIONS=1
```

关掉之后摘要可复现——实测连续两次构建，三个镜像 ID 完全不变。**这个环境变量别删。**

#### 7.4.2 真的那个：容器没跟着新镜像重建

如果某个服务的构建上下文这次没有变化（例如只改了前端），它是全缓存命中，镜像 ID
不变；此时 `docker compose up -d` 可能只重建了镜像变化的服务，而把旧容器留在原地
——旧容器可能挂在一个已被 retag 掉的镜像 ID 上，表现为：

```
$ docker ps
njuvachampion-ocr   ...  IMAGE sha256:eb993d3c...     Up 3 weeks
$ docker inspect njuvachampion-ocr:latest --format '{{.Id}}'
sha256:e32ae60f...                                     # 和上面不是一个
```

代码虽然等价，但「跑着的」和「标签指的」不是同一个镜像，属于隐性漂移。对齐：

```bash
docker compose up -d --force-recreate --no-deps ocr
```

发布后建议逐个核对，不一致的就对齐：

```bash
for c in backend frontend ocr; do
  printf '%-8s ' "$c"
  a=$(docker inspect njuvachampion-$c --format '{{.Image}}')
  b=$(docker inspect njuvachampion-$c:latest --format '{{.Id}}')
  [ "$a" = "$b" ] && echo "一致" || echo "漂移！$a != $b"
done
```

`scripts/deploy.sh` 部署后会自动跑这段核对，**检测到漂移会就地强制重建该服务并复核**，
保证部署结束时「跑着的」必定等于「刚构建的」——不会留一个「只报警、不自愈」的半成品状态。

### 7.5 发布后核对清单

`scripts/deploy.sh` 已自动检查第 1 项与镜像对齐；数据量核对建议人工扫一眼。

```bash
# 1. 域名与跳转
curl -sI https://njuvlr.online/ | head -1              # 200
curl -sI https://www.njuvlr.online/ | grep -i location # 301 到主域名
# 2. 后端行为：未认证访问受保护接口应 401
curl -s -o /dev/null -w '%{http_code}\n' https://njuvlr.online/api/tournaments
# 3. 数据量（与前次对比，确认没丢）
docker exec -i njuvachampion-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N njuvachampion' <<'SQL'
SELECT 'users', COUNT(*) FROM users;
SQL
```

## 8. 常见问题

- 后端启动就退出：先看 `docker compose logs backend`，多半是 .env 密码没改或 MySQL 未就绪（healthcheck 会等待）
- OCR 识别慢/吃内存：单张截图秒级正常；频繁 OCR 时观察 `docker stats`，2C4G 够用
- 前端连不上后端：确认 .env 未改、`docker compose ps` 各服务都是 running；`.env` 里不用改任何 URL（服务名已写死在 compose）
- 中文乱码：MySQL 已强制 utf8mb4，无需处理
- 忘记管理员密码：`docker compose exec backend sh` 后按需处理，或重跑 DataInitializer 前先删库重置（会丢数据，慎用）
