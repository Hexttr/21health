#!/bin/bash
# Добавляет client_max_body_size 25m в nginx конфиг для 21day.club
# Запуск на сервере: sudo bash scripts/patch-nginx-body-limit.sh

CONF="/etc/nginx/sites-available/21day"
if [ ! -f "$CONF" ]; then
  echo "Файл $CONF не найден"
  exit 1
fi
if grep -q "client_max_body_size" "$CONF"; then
  echo "client_max_body_size уже есть в конфиге"
  exit 0
fi
sed -i '/server_name 21day.club/a\    client_max_body_size 25m;' "$CONF"
nginx -t && systemctl reload nginx
echo "Готово. client_max_body_size 25m добавлен."
