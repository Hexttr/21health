# Установка 21day-platform на сервер

> Подробная инструкция для автоматической установки ИИ-агентом или администратором сервера.

---

## 1. Описание проекта

**21day-platform** — веб-платформа для 21-дневного курса по искусственному интеллекту для помогающих специалистов (психологи, коучи, тарологи и др.).

### Технологический стек

| Компонент | Технология |
|-----------|------------|
| Frontend | Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js 18+, Fastify, Drizzle ORM |
| База данных | PostgreSQL 16+ |
| AI | Google Gemini API (чат, квиз-тьютор, генерация изображений) |

### Архитектура

- **Монорепозиторий**: фронтенд в корне, бэкенд в `server/`
- **Production-режим**: один процесс Node.js отдаёт и API, и статику фронтенда
- **Порт по умолчанию**: 3001

### Структура проекта

```
21day-platform/
├── src/                    # Исходники фронтенда (React)
├── public/                 # Статические файлы (favicon и т.д.)
├── server/                 # Бэкенд (Fastify)
│   ├── src/               # Исходники сервера
│   ├── uploads/           # Загружаемые файлы (создаётся при первом запуске)
│   ├── .env               # Переменные окружения (создать из .env.example)
│   └── dist/              # Скомпилированный бэкенд (после npm run build)
├── dist/                  # Собранный фронтенд (после npm run build)
├── package.json           # Зависимости фронтенда
├── docker-compose.yml     # PostgreSQL в Docker
└── SERVER_SETUP.md        # Этот файл
```

---

## 2. Требования к серверу

- **ОС**: Linux (Ubuntu 20.04+, Debian 11+ и т.п.)
- **Node.js**: 18.x или 20.x (LTS)
- **npm**: 9+
- **PostgreSQL**: 16+ (или Docker для запуска PostgreSQL)
- **Память**: минимум 512 MB RAM
- **Диск**: ~500 MB для приложения + место под uploads и БД

---

## 3. Пошаговая установка

### Шаг 3.1. Клонирование репозитория

```bash
git clone https://github.com/Hexttr/21day-platform.git
cd 21day-platform
```

### Шаг 3.2. Установка Node.js (если не установлен)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка
node -v   # должно быть v18.x или v20.x
npm -v
```

### Шаг 3.3. PostgreSQL

**Вариант A: через Docker**

```bash
docker compose up -d
# БД 21day создаётся автоматически
# Подключение: postgresql://postgres:postgres@localhost:5432/21day
```

**Вариант B: системный PostgreSQL**

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib

# Создание БД и пользователя
sudo -u postgres psql -c "CREATE USER 21day_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE 21day OWNER 21day_user;"
```

### Шаг 3.4. Переменные окружения

**Файл `server/.env`** (обязательно создать):

```bash
cd server
cp .env.example .env
nano .env   # или vi, vim
```

Заполните:

```env
# Обязательные переменные
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/21day"
JWT_SECRET="<СГЕНЕРИРУЙТЕ_СЛУЧАЙНУЮ_СТРОКУ>"
GEMINI_API_KEY="<ВАШ_КЛЮЧ_GOOGLE_GEMINI>"

# Опционально
NODE_ENV=production
PORT=3001
```

**Генерация JWT_SECRET:**

```bash
openssl rand -base64 32
```

**Получение GEMINI_API_KEY:** https://aistudio.google.com/apikey

**Файл `.env` в корне** (для сборки фронтенда):

```bash
cd /path/to/21day-platform
echo 'VITE_API_URL="/api"' > .env
```

При одном домене для фронта и API используйте `VITE_API_URL="/api"` (относительный путь).

### Шаг 3.5. Установка зависимостей

```bash
# В корне проекта
npm install

# В папке server
cd server
npm install
```

### Шаг 3.6. База данных

```bash
cd server

# Создать БД (если используете скрипт; при Docker не требуется)
npm run db:create

# Применить миграции
npm run db:migrate

# Наполнить начальными данными (админ, пригласительный код)
npm run db:seed
```

**Учётные данные после seed:**
- Email: `admin@example.com`
- Пароль: `admin123`
- Пригласительный код для регистрации: `ADMIN2025`

⚠️ **Смените пароль админа после первого входа!**

### Шаг 3.7. Папка uploads

```bash
mkdir -p server/uploads/pdfs server/uploads/previews
chmod -R 755 server/uploads
```

### Шаг 3.8. Сборка

```bash
# Из корня проекта
cd /path/to/21day-platform

# 1. Сборка фронтенда (VITE_API_URL должен быть задан)
VITE_API_URL=/api npm run build

# 2. Сборка бэкенда
cd server
npm run build
```

Результат:
- `dist/` в корне — статика фронтенда
- `server/dist/` — скомпилированный Node.js сервер

### Шаг 3.9. Запуск

```bash
cd server
NODE_ENV=production node dist/index.js
```

Сервер запустится на `http://0.0.0.0:3001`.

**Проверка:**
- `http://SERVER_IP:3001` — должен открыться интерфейс
- `http://SERVER_IP:3001/api` — API (может вернуть 404, это нормально для корня)

---

## 4. Запуск через PM2 (рекомендуется)

```bash
# Установка PM2
npm install -g pm2

# Запуск
cd /path/to/21day-platform/server
pm2 start dist/index.js --name 21day --env production

# Автозапуск при перезагрузке
pm2 save
pm2 startup
```

**Полезные команды:**
- `pm2 status` — статус процессов
- `pm2 logs 21day` — логи
- `pm2 restart 21day` — перезапуск

---

## 5. Nginx (reverse proxy + HTTPS)

### 5.1. Установка Nginx

```bash
sudo apt-get install -y nginx
```

### 5.2. Конфигурация

Создайте `/etc/nginx/sites-available/21day`:

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
sudo ln -s /etc/nginx/sites-available/21day /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5.3. HTTPS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 6. Полный скрипт установки (одной командой)

Выполнять из корня проекта после `git clone`:

```bash
#!/bin/bash
set -e

cd /path/to/21day-platform

# Зависимости
npm install
cd server && npm install && cd ..

# .env для сборки
echo 'VITE_API_URL="/api"' > .env

# server/.env — ЗАПОЛНИТЕ ВРУЧНУЮ перед сборкой!
# cp server/.env.example server/.env

# БД (если Docker уже запущен)
cd server
npm run db:migrate
npm run db:seed
cd ..

# Uploads
mkdir -p server/uploads/pdfs server/uploads/previews

# Сборка
VITE_API_URL=/api npm run build
cd server && npm run build && cd ..

echo "Готово. Запуск: cd server && NODE_ENV=production node dist/index.js"
```

---

## 7. Переменные окружения (справочник)

| Переменная | Где | Обязательная | Описание |
|------------|-----|--------------|----------|
| `VITE_API_URL` | Корень `.env` | Да (при сборке) | URL API для фронта. Продакшен: `/api` |
| `DATABASE_URL` | `server/.env` | Да | PostgreSQL connection string |
| `JWT_SECRET` | `server/.env` | Да | Секрет для JWT. Сгенерировать: `openssl rand -base64 32` |
| `GEMINI_API_KEY` | `server/.env` | Да | Ключ Google Gemini API |
| `NODE_ENV` | `server/.env` | Нет | `production` для прода |
| `PORT` | `server/.env` | Нет | Порт сервера (по умолчанию 3001) |
| `GEMINI_CHAT_MODEL` | `server/.env` | Нет | Модель чата (по умолчанию gemini-2.5-flash) |
| `GEMINI_IMAGE_MODEL` | `server/.env` | Нет | Модель генерации изображений |

---

## 8. Устранение неполадок

### Ошибка: "Cannot find module"
- Выполните `npm install` в корне и в `server/`
- Убедитесь, что `server/dist/` создан после `npm run build`

### Ошибка подключения к БД
- Проверьте `DATABASE_URL` (хост, порт, пользователь, пароль, имя БД)
- Убедитесь, что PostgreSQL запущен: `sudo systemctl status postgresql` или `docker ps`
- Для Docker: хост `localhost`, порт 5432

### Ошибка "JWT_SECRET is required"
- Задайте `JWT_SECRET` в `server/.env`
- Не используйте пустое значение или значение по умолчанию из примеров

### Фронт не загружается / белый экран
- Проверьте, что `VITE_API_URL=/api` был задан при сборке
- Убедитесь, что `dist/` существует в корне и содержит `index.html`
- При Nginx: проверьте `proxy_pass` на `http://127.0.0.1:3001`

### 404 на маршрутах SPA (/login, /admin и т.д.)
- В production-режиме сервер отдаёт `index.html` для неизвестных путей
- Убедитесь, что `NODE_ENV=production` и папка `dist/` есть

### Загрузка файлов не работает
- Проверьте права на `server/uploads/`: `chmod -R 755 server/uploads`
- Убедитесь, что папки `pdfs` и `previews` существуют

---

## 9. Обновление проекта

```bash
cd /path/to/21day-platform
git pull

npm install
cd server && npm install && cd ..

# Миграции (если были изменения схемы)
cd server && npm run db:migrate && cd ..

# Пересборка
VITE_API_URL=/api npm run build
cd server && npm run build && cd ..

# Перезапуск (PM2)
pm2 restart 21day
```

---

## 10. Рекомендации по безопасности

1. **JWT_SECRET** — уникальная случайная строка, не из примеров
2. **Пароль админа** — сменить после первого входа
3. **PostgreSQL** — не открывать порт 5432 наружу; использовать localhost/socket
4. **HTTPS** — обязательно для продакшена (Let's Encrypt)
5. **Файл `.env`** — не коммитить, он в `.gitignore`
6. **Резервные копии** — регулярно делать дамп PostgreSQL
