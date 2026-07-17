#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="backups/inspector-${timestamp}.sql.gz"

docker compose exec -T postgres pg_dump \
  --username inspector \
  --dbname inspector \
  --format plain \
  --no-owner \
  --no-privileges | gzip -9 > "$output"

find backups -type f -name 'inspector-*.sql.gz' -mtime +14 -delete
echo "Created $output"
