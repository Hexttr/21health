# Деплой на продакшен

## Чек-лист перед запуском

### 1. Переменные окружения

**Корень проекта**:
```env
VITE_API_URL="/api"
```

**`server/.env`**:
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:5432/21health"
JWT_SECRET="<сгенерируйте-длинную-случайную-строку>"
GEMINI_API_KEY="ваш-ключ-gemini"
PORT=3001
```

`JWT_SECRET` должен быть уникальным. Пример генерации: `openssl rand -base64 32`

### 2. База данных

- Нужен PostgreSQL 16+.
- Создайте отдельную БД, например `21health`.
- Примените миграции и начальный seed:

```bash
cd server
npm run db:migrate
npm run db:seed
```

### 3. Папка `uploads`

```bash
mkdir -p server/uploads/pdfs server/uploads/previews
chmod -R 755 server/uploads
```

### 4. Сборка и запуск

```bash
# в корне проекта
VITE_API_URL=/api npm run build

# в папке server
npm run build
NODE_ENV=production node dist/index.js
```

Или через PM2:

```bash
pm2 start server/dist/index.js --name 21health --env production
pm2 save
pm2 startup
```

### 5. Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/21health/dist;
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

### 6. HTTPS

```bash
certbot --nginx -d your-domain.com
```

## Особенности текущей версии

- Платформа полностью бесплатная.
- Публичные AI-инструменты, платежи, баланс, referral, waitlist, invitation codes и social login удалены.
- Новые пользователи регистрируются по email/password и сразу получают полный доступ к курсу.
- Из AI-функциональности остаётся только quiz/tutor flow внутри уроков.

## Деплой с ПК (`deploy_update.py`), сервер без выхода в интернет

Если продакшен-сервер **не может** ходить в GitHub и в npm registry, код и зависимости собираются **на вашем ПК** (где есть интернет), затем передаются по SSH.

В `deploy.local` укажите:

```env
DEPLOY_CODE_SOURCE=local
```

При необходимости явно отключите подкачку модели Ollama на сервере (на сервере тоже нет интернета):

```env
DEPLOY_SKIP_OLLAMA_SETUP=1
```

Запуск с машины разработчика (VPN к сети сервера):

```bash
pip install -r requirements-deploy.txt
python deploy_update.py
```

Скрипт выполнит локально `npm ci`, сборку фронта и бэка, упакует проект (включая `node_modules` и `dist`) в архив, выгрузит на сервер и распакует в `DEPLOY_DIR`. Файл `server/.env` на сервере при обновлении **сохраняется** (из репозитория на сервер не подменяется).

URL приложения смотрите в **`BASE_URL`** в том же `deploy.local` (пример: `http://172.16.8.78`).

## Быстрый деплой

```bash
VITE_API_URL=/api npm run build
cd server
npm run build
NODE_ENV=production node dist/index.js
```
