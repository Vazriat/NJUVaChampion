#!/usr/bin/env bash
set -euo pipefail

# NJUVaChampion 备份脚本（数据库 + 上传目录）
# 用法: ./scripts/backup.sh   （cron 建议每日执行）

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"
DATE="$(date +%F_%H%M)"

echo "[backup] db dump ..."
sudo docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines njuvachampion' \
  > "$BACKUP_DIR/db-$DATE.sql"
gzip -f "$BACKUP_DIR/db-$DATE.sql"

echo "[backup] uploads ..."
sudo docker run --rm -v njuvachampion_uploads-data:/data -v "$HOME":/host alpine tar czf "/host/backups/uploads-$DATE.tar.gz" -C /data .

echo "[backup] prune older than ${KEEP_DAYS}d ..."
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +${KEEP_DAYS} -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +${KEEP_DAYS} -delete

echo "[backup] done"
ls -lh "$BACKUP_DIR"
