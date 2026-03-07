# Увеличение лимита размера тела запроса для генерации изображений

При ошибке 413 (Payload Too Large) при генерации изображений в NanoBanana добавьте в конфиг nginx:

```nginx
server {
    listen 80;
    server_name 21day.club www.21day.club;
    client_max_body_size 25m;   # <-- добавьте эту строку

    location / {
        ...
    }
}
```

Затем: `sudo nginx -t && sudo systemctl reload nginx`
