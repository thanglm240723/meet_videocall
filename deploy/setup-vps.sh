#!/usr/bin/env bash
# Chạy MỘT LẦN trên VPS (đăng nhập root):  bash setup-vps.sh
set -euo pipefail
DOMAIN="103-101-163-250.sslip.io"

# 1. Swap 2GB (VPS chỉ có 1GB RAM)
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Cài PostgreSQL + Caddy, bật firewall
apt update && apt install -y postgresql caddy ufw
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable

# 3. Tạo database + user cho app (mật khẩu ngẫu nhiên)
DB_PASS=$(openssl rand -hex 16)
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='meetroom') THEN
    CREATE ROLE meetroom LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE meetroom PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='meetingdb'" | grep -q 1 \
  || sudo -u postgres createdb -O meetroom meetingdb

# 4. File cấu hình bí mật cho BE
mkdir -p /opt/meetroom
JWT_KEY=$(openssl rand -hex 32)
cat > /etc/meetroom.env <<ENV
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__DefaultConnection=Host=localhost;Database=meetingdb;Username=meetroom;Password=$DB_PASS
Jwt__Key=$JWT_KEY
Daily__ApiKey=DIEN_DAILY_API_KEY_VAO_DAY
ENV
chmod 600 /etc/meetroom.env

# 5. Service chạy BE tự động
cat > /etc/systemd/system/meetroom.service <<UNIT
[Unit]
Description=Meetroom backend
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/meetroom
ExecStart=/opt/meetroom/MeetingsBE
EnvironmentFile=/etc/meetroom.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable meetroom

# 6. Caddy: HTTPS tự động, chuyển hết vào BE (BE tự phục vụ luôn FE)
cat > /etc/caddy/Caddyfile <<CADDY
{
    servers {
        protocols h1 h2
    }
}

$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:5000
}
CADDY
systemctl reload caddy

echo
echo "XONG. Việc còn lại: sửa Daily__ApiKey trong /etc/meetroom.env  (nano /etc/meetroom.env)"
echo "Sau đó chạy deploy/publish.ps1 trên máy Windows."
