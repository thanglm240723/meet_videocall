#!/usr/bin/env bash
# Chay 1 lan tren VPS (root): cai PostgreSQL, tao DB, file bien moi truong, systemd, Caddy.
# Khong dung vao project dang chay va coturn (chi doc secret cua coturn).
set -euo pipefail

DOMAIN="hopmeet.103-101-163-250.sslip.io"
APP_PORT=5080
ENV_FILE=/etc/hopmeet.env
CADDYFILE=/etc/caddy/Caddyfile

echo "== PostgreSQL =="
if ! command -v psql >/dev/null; then
  apt-get update
  apt-get install -y postgresql
fi
PG_CONF_DIR=$(ls -d /etc/postgresql/*/main | tail -1)/conf.d
mkdir -p "$PG_CONF_DIR"
# VPS 1GB RAM: ep Postgres an it bo nho, chi nghe localhost
cat > "$PG_CONF_DIR/hopmeet-lowmem.conf" <<'PG'
listen_addresses = 'localhost'
max_connections = 30
shared_buffers = 64MB
work_mem = 2MB
maintenance_work_mem = 32MB
effective_cache_size = 256MB
PG
systemctl restart postgresql

if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 16)
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='hopmeet'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER ROLE hopmeet PASSWORD '$DB_PASS';"
  else
    sudo -u postgres psql -c "CREATE ROLE hopmeet LOGIN PASSWORD '$DB_PASS';"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='hopmeet'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE hopmeet OWNER hopmeet;"

  TURN_SECRET=$(grep -E '^static-auth-secret=' /etc/turnserver.conf | cut -d= -f2-)
  JWT_KEY=$(openssl rand -base64 48 | tr -d '\n')

  echo "== Tao $ENV_FILE =="
  cat > "$ENV_FILE" <<ENV
ASPNETCORE_ENVIRONMENT="Production"
ASPNETCORE_URLS="http://127.0.0.1:$APP_PORT"
ConnectionStrings__DefaultConnection="Host=127.0.0.1;Port=5432;Database=hopmeet;Username=hopmeet;Password=$DB_PASS"
Jwt__Key="$JWT_KEY"
TURN__Host="103.101.163.250"
TURN__Secret="$TURN_SECRET"
Cors__Origins__0="https://$DOMAIN"
DOTNET_gcServer="0"
DOTNET_GCConserveMemory="5"
ENV
  chmod 600 "$ENV_FILE"
else
  echo "$ENV_FILE da co, giu nguyen"
fi

echo "== User + thu muc =="
id hopmeet >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin hopmeet
mkdir -p /opt/hopmeet/be /var/www/hopmeet
chown -R hopmeet:hopmeet /opt/hopmeet
chmod 755 /var/www/hopmeet

echo "== systemd =="
cat > /etc/systemd/system/hopmeet.service <<UNIT
[Unit]
Description=HOP_MEET API
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/hopmeet/be
ExecStart=/opt/hopmeet/be/BE
EnvironmentFile=$ENV_FILE
User=hopmeet
Restart=always
RestartSec=5
MemoryMax=350M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable hopmeet

echo "== Caddy =="
[ -f "$CADDYFILE" ] || { echo "Khong thay $CADDYFILE - gui output 'systemctl cat caddy' cho minh"; exit 1; }
if ! grep -q "$DOMAIN" "$CADDYFILE"; then
  BAK="$CADDYFILE.bak.$(date +%s)"
  cp "$CADDYFILE" "$BAK"
  cat >> "$CADDYFILE" <<CADDY

# ---- HOP_MEET ----
$DOMAIN {
    encode gzip
    handle /api/* {
        reverse_proxy 127.0.0.1:$APP_PORT
    }
    handle /hubs/* {
        reverse_proxy 127.0.0.1:$APP_PORT
    }
    handle {
        root * /var/www/hopmeet
        try_files {path} /index.html
        file_server
    }
}
CADDY
  if caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    systemctl reload caddy
  else
    cp "$BAK" "$CADDYFILE"
    echo "Caddyfile loi -> da tra lai ban cu, project kia khong bi anh huong"; exit 1
  fi
else
  echo "Caddyfile da co $DOMAIN, bo qua"
fi

echo "== Firewall (chi them khi ufw dang bat) =="
if ufw status | grep -q "Status: active"; then
  ufw allow 3478/udp
  ufw allow 3478/tcp
  ufw allow 49160:49200/udp
fi

echo "Xong. Gio chay deploy.ps1 tren Windows de day code len."
