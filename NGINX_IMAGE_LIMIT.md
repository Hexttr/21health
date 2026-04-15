# Увеличение лимита размера тела запроса

Если nginx отвечает `413 Payload Too Large` при загрузке файлов, увеличьте лимит тела запроса:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 25m;   # <-- добавьте эту строку

    location / {
        ...
    }
}
```

Затем: `sudo nginx -t && sudo systemctl reload nginx`
