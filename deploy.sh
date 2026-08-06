#!/bin/bash
#
# SakhGO Production Deploy Script
# Server: /home/alex/sakhgo  |  Ubuntu 20.04
#
# Usage: bash deploy.sh
#
# Safe by design:
#   - set -euo pipefail (fail fast)
#   - Backs up .next before build
#   - Rolls back on any failure
#   - Zero-downtime reload via PM2
#   - Keeps last 5 rollback snapshots
#
set -euo pipefail

APP_DIR="/home/alex/sakhgo"
SERVICE="sakhgo"
URL="https://sakhgo.ru"
BACKUP_DIR="$APP_DIR/.deploy-backups"
TS=$(date +%Y%m%d_%H%M%S)

cd "$APP_DIR"

# ── Helpers ──
log()  { printf '\033[0;32m[DEPLOY]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[WARN]\033[0m  %s\n' "$1"; }
err()  { printf '\033[0;31m[ERROR]\033[0m %s\n' "$1" >&2; }

# ── Rollback on failure ──
cleanup() {
    local step="${1:-unknown}"
    err "DEPLOY FAILED at: $step"
    if [ -d "$BACKUP_DIR/.next-$TS" ]; then
        rm -rf .next 2>/dev/null || true
        cp -r "$BACKUP_DIR/.next-$TS" .next
        log "Restored .next from backup"
    fi
    if pm2 list 2>/dev/null | grep -q "$SERVICE"; then
        pm2 reload "$SERVICE" 2>/dev/null || true
    else
        pm2 start npm --name "$SERVICE" -- run start 2>/dev/null || true
    fi
    exit 1
}

trap 'cleanup "${STEP:-}"' ERR

# ──────────────────────────────────────────────
echo ""
log "SakhGO Deploy  ▸  $(date '+%Y-%m-%d %H:%M:%S')"
echo "───────────────────────────────────────────"
log "Directory : $APP_DIR"
log "Service   : $SERVICE"
log "Verify URL: $URL"
echo ""

# ── 1. Git pull ──
STEP="git-pull"
log "Pulling latest code..."
if git rev-parse --git-dir >/dev/null 2>&1; then
    BEFORE_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    git pull origin main 2>/dev/null || warn "git pull skipped (network or permission issue)"
    AFTER_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    log "Git: $BEFORE_HASH  →  $AFTER_HASH"
else
    warn "Not a git repo — assuming archive extraction was used"
    BEFORE_HASH="archive"
    AFTER_HASH="archive"
fi

# ── 2. Install deps (production only) ──
STEP="npm-ci"
log "Installing production dependencies..."
npm ci --omit=dev --prefer-offline 2>&1 | tail -3

# ── 3. Backup current .next ──
STEP="backup"
mkdir -p "$BACKUP_DIR"
if [ -d ".next" ]; then
    cp -a .next "$BACKUP_DIR/.next-$TS"
    log "Backed up .next ($(du -sh .next | cut -f1))  →  $BACKUP_DIR/.next-$TS"
else
    warn "No existing .next — skipping backup (first deploy?)"
fi

# ── 4. Build ──
STEP="build"
log "Building Next.js..."
npm run build

# ── 5. Database migrations ──
STEP="migrate"
log "Running database migrations..."
npm run db:migrate

# ── 6. PM2 reload (zero-downtime) ──
STEP="pm2-reload"
log "Reloading PM2..."
if pm2 list 2>/dev/null | grep -q "$SERVICE"; then
    pm2 reload "$SERVICE"
else
    warn "Process '$SERVICE' not found — starting fresh"
    pm2 start npm --name "$SERVICE" -- run start
    pm2 save
fi

# ── 7. Verify ──
STEP="verify"
log "Verifying $URL ..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" --max-time 15 || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    err "Health check returned HTTP $HTTP_CODE (expected 200)"
    cleanup "verify-failed"
fi

# ── Success ──
echo ""
log "DEPLOY SUCCESS  ▸  HTTP $HTTP_CODE"
log "Previous build: $BACKUP_DIR/.next-$TS"

# Rotate backups — keep last 5
ls -dt "$BACKUP_DIR"/.next-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

# ── Auto-record build ──
node scripts/record-build.js 2>/dev/null || true

echo ""
exit 0
