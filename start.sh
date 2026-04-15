#!/bin/bash
# Template bootstrap for ephemeral runners (e.g. Halerium App runners).
# Handles: Node upgrade, pnpm install, Postgres install + daemon, stale PID cleanup,
# schema push, seed, build, and launch.
#
# Usage: bash start.sh [PORT]      # defaults to 8497
# See DEPLOYMENT.md for environment assumptions and runner-type guidance.

set -e

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$APP_DIR"

LOG="${APP_DIR}/app-startup.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== App Startup ==="
echo "Date: $(date)"
echo "Dir:  $APP_DIR"

# 1. Node >= 20 (Halerium runners ship v17).
NODE_VER=$(node --version 2>/dev/null || echo "none")
echo "Current Node: $NODE_VER"
if [[ "$NODE_VER" < "v20" ]]; then
  echo "Upgrading Node to v20..."
  npm install -g n 2>&1 | tail -1
  sudo n 20 2>&1 | tail -3
  hash -r 2>/dev/null || true
  export PATH="/usr/local/bin:$PATH"
  echo "Node now: $(node --version)"
fi

# 2. pnpm
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm@10 2>&1 | tail -1
fi

# 3. PostgreSQL (not preinstalled on Halerium runners).
if ! ls /usr/lib/postgresql/*/bin/pg_ctl &>/dev/null 2>&1; then
  echo "Installing PostgreSQL..."
  sudo apt-get update -qq 2>&1 | tail -1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client 2>&1 | tail -3
fi

PG_BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
if [ -z "$PG_BIN" ]; then
  echo "ERROR: PostgreSQL installation failed."
  exit 1
fi
echo "PG_BIN: $PG_BIN"

PG_DATA="$APP_DIR/pg-data"

# 4. initdb on first boot
if [ ! -d "$PG_DATA" ] || [ -z "$(ls -A "$PG_DATA" 2>/dev/null)" ]; then
  mkdir -p "$PG_DATA"
  echo "Initializing database cluster..."
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
    echo "Removing stale postmaster.pid..."
    rm -f "$PG_DATA/postmaster.pid"
  fi
fi

# Avoid conflicts with a system Postgres on the same port
sudo systemctl stop postgresql 2>/dev/null || true

if ! "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  echo "Starting PostgreSQL..."
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/pg.log" -o "-p 5432" start -w -t 30
fi

# 6. App role + database
"$PG_BIN/psql" -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_roles WHERE rolname='app'" postgres 2>/dev/null | grep -q 1 \
  || "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "CREATE USER app WITH PASSWORD 'app';" postgres 2>/dev/null || true
"$PG_BIN/psql" -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_database WHERE datname='app_db'" postgres 2>/dev/null | grep -q 1 \
  || "$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "CREATE DATABASE app_db OWNER app;" postgres 2>/dev/null || true
"$PG_BIN/psql" -h 127.0.0.1 -p 5432 -c "GRANT ALL PRIVILEGES ON DATABASE app_db TO app;" postgres 2>/dev/null || true
echo "PostgreSQL ready."

# 7. Dependencies + schema + seed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -3
fi
echo "Pushing schema..."
pnpm db:push 2>&1 || true
echo "Seeding..."
pnpm db:seed 2>&1 || true

# 8. Build if not already built
if [ ! -f dist/index.js ] || [ ! -d dist/public ]; then
  echo "Building..."
  NODE_OPTIONS="--max-old-space-size=768" pnpm build 2>&1
fi

# 9. Run
PORT="${1:-8497}"
echo "=== App starting on port $PORT ==="
NODE_ENV=production exec node dist/index.js "$PORT"
