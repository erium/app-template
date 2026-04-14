#!/bin/bash
# CONFIGURATION
DB_ROOT="."
DATA_DIR="$DB_ROOT/pg-data"
LOG_FILE="$DB_ROOT/pg.log"
PORT=5432
DB_NAME="app_db"
DB_USER="app"
DB_PASS="app"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

find_pg_bin() {
    # Try PATH first
    if command -v pg_ctl &> /dev/null; then
        dirname "$(command -v pg_ctl)"
        return
    fi
    # Find the latest installed PostgreSQL version
    local pg_dir
    pg_dir=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
    if [ -n "$pg_dir" ]; then
        echo "$pg_dir"
        return
    fi
    echo ""
}

setup() {
    echo -e "${YELLOW}--- PostgreSQL Setup (Directory: $DB_ROOT) ---${NC}"

    # 1. Installation check
    PG_BIN=$(find_pg_bin)
    if [ -z "$PG_BIN" ]; then
        echo "Installing PostgreSQL..."
        sudo apt-get update && sudo apt-get install -y postgresql postgresql-client
        PG_BIN=$(find_pg_bin)
    fi

    if [ -z "$PG_BIN" ]; then
        echo -e "${RED}Error: Could not find PostgreSQL binaries after install.${NC}"
        exit 1
    fi

    echo "Using PostgreSQL binaries from: $PG_BIN"

    # Stop system-managed PostgreSQL if running (we manage our own instance)
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        echo "Stopping system PostgreSQL service..."
        sudo systemctl stop postgresql
        sudo systemctl disable postgresql 2>/dev/null
    fi

    # 2. Initialization check
    if [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
        mkdir -p "$DATA_DIR"
        echo "Initializing database in $DATA_DIR..."
        "$PG_BIN/initdb" -D "$(readlink -f "$DATA_DIR")" --auth=trust --encoding=UTF8 --no-locale
    else
        echo "Data already present."
    fi

    # 3. Running check
    if "$PG_BIN/pg_ctl" -D "$(readlink -f "$DATA_DIR")" status &> /dev/null; then
        echo -e "${GREEN}PostgreSQL is already running.${NC}"
        ensure_db_and_user
        exit 0
    fi

    # 4. Configure PostgreSQL to use our port and allow local connections
    CONF_FILE="$DATA_DIR/postgresql.conf"
    HBA_FILE="$DATA_DIR/pg_hba.conf"

    # Set port
    sed -i "s/^#\?port = .*/port = $PORT/" "$CONF_FILE"

    # Listen on localhost
    sed -i "s/^#\?listen_addresses = .*/listen_addresses = '127.0.0.1'/" "$CONF_FILE"

    # Use project directory for Unix socket (avoids /var/run/postgresql permission issues)
    sed -i "s|^#\?unix_socket_directories = .*|unix_socket_directories = '$(readlink -f "$DATA_DIR")'|" "$CONF_FILE"

    # Allow password auth for local TCP connections
    if ! grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$HBA_FILE"; then
        echo "host    all    all    127.0.0.1/32    md5" >> "$HBA_FILE"
    fi

    # 5. Start server
    echo "Starting PostgreSQL on port $PORT..."
    "$PG_BIN/pg_ctl" -D "$(readlink -f "$DATA_DIR")" -l "$(readlink -f "$LOG_FILE")" -o "-p $PORT" start

    # Wait for server to start
    for i in {1..30}; do
        if "$PG_BIN/pg_isready" -p "$PORT" -h 127.0.0.1 &> /dev/null; then
            echo -e "${GREEN}PostgreSQL started on port $PORT!${NC}"
            ensure_db_and_user
            echo ""
            echo -e "${GREEN}Connection string:${NC}"
            echo "  DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:$PORT/$DB_NAME"
            exit 0
        fi
        sleep 1
    done

    echo -e "${RED}Error: Failed to start PostgreSQL. Check $LOG_FILE for details.${NC}"
    exit 1
}

ensure_db_and_user() {
    PG_BIN=$(find_pg_bin)

    # Create user if not exists
    if ! "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" postgres 2>/dev/null | grep -q 1; then
        echo "Creating user '$DB_USER'..."
        "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" postgres
    fi

    # Create database if not exists
    if ! "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" postgres 2>/dev/null | grep -q 1; then
        echo "Creating database '$DB_NAME'..."
        "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" postgres
    fi

    # Grant privileges
    "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" postgres 2>/dev/null

    echo -e "${GREEN}Database '$DB_NAME' and user '$DB_USER' are ready.${NC}"
}

uninstall() {
    echo -e "${YELLOW}--- PostgreSQL Uninstall ---${NC}"

    PG_BIN=$(find_pg_bin)

    # 1. Stop the server if running
    if [ -n "$PG_BIN" ] && [ -d "$DATA_DIR" ] && "$PG_BIN/pg_ctl" -D "$(readlink -f "$DATA_DIR")" status &> /dev/null; then
        echo "Stopping PostgreSQL..."
        "$PG_BIN/pg_ctl" -D "$(readlink -f "$DATA_DIR")" stop
        echo -e "${GREEN}PostgreSQL stopped.${NC}"
    else
        echo "PostgreSQL is not running."
    fi

    # 2. Remove log file
    rm -f "$LOG_FILE"

    # 3. Optionally remove database data
    if [ -d "$DATA_DIR" ] && [ -n "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
        read -p "Do you also want to remove the database data in $DATA_DIR? (y/N) " answer
        if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
            rm -rf "$DATA_DIR"
            echo -e "${GREEN}Database data removed.${NC}"
        else
            echo "Keeping database data."
        fi
    fi

    # 4. Stop system service if active
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        echo "Stopping system PostgreSQL service..."
        sudo systemctl stop postgresql
        sudo systemctl disable postgresql
    fi

    # 5. Uninstall PostgreSQL
    if [ -n "$PG_BIN" ]; then
        echo "Uninstalling PostgreSQL..."
        sudo apt-get remove --purge -y 'postgresql*'
        echo "Removing leftover packages..."
        sudo apt-get autoremove --purge -y
        echo -e "${GREEN}PostgreSQL uninstalled.${NC}"
    else
        echo "PostgreSQL is not installed."
    fi
}

case "${1:-setup}" in
    setup)
        setup
        ;;
    uninstall)
        uninstall
        ;;
    *)
        echo "Usage: $0 {setup|uninstall}"
        exit 1
        ;;
esac
