#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# NJUVaChampion 一键上线脚本（手动触发，不做自动轮询）
#
# 用法：
#   ./scripts/deploy.sh                    # 部署 origin/master 最新提交
#   ./scripts/deploy.sh --branch=master    # 指定分支
#   ./scripts/deploy.sh --force            # 即使已是最新也强制重建
#   ./scripts/deploy.sh --no-backup        # 跳过部署前的数据库备份
#
# 设计原则：
#   1. 构建门禁——构建不成功绝不切换容器，旧版本继续对外服务
#   2. 部署前给当前镜像打回滚标签，出问题用 scripts/rollback.sh 一条命令回退
#   3. 2C4G 上串行构建，避免并行构建 OOM
#   4. 每一步都写清楚状态，失败时明确告诉你「现在处于哪一步、容器动没动」
#
# 前置条件：服务器需能访问 GitHub。HTTPS 到 github.com 在本机被阻断，
# 已通过 ~/.ssh/config 让 git@github.com 走 ssh.github.com:443，
# 并需要把 ~/.ssh/njuv_deploy.pub 作为只读 Deploy Key 加到 GitHub 仓库。
# ============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

BRANCH="master"
FORCE=0
DO_BACKUP=1

for arg in "$@"; do
  case "$arg" in
    --branch=*)  BRANCH="${arg#*=}" ;;
    --force)     FORCE=1 ;;
    --no-backup) DO_BACKUP=0 ;;
    -h|--help)   sed -n '2,25p' "$0"; exit 0 ;;
    *)           echo "未知参数: $arg（用 --help 看用法）" >&2; exit 2 ;;
  esac
done

# 带 build 的服务（mysql / nginx 用官方镜像，不打回滚标签）
BUILT_SERVICES=(backend frontend ocr)
ROLLBACK_PREFIX="rollback"
KEEP_ROLLBACKS="${KEEP_ROLLBACKS:-3}"
HEALTH_URL="${HEALTH_URL:-https://njuvlr.online/}"

log()  { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] ⚠️  %s\n' "$*" >&2; }
die()  { printf '[deploy] ✖ %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- 1. 前置检查
log "=== 1/8 前置检查 ==="
command -v git    >/dev/null || die "缺少 git"
command -v docker >/dev/null || die "缺少 docker"
docker compose version >/dev/null 2>&1 || die "缺少 docker compose 插件"
[ -f docker-compose.yml ] || die "当前目录不是项目根目录: $PROJECT_DIR"

if [ -n "$(git status --porcelain)" ]; then
  warn "工作区不干净，部署会中止。以下是未提交的改动："
  git status --short
  die "请先处理这些改动（git stash / git checkout -- <文件> / 提交）。"
fi
log "环境检查通过，工作区干净"

# ------------------------------------------------------------ 2. 记录当前版本
log "=== 2/8 记录当前版本 ==="
OLD_SHA="$(git rev-parse HEAD)"
OLD_SHORT="${OLD_SHA:0:7}"
log "当前 HEAD: $OLD_SHORT  $(git log --oneline -1)"

# ------------------------------------------------------------------- 3. 拉取
log "=== 3/8 拉取 origin/$BRANCH ==="
if ! git fetch origin "$BRANCH" --tags 2>&1; then
  warn "git fetch 失败。若报 TLS/连接类错误，按顺序检查："
  warn "  1) ~/.ssh/config 是否让 github.com 走 ssh.github.com:443"
  warn "  2) ssh -T git@github.com 是否返回欢迎语（否则是 Deploy Key 没加）"
  warn "  3) 当前 remote 是否为 SSH：git remote -v"
  die "拉取失败，尚未改动任何东西"
fi
NEW_SHA="$(git rev-parse "origin/$BRANCH")"
NEW_SHORT="${NEW_SHA:0:7}"
log "远端 $BRANCH: $NEW_SHORT  $(git log --oneline -1 "$NEW_SHA")"

if [ "$OLD_SHA" = "$NEW_SHA" ] && [ "$FORCE" != "1" ]; then
  log "已是最新，无需部署。要强制重建加 --force"
  exit 0
fi

# ------------------------------------------------------- 4. 打镜像回滚标签
log "=== 4/8 给当前镜像打回滚标签 ==="
STAMP="$(date +%Y%m%d-%H%M%S)"
ROLLBACK_TAG="$ROLLBACK_PREFIX-$STAMP-$OLD_SHA"
TAGGED=0
for svc in "${BUILT_SERVICES[@]}"; do
  img="njuvachampion-$svc:latest"
  if docker image inspect "$img" >/dev/null 2>&1; then
    docker tag "$img" "njuvachampion-$svc:$ROLLBACK_TAG"
    log "  njuvachampion-$svc:$ROLLBACK_TAG"
    TAGGED=$((TAGGED + 1))
  else
    log "  (njuvachampion-$svc:latest 不存在，跳过)"
  fi
done
if [ "$TAGGED" = "0" ]; then
  warn "没有任何镜像被标记，说明这可能是首次部署，之后无法回滚到「上一版」"
fi

# ------------------------------------------------------------ 5. 部署前备份
if [ "$DO_BACKUP" = "1" ] && [ -x scripts/backup.sh ]; then
  log "=== 5/8 部署前备份（数据库 + 上传目录）==="
  bash scripts/backup.sh 2>&1 | tail -6 || warn "备份失败，但继续部署（如需中止请 Ctrl+C）"
else
  log "=== 5/8 跳过备份 ==="
fi

# ------------------------------------------------------------ 6. 更新代码
log "=== 6/8 更新代码到 $NEW_SHORT ==="
if ! git merge --ff-only "origin/$BRANCH" 2>&1; then
  warn "无法快进合并——本地有 origin/$BRANCH 之外的提交，或已分叉。"
  warn "代码未被改动，容器也未被改动。请人工处理后重试。"
  die "合并失败"
fi
log "代码已更新: $(git log --oneline -1)"

# -------------------------------------------------------- 7. 构建门禁 + 切换
log "=== 7/8 串行构建（构建失败不会切换容器）==="
# BUILDX_NO_DEFAULT_ATTESTATIONS=1 是必须的，别删：
#   BuildKit 默认给镜像注入 provenance attestation，其中的元数据（时间戳等）
#   每次构建都不同，导致 manifest list 摘要每次都变——即使所有层都是缓存命中、
#   平台镜像逐字节相同。后果是第 8 步的镜像对齐核对会**每次都误报漂移**，
#   报警器一叫就没人信了。关掉之后摘要可复现：连续两次构建 ID 完全一致。
BUILD_START="$(date +%s)"
if ! BUILDX_NO_DEFAULT_ATTESTATIONS=1 COMPOSE_PARALLEL_LIMIT=1 docker compose build; then
  warn "构建失败！"
  log "代码回退到 $OLD_SHORT，容器保持旧版本继续对外服务。"
  git reset --hard "$OLD_SHA"
  die "部署中止——注意：代码已回退，但容器从头到尾没被动过"
fi
log "构建成功，耗时 $(( $(date +%s) - BUILD_START )) 秒"

log "重启受影响的容器 ..."
docker compose up -d
sleep 15
docker compose ps

# ------------------------------------------------------------ 8. 部署后核对
log "=== 8/8 部署后核对 ==="
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH_URL" || echo "000")"
log "  $HEALTH_URL -> $CODE"
if [ "$CODE" != "200" ]; then
  warn "站点未返回 200！建议立即回滚："
  warn "  ./scripts/rollback.sh $ROLLBACK_TAG"
else
  log "  站点健康"
fi

log "  镜像与 :latest 是否对齐："
DRIFTED=()
for svc in "${BUILT_SERVICES[@]}"; do
  running="$(docker inspect "njuvachampion-$svc" --format '{{.Image}}' 2>/dev/null || echo missing)"
  latest="$(docker inspect "njuvachampion-$svc:latest" --format '{{.Id}}' 2>/dev/null || echo missing)"
  if [ "$running" = "$latest" ]; then
    log "    $svc 一致"
  else
    warn "    $svc 漂移（容器=${running:0:19} latest=${latest:0:19}）"
    DRIFTED+=("$svc")
  fi
done

# 检测到漂移就地自愈，保证部署后「跑着的」必定等于「刚构建的」。
# 正常情况不该走到这里（attestation 已关，摘要可复现）；出现即说明 up -d
# 没有因为镜像变化而重建容器——只报警不自愈会让线上一直跑着不一致的镜像。
if [ "${#DRIFTED[@]}" -gt 0 ]; then
  log "  对漂移的服务执行强制重建：${DRIFTED[*]}"
  docker compose up -d --force-recreate --no-deps "${DRIFTED[@]}"
  sleep 15
  log "  复核："
  for svc in "${DRIFTED[@]}"; do
    running="$(docker inspect "njuvachampion-$svc" --format '{{.Image}}' 2>/dev/null || echo missing)"
    latest="$(docker inspect "njuvachampion-$svc:latest" --format '{{.Id}}' 2>/dev/null || echo missing)"
    if [ "$running" = "$latest" ]; then
      log "    $svc 一致"
    else
      warn "    $svc 仍然漂移！容器=${running:0:19} latest=${latest:0:19}"
      warn "    请人工介入：docker compose up -d --force-recreate --no-deps $svc"
    fi
  done
fi

# --------------------------------------------- 清理超量的旧回滚标签（省磁盘）
log "清理超出 $KEEP_ROLLBACKS 个的旧回滚标签（保留最近 $KEEP_ROLLBACKS 个）..."
for svc in "${BUILT_SERVICES[@]}"; do
  mapfile -t old_tags < <(
    docker image ls --format '{{.Tag}}\t{{.CreatedAt}}' "njuvachampion-$svc" 2>/dev/null \
      | awk -F'\t' -v p="$ROLLBACK_PREFIX-" '$1 ~ ("^" p)' \
      | sort -k2 -r | awk -F'\t' '{print $1}'
  )
  if [ "${#old_tags[@]}" -gt "$KEEP_ROLLBACKS" ]; then
    for t in "${old_tags[@]:$KEEP_ROLLBACKS}"; do
      docker rmi "njuvachampion-$svc:$t" >/dev/null 2>&1 && log "  已删除 njuvachampion-$svc:$t"
    done
  fi
done

echo
log "部署完成"
log "  当前版本: $(git log --oneline -1)"
log "  回滚命令: ./scripts/rollback.sh $ROLLBACK_TAG"
