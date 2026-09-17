#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# NJUVaChampion 回滚脚本
#
# 用法：
#   ./scripts/rollback.sh                       # 列出所有可用回滚点
#   ./scripts/rollback.sh rollback-20260917-201500-<sha>   # 回滚到指定点
#   ./scripts/rollback.sh 20260917-201500        # 支持唯一前缀
#
# 回滚点由 scripts/deploy.sh 在每次部署前自动创建（给当时的镜像打标签）。
#
# ⚠️ 关于代码状态：
#   本脚本除了切回旧镜像，还会把代码 git reset 回该回滚点记录的提交，
#   让「repo HEAD」和「运行中的镜像」保持一致的对应关系。
#   但这只是应急止血——origin/master 上那个有问题的提交仍然在，
#   下次跑 deploy.sh 会把它重新部署上来。彻底修复请在本地：
#       git revert <问题提交>  然后推 PR 合并，再走一次 deploy.sh
# ============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

BUILT_SERVICES=(backend frontend ocr)
ROLLBACK_PREFIX="rollback"
HEALTH_URL="${HEALTH_URL:-https://njuvlr.online/}"

log()  { printf '[rollback] %s\n' "$*"; }
warn() { printf '[rollback] ⚠️  %s\n' "$*" >&2; }
die()  { printf '[rollback] ✖ %s\n' "$*" >&2; exit 1; }

TARGET="${1:-}"

# -------------------------------------------------- 收集回滚点（以 backend 为准）
mapfile -t ALL_TAGS < <(
  docker image ls --format '{{.Tag}}\t{{.CreatedAt}}' njuvachampion-backend 2>/dev/null \
    | awk -F'\t' -v p="$ROLLBACK_PREFIX-" '$1 ~ ("^" p)' \
    | sort -k2 -r | awk -F'\t' '{print $1}'
)

# ------------------------------------------------------------------- 列出模式
if [ -z "$TARGET" ]; then
  log "当前 HEAD: $(git log --oneline -1)"
  log "当前运行中的镜像："
  for svc in "${BUILT_SERVICES[@]}"; do
    printf '  %-9s %s\n' "$svc" "$(docker inspect "njuvachampion-$svc" --format '{{.Image}}' 2>/dev/null || echo '未运行')"
  done
  echo
  if [ "${#ALL_TAGS[@]}" = "0" ]; then
    warn "没有任何回滚点。只有在跑过一次 deploy.sh 之后才会有。"
    exit 1
  fi
  log "可用回滚点（新 → 旧）："
  for t in "${ALL_TAGS[@]}"; do echo "  $t"; done
  echo
  log "用法：./scripts/rollback.sh <上面任意一个标签>"
  exit 0
fi

# --------------------------------------------------------------- 解析目标标签
MATCHES=()
for t in "${ALL_TAGS[@]}"; do
  case "$t" in "$TARGET"*) MATCHES+=("$t") ;; esac
done

if [ "${#MATCHES[@]}" = "0" ]; then
  warn "没有匹配的回滚点：$TARGET"
  log "可用回滚点："
  for t in "${ALL_TAGS[@]}"; do echo "  $t"; done
  exit 1
fi
if [ "${#MATCHES[@]}" -gt 1 ]; then
  warn "前缀 $TARGET 匹配到多个回滚点，请写完整一些："
  for t in "${MATCHES[@]}"; do echo "  $t"; done
  exit 1
fi

TAG="${MATCHES[0]}"
# 标签格式：rollback-<YYYYmmdd-HHMMSS>-<完整40位sha>
TARGET_SHA="${TAG##*-}"
if ! [[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  warn "无法从标签解析出提交 sha：$TAG"
  die "标签格式异常，建议人工处理"
fi

log "回滚目标: $TAG"
log "  对应提交: $(git log --oneline -1 "$TARGET_SHA" 2>/dev/null || echo '(本地无此提交对象)')"

# --------------------------------------------------------------- 切回旧镜像
log "切回旧镜像 ..."
RESTORED=0
for svc in "${BUILT_SERVICES[@]}"; do
  src="njuvachampion-$svc:$TAG"
  if docker image inspect "$src" >/dev/null 2>&1; then
    docker tag "$src" "njuvachampion-$svc:latest"
    log "  $src -> njuvachampion-$svc:latest"
    RESTORED=$((RESTORED + 1))
  else
    warn "  njuvachampion-$svc:$TAG 不存在，该服务保持不动"
  fi
done

if [ "$RESTORED" = "0" ]; then
  die "没有任何镜像被切回，中止（容器未动）"
fi

log "重建容器 ..."
docker compose up -d --force-recreate --no-deps "${BUILT_SERVICES[@]}"
docker compose up -d
sleep 15
docker compose ps

# ------------------------------------------------------- 代码回退到对应提交
log "把代码回退到 $TARGET_SHA ..."
CUR_SHA="$(git rev-parse HEAD)"
if [ "$CUR_SHA" = "$TARGET_SHA" ]; then
  log "  代码已经在该提交上，无需回退"
else
  git reset --hard "$TARGET_SHA"
  log "  代码已回退: $(git log --oneline -1)"
fi

# ------------------------------------------------------------------- 核对
log "核对 ..."
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH_URL" || echo "000")"
log "  $HEALTH_URL -> $CODE"
[ "$CODE" = "200" ] || warn "站点未返回 200，请人工确认"

echo
log "回滚完成"
warn "这是应急止血：origin/master 上那个有问题的提交仍在。"
warn "彻底修复请在本地 git revert 后推 PR 合并，再跑一次 ./scripts/deploy.sh"
