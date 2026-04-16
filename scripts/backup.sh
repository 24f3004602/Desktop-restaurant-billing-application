#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${ROOT_DIR}/database/restaurant_pos.db"
BACKUP_DIR="${ROOT_DIR}/database/backups"
MAX_BACKUPS="${MAX_BACKUPS:-14}"

mkdir -p "${BACKUP_DIR}"

if [ ! -f "${DB_PATH}" ]; then
  echo "Database not found at ${DB_PATH}"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_DIR}/restaurant_pos_${STAMP}.db"
cp "${DB_PATH}" "${TARGET}"

echo "Backup created: ${TARGET}"

ls -1t "${BACKUP_DIR}"/restaurant_pos_*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f
