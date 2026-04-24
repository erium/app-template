#!/bin/bash
# Template bootstrap for ephemeral runners (e.g. Halerium App runners).
# Handles: Node upgrade, pnpm install, Postgres install + daemon, stale PID cleanup,
# schema push, seed, build, and launch.
#
# Usage:
#   bash start.sh [PORT]          # production: pnpm build (if needed) + pnpm start
#   bash start.sh --dev [PORT]    # development: pnpm dev (Vite + tsx watch, HMR)
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
# The server's own runtime output is handled by pino (→ <pkg>_logs/).
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

# 7. Dependencies + schema + seed
if [ ! -d node_modules ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -3
fi
log "Applying schema..."
pnpm db:push -- --force >> "$LOG" 2>&1 || true
log "Seeding..."
pnpm db:seed >> "$LOG" 2>&1 || true

# 8. Run — always via package.json scripts
export PORT="${1:-8497}"

# Auto-detect Halerium runner sub-path so the server injects the correct <base href>.
# HALERIUM_ID is set by the platform (matches the runner ID in the proxy URL).
# Skip if BASE_PATH was already set explicitly (e.g. local sub-path testing).
if [ -n "$HALERIUM_ID" ] && [ -z "$BASE_PATH" ]; then
  export BASE_PATH="/apps/${HALERIUM_ID}/${PORT}"
  log "Halerium runner detected — BASE_PATH=$BASE_PATH"
fi

if [ "$MODE" = "dev" ]; then
  log "=== App starting (dev) on port $PORT ==="
  exec pnpm dev
fi

if [ ! -f dist/index.js ] || [ ! -d dist/public ]; then
  log "Building..."
  NODE_OPTIONS="--max-old-space-size=768" pnpm build >> "$LOG" 2>&1
fi

log "=== App starting (prod) on port $PORT ==="
exec pnpm start
