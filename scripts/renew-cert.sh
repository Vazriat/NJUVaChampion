#!/usr/bin/env bash
set -euo pipefail

# NJUVaChampion 证书续期脚本（Let's Encrypt / webroot）
# 用法: ./scripts/renew-cert.sh   （cron 建议每日执行，务必用 bash 显式调用）
#
# 设计说明：
#   certbot renew 是幂等的——没进入续期窗口的证书会被直接跳过。
#   所以无论这次是否真的续了证，跑完都 reload 一次 nginx（成本极低），
#   避免"证书续了但 nginx 仍在用旧证书"这种静默故障。
#   续期前先 nginx -t 验语法，语法错就中止，不会把坏配置推上线。

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONTAINER="${NGINX_CONTAINER:-njuvachampion-nginx}"

echo "[renew] $(date '+%F %T') 检查证书 ..."
docker run --rm \
  -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot

echo "[renew] 校验并 reload nginx ..."
docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload

echo "[renew] 当前证书状态："
docker run --rm -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certificates 2>/dev/null \
  | grep -E 'Certificate Name|Domains|Expiry Date' || true

echo "[renew] done"
