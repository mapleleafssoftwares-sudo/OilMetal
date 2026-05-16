#!/usr/bin/env bash
# =============================================================
# backup.sh — Backup manual de Supabase con pg_dump
# Uso:  ./backup.sh
# =============================================================
set -euo pipefail

# ── Configuración ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BACKUP_DIR="$SCRIPT_DIR/backups"
RETENTION_DAYS=30

# pg_dump de libpq (instalado vía Homebrew)
PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"

# ── Carga variables de entorno ─────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  No se encontró $ENV_FILE" >&2
  echo "    Creá el archivo con:  DATABASE_URL=\"postgresql://...\"" >&2
  exit 1
fi
# shellcheck source=.env
source "$ENV_FILE"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌  DATABASE_URL no está definida en $ENV_FILE" >&2
  exit 1
fi

# ── Validaciones ──────────────────────────────────────────────
if [[ ! -x "$PG_DUMP" ]]; then
  echo "❌  pg_dump no encontrado en $PG_DUMP" >&2
  echo "    Instalá con:  brew install libpq && brew link --force libpq" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Nombre del archivo ─────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.dump"

# ── Ejecutar pg_dump ──────────────────────────────────────────
echo "⏳  Iniciando backup — $(date '+%d/%m/%Y %H:%M:%S')"
echo "    Destino: $BACKUP_FILE"

PGSSLMODE=require "$PG_DUMP" \
  --format=custom \
  --compress=9 \
  --no-password \
  --verbose \
  "$DATABASE_URL" \
  --file="$BACKUP_FILE" 2>&1 | grep -E "^(pg_dump:|dumping|reading)" || true

# ── Verificar que el archivo no esté vacío ────────────────────
if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "❌  El archivo de backup está vacío. Algo salió mal." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

FILE_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "✅  Backup completado: $(basename "$BACKUP_FILE") ($FILE_SIZE)"

# ── Limpiar backups viejos (más de RETENTION_DAYS días) ───────
DELETED=$(find "$BACKUP_DIR" -name "backup_*.dump" -mtime +"$RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DELETED" -gt 0 ]]; then
  echo "🗑   Se eliminaron $DELETED backup(s) con más de $RETENTION_DAYS días."
fi

echo "📁  Backups disponibles:"
ls -lh "$BACKUP_DIR"/backup_*.dump 2>/dev/null | awk '{print "    " $5 "\t" $9}' || echo "    (ninguno)"
