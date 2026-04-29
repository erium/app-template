#!/bin/bash
# Template bootstrap for ephemeral runners (e.g. Halerium App runners).
# Handles: Node upgrade, pnpm install, Postgres install + daemon, stale PID cleanup,
# schema push, seed, build, and launch.
#
# Usage:
#   bash start.sh [PORT]          # production: pnpm build (if needed) + pnpm start
#   bash start.sh --dev [PORT]    # development: pnpm dev (Next.js HMR)
#
# PORT defaults to 8497. See DEPLOYMENT.md for runner-type and environment notes.

set -e

MODE="prod"
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
  MODE="dev"
  shift
fi

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$APP_DIR"

# Bootstrap output goes to app-startup.log (read by bots to diagnose failures).
# No tee — avoids orphaned subprocesses that survive Ctrl+C / stop_app.
# The server's own runtime output is handled by pino (→ logs/).
LOG="${APP_DIR}/app-startup.log"
log() { echo "$@" >> "$LOG"; echo "$@"; }

: > "$LOG"
log "=== App Startup ==="
log "Date: $(date)"
log "Dir:  $APP_DIR"

# Ensure /usr/local/bin is in PATH (n installs Node there, npm installs pnpm there).
export PATH="/usr/local/bin:$PATH"

# 1. Node >= 20 (Halerium runners ship v17).
NODE_VER=$(node --version 2>/dev/null || echo "none")
log "Current Node: $NODE_VER"
if [[ "$NODE_VER" < "v20" ]]; then
  log "Upgrading Node to v20..."
  sudo npm install -g n 2>&1 | tail -1
  sudo n 20 2>&1 | tail -3
  hash -r 2>/dev/null || true
  log "Node now: $(node --version)"
fi

# 2. pnpm (sudo required — `n` installs Node to /usr/local/ owned by root)
if ! command -v pnpm &>/dev/null; then
  log "Installing pnpm..."
  sudo npm install -g pnpm@10 2>&1 | tail -1
  hash -r 2>/dev/null || true
fi

# Dev fast path: if a developer already bootstrapped Postgres locally
# (e.g. via setup-postgres.sh) and `app_db` is reachable as the `app` user,
# skip install/initdb/start/role-creation entirely. Schema push + seed
# (section 7) still run so schema edits and re-seeds are not missed.
# Production runs always do the full bootstrap — runners are ephemeral and
# we cannot assume any prior state.
pg_already_up() {
  # Cheap TCP probe — works without postgresql-client installed.
  (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null || return 1
  local psql_bin
  psql_bin=$(command -v psql 2>/dev/null \
    || ls /usr/lib/postgresql/*/bin/psql 2>/dev/null | sort -V | tail -1)
  [ -n "$psql_bin" ] || return 1
  PGPASSWORD=app "$psql_bin" -h 127.0.0.1 -p 5432 -U app -d app_db -tAc 'SELECT 1' &>/dev/null
}

if [ "$MODE" = "dev" ] && pg_already_up; then
  log "Postgres already running with app_db ready — skipping bootstrap (--dev fast path)."
else
  # 3. PostgreSQL (not preinstalled on Halerium runners).
  if ! ls /usr/lib/postgresql/*/bin/pg_ctl &>/dev/null 2>&1; then
    log "Installing PostgreSQL..."
    sudo apt-get update -qq 2>&1 | tail -1
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client 2>&1 | tail -3
  fi

  PG_BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
  if [ -z "$PG_BIN" ]; then
    log "ERROR: PostgreSQL installation failed."
    exit 1
  fi
  log "PG_BIN: $PG_BIN"

  PG_DATA="$APP_DIR/pg-data"

  # 4. initdb on first boot
  if [ ! -d "$PG_DATA" ] || [ -z "$(ls -A "$PG_DATA" 2>/dev/null)" ]; then
    mkdir -p "$PG_DATA"
    log "Initializing database cluster..."
    "$PG_BIN/initdb" -D "$PG_DATA" --auth=trust --encoding=UTF8 --no-locale
    sed -i "s/^#\?port = .*/port = 5432/" "$PG_DATA/postgresql.conf"
    sed -i "s/^#\?listen_addresses = .*/listen_addresses = '127.0.0.1'/" "$PG_DATA/postgresql.conf"
    sed -i "s|^#\?unix_socket_directories = .*|unix_socket_directories = '$PG_DATA'|" "$PG_DATA/postgresql.conf"
    echo "host    all    all    127.0.0.1/32    md5" >> "$PG_DATA/pg_hba.conf"
  fi

  # 5. Clean stale postmaster.pid from previous ephemeral boot
  if [ -f "$PG_DATA/postmaster.pid" ]; then
    PG_PID=$(head -1 "$PG_DATA/postmaster.pid" 2>/dev/null || echo "0")
    if ! kill -0 "$PG_PID" 2>/dev/null; then
      log "Removing stale postmaster.pid..."
      rm -f "$PG_DATA/postmaster.pid"
    fi
  fi

  # Avoid conflicts with a system Postgres on the same port.
  # apt-get install postgresql auto-starts the system cluster — stop it and wait
  # for port 5432 to be released before starting our local instance.
  sudo systemctl stop postgresql 2>/dev/null || true
  # Stop any system cluster regardless of PG version (12, 14, 16, …)
  for cluster in /etc/postgresql/*/main; do
    ver=$(basename "$(dirname "$cluster")")
    sudo pg_ctlcluster "$ver" main stop 2>/dev/null || true
  done
  for i in $(seq 1 10); do
    ss -tlnp 2>/dev/null | grep -q ":5432 " || break
    sleep 1
  done

  if ! "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
    log "Starting PostgreSQL..."
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/pg.log" -o "-p 5432" start -w -t 30
  fi

  # 6. App role + database
  "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_roles WHERE rolname='app'" postgres 2>/dev/null | grep -q 1 \
    || "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "CREATE USER app WITH PASSWORD 'app';" postgres 2>/dev/null || true
  "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_database WHERE datname='app_db'" postgres 2>/dev/null | grep -q 1 \
    || "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "CREATE DATABASE app_db OWNER app;" postgres 2>/dev/null || true
  "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE app_db TO app;" postgres 2>/dev/null || true
  log "PostgreSQL ready."
fi

# 7. Dependencies + schema + seed
if [ ! -d node_modules ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -3
fi
# Schema strategy: push --force is the only schema tool on runners.
# db:migrate is not idempotent — it fails whenever pg-data is in any partial
# state (tables exist from a previous push without a journal entry, or a
# previous migrate that only partially completed). push --force diffs
# schema.ts against the live DB and applies exactly what is missing,
# regardless of history. It also handles vibe-coder schema changes: any
# edit to schema.ts (which always accompanies a generated migration) is
# picked up by push automatically.
# For production deployments with real data, run pnpm db:migrate separately.
log "Syncing schema..."
pnpm exec drizzle-kit push --force >> "$LOG" 2>&1 || true
log "Seeding..."
pnpm db:seed >> "$LOG" 2>&1 || true

# 8. Run — always via package.json scripts
export PORT="${1:-8497}"

# Auto-detect Halerium runner sub-path and bake it into the Next.js build.
# NEXT_PUBLIC_BASE_PATH must be set BEFORE `next build` because it is baked
# into the JS bundles at build time.
if [ -n "$HALERIUM_ID" ] && [ -z "$NEXT_PUBLIC_BASE_PATH" ]; then
  export NEXT_PUBLIC_BASE_PATH="/apps/${HALERIUM_ID}/${PORT}"
  log "Halerium runner detected — NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH"
fi

if [ "$MODE" = "dev" ]; then
  log "=== App starting (dev) on port $PORT ==="
  exec pnpm dev
fi

if [ ! -f .next/BUILD_ID ]; then
  log "Building..."
  NODE_OPTIONS="--max-old-space-size=768" pnpm build >> "$LOG" 2>&1
fi

log "=== App starting (prod) on port $PORT ==="
exec pnpm start
