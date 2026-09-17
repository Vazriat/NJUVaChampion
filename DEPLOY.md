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

## 7. 升级发布

```bash
git pull
docker compose up -d --build
```

数据库结构无需手动迁移（JPA ddl-auto: update 自动更新）。

## 8. 常见问题

- 后端启动就退出：先看 `docker compose logs backend`，多半是 .env 密码没改或 MySQL 未就绪（healthcheck 会等待）
- OCR 识别慢/吃内存：单张截图秒级正常；频繁 OCR 时观察 `docker stats`，2C4G 够用
- 前端连不上后端：确认 .env 未改、`docker compose ps` 各服务都是 running；`.env` 里不用改任何 URL（服务名已写死在 compose）
- 中文乱码：MySQL 已强制 utf8mb4，无需处理
- 忘记管理员密码：`docker compose exec backend sh` 后按需处理，或重跑 DataInitializer 前先删库重置（会丢数据，慎用）
