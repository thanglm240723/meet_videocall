#!/usr/bin/env bash
# deploy.ps1 goi script nay tren VPS sau khi upload /tmp/hopmeet-upload
set -euo pipefail
UP=/tmp/hopmeet-upload

set -a; . /etc/hopmeet.env; set +a

echo "== Migrate DB =="
chmod +x "$UP/efbundle"
"$UP/efbundle" --connection "$ConnectionStrings__DefaultConnection"

echo "== BE =="
systemctl stop hopmeet || true
rm -rf /opt/hopmeet/be/*
tar -xzf "$UP/be.tgz" -C /opt/hopmeet/be
chmod +x /opt/hopmeet/be/BE
chown -R hopmeet:hopmeet /opt/hopmeet
systemctl start hopmeet

echo "== FE =="
rm -rf /var/www/hopmeet/*
tar -xzf "$UP/fe.tgz" -C /var/www/hopmeet
find /var/www/hopmeet -type d -exec chmod 755 {} +
find /var/www/hopmeet -type f -exec chmod 644 {} +

rm -rf "$UP"
sleep 3
systemctl --no-pager --lines=15 status hopmeet
