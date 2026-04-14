# Деплой на продакшен

## Чек-лист перед запуском

### 1. Переменные окружения

**Корень проекта** (для сборки фронта):
```env
VITE_API_URL="/api"
```
При одном домене фронт и бэк — используйте `/api` (относительный путь).

**server/.env**:
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:5432/21day"
JWT_SECRET="<сгенерируйте-длинную-случайную-строку>"
GEMINI_API_KEY="ваш-ключ-gemini"
PORT=3001
```

⚠️ **JWT_SECRET** — обязательно смените! Например: `openssl rand -base64 32`

### 2. База данных

- PostgreSQL 16+ на сервере
- Создайте БД `21day`
- Выполните миграции и seed:
```bash
cd server
npm run db:migrate
npm run db:seed
```

### 3. Папка uploads

Создайте и дайте права на запись:
```bash
mkdir -p server/uploads/pdfs server/uploads/previews
chmod 755 server/uploads
```

### 4. Сборка и запуск

```bash
# 1. Сборка фронтенда
VITE_API_URL=/api npm run build

# 2. Сборка бэкенда
cd server && npm run build

# 3. Запуск (одним процессом — сервер отдаёт и API, и статику)
cd server && NODE_ENV=production node dist/index.js
```

Или через PM2:
```bash
pm2 start server/dist/index.js --name 21day --env production
pm2 save && pm2 startup
```

### 5. Nginx (опционально, для HTTPS)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/21day-platform/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

С Nginx фронт можно собирать отдельно и класть в `dist/`, а бэкенд — только на 3001.

### 6. HTTPS

Используйте Let's Encrypt (certbot):
```bash
certbot --nginx -d your-domain.com
```

---

## Особенности этой версии

- Платформа бесплатная, дополнительных платежных env-переменных не требуется.
- Нужен только `JWT_SECRET`, доступ к PostgreSQL и ключ Gemini для AI-квиза.
- Новые пользователи регистрируются по email/password и сразу получают полный доступ к курсу.

## Быстрый деплой (без Nginx)

Если фронт и бэк на одном сервере и порту:

1. `VITE_API_URL=/api npm run build`
2. `cd server && npm run build`
3. `NODE_ENV=production node dist/index.js`

Сервер будет отдавать статику из `../dist` и API на `/api`.
