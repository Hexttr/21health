# 21health

Бесплатная образовательная платформа на базе 21-дневного курса по AI для помогающих специалистов.

## Стек

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Fastify, Drizzle ORM, PostgreSQL
- **AI:** Google Gemini для AI-квиза внутри уроков

## Инструкция по запуску

### 1. PostgreSQL

Установите PostgreSQL локально или запустите через Docker:

```bash
docker compose up -d
```

Если PostgreSQL уже установлен — создайте базу `21day` или используйте существующую.

### 2. Backend (первый запуск)

```bash
cd server
npm install
cp .env.example .env
```

Отредактируйте `server/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/21day"
JWT_SECRET="21day-dev-secret-change-in-production"
GEMINI_API_KEY="ваш-ключ-gemini-api"
```

Создайте БД, примените миграции и seed:

```bash
npm run db:create    # Создать БД 21day (если нет)
npm run db:migrate   # Применить миграции
npm run db:seed      # Создать первого администратора
```

### 3. Запуск (каждый раз)

**Терминал 1 — Backend:**

```bash
cd server
npm run dev
```

Сервер запустится на **http://localhost:3001**

**Терминал 2 — Frontend:**

```bash
npm install          # только при первом запуске
npm run dev
```

Приложение откроется на **http://localhost:8080** (или 8081/8082, если порт занят).

### 4. Вход

- **Админ:** admin@example.com / admin123
- **Новые пользователи:** обычная регистрация по email/password, сразу получают роль `student`

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
├── api/           # API-клиент
├── components/    # UI-компоненты
├── contexts/     # React contexts (Auth, Progress, Impersonation)
├── hooks/        # Custom hooks
├── pages/        # Страницы и роуты
├── data/         # Статические данные курса
└── lib/          # Утилиты
```

## Установка на сервер

Подробная инструкция для деплоя: **[SERVER_SETUP.md](./SERVER_SETUP.md)** — пошаговое руководство для ИИ-агента или администратора.

## Что упрощено

- Удалены публичные AI-инструменты.
- Удалены Robokassa, баланс, top-up, paywall и курс-коммерция.
- Удалены referral, waitlist, invitation codes и social login.
- Роли сведены к `admin` и `student`.
- Курс на главной странице показывается сразу списком дней.
