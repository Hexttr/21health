# Установка `21health` на сервер

## 1. Что это за проект

`21health` — упрощённая обучающая платформа с 21 уроком, прогрессом студентов, админкой и AI-квизом внутри уроков.

### Стек

| Компонент | Технология |
|-----------|------------|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js 18+, Fastify, Drizzle ORM |
| База данных | PostgreSQL 16+ |
| AI | Google Gemini API только для quiz/tutor flow |

### Что важно про эту версию

- Публичные AI-инструменты удалены.
- Платежи, баланс, referral, waitlist, invitation codes и social login удалены.
- Есть только роли `admin` и `student`.
- Новый пользователь сразу получает полный доступ к курсу.

## 2. Требования

- Ubuntu 20.04+ или Debian 11+
- Node.js 18+ или 20+
- npm 9+
- PostgreSQL 16+
- Домен или IP для доступа к приложению

## 3. Установка

### 3.1. Клонирование

```bash
git clone https://github.com/Hexttr/21health.git
cd 21health
```

### 3.2. Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

### 3.3. PostgreSQL

**Вариант A: Docker**

```bash
docker compose up -d
```

**Вариант B: системный PostgreSQL**

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER health_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE 21health OWNER health_user;"
```

### 3.4. Переменные окружения

Создайте `server/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/21health"
JWT_SECRET="<СЛУЧАЙНАЯ_СТРОКА>"
GEMINI_API_KEY="<ВАШ_GEMINI_API_KEY>"
NODE_ENV=production
PORT=3001
```

Создайте корневой `.env` для фронтенда:

```env
VITE_API_URL="/api"
```

### 3.5. Установка зависимостей

```bash
npm install
cd server
npm install
```

### 3.6. Миграции и seed

```bash
cd server
npm run db:migrate
npm run db:seed
```

После `seed` создаётся администратор:

- `admin@example.com`
- `admin123`

### 3.7. Папка `uploads`

```bash
mkdir -p server/uploads/pdfs server/uploads/previews
chmod -R 755 server/uploads
```

### 3.8. Сборка

```bash
cd /path/to/21health
VITE_API_URL=/api npm run build
cd server
npm run build
```

### 3.9. Запуск

```bash
cd /path/to/21health/server
NODE_ENV=production node dist/index.js
```

## 4. PM2

```bash
npm install -g pm2
cd /path/to/21health/server
pm2 start dist/index.js --name 21health --env production
pm2 save
pm2 startup
```

Полезные команды:

- `pm2 status`
- `pm2 logs 21health`
- `pm2 restart 21health`

## 5. Nginx

Создайте конфиг, например `/etc/nginx/sites-available/21health`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активация:

```bash
sudo ln -s /etc/nginx/sites-available/21health /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 6. Обновление проекта

```bash
cd /path/to/21health
git pull
npm install
cd server
npm install
npm run db:migrate
npm run build
cd ..
VITE_API_URL=/api npm run build
pm2 restart 21health
```

## 7. Устранение неполадок

- Если не находится модуль, выполните `npm install` в корне и в `server/`.
- Если сервер не видит БД, перепроверьте `DATABASE_URL`.
- Если белый экран на фронте, убедитесь, что при сборке был задан `VITE_API_URL=/api`.
- Если не работают загрузки, проверьте наличие и права у `server/uploads`.

## 8. Безопасность

1. Сразу смените пароль администратора.
2. Используйте уникальный `JWT_SECRET`.
3. Не открывайте PostgreSQL наружу без необходимости.
4. Настройте HTTPS.
5. Не коммитьте `.env`.
