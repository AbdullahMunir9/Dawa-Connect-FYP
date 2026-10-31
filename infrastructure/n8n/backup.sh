#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $SCRIPT_DIR/.env" >&2
  exit 1
fi

set -a
source ./.env
set +a

BACKUP_ROOT="${1:-$SCRIPT_DIR/backups}"
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077

docker compose exec -T postgres pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --file "/tmp/n8n-$STAMP.dump"

docker compose cp "postgres:/tmp/n8n-$STAMP.dump" "$BACKUP_ROOT/n8n-$STAMP.dump"
docker compose exec -T postgres rm -f "/tmp/n8n-$STAMP.dump"

docker run --rm \
  --mount type=volume,src=dawaconnect_n8n_data,dst=/data,readonly \
  --mount type=bind,src="$BACKUP_ROOT",dst=/backup \
  alpine:3.23 \
  tar -czf "/backup/n8n-data-$STAMP.tar.gz" -C /data .

sha256sum "$BACKUP_ROOT/n8n-$STAMP.dump" "$BACKUP_ROOT/n8n-data-$STAMP.tar.gz" \
  > "$BACKUP_ROOT/SHA256SUMS-$STAMP.txt"

echo "Backup created in $BACKUP_ROOT"
echo "Store an encrypted copy of .env separately; it contains the encryption key required for credential recovery."

