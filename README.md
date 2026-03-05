# 21day-platform

Платформа курсов — 21-дневный курс по AI для помогающих специалистов (психологи, коучи и др.).

## Стек

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Fastify, Drizzle ORM, PostgreSQL
- **AI:** Google Gemini (чат, квиз-тьютор, генерация изображений)

## Быстрый старт

### 1. База данных

**Вариант A: Docker (рекомендуется)**

```bash
# Запустите Docker Desktop, затем:
docker compose up -d
```

**Вариант B:** Создайте PostgreSQL локально или используйте Neon/Railway и базу `21day`.

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
# Заполните DATABASE_URL, JWT_SECRET, GEMINI_API_KEY

npm run db:migrate   # Применить миграции
npm run db:seed      # Создать первый код и админа (admin@example.com / admin123)
npm run dev          # Запуск на :3001
```

### 3. Frontend

```bash
cd ..
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:3001/api

npm run dev          # Запуск на :8080
```

Откройте http://localhost:8080 и войдите как admin@example.com / admin123

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск dev-сервера (порт 8080) |
| `npm run build` | Сборка для production |
| `npm run preview` | Превью production-сборки |
| `npm run lint` | Проверка ESLint |

## Структура проекта

```
src/
├── api/           # Supabase клиент и сервисы
├── components/    # UI-компоненты
├── contexts/     # React contexts (Auth, Progress, Impersonation)
├── hooks/        # Custom hooks
├── pages/        # Страницы и роуты
├── data/         # Статические данные курса
└── lib/          # Утилиты
```

## Репозиторий

https://github.com/Hexttr/21day-platform
