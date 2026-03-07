# 21day-platform — Описание production-проекта

Платформа онлайн-курса «21 день с ИИ» для помогающих специалистов (психологи, тарологи, коучи и др.). Курс состоит из 21 урока в 3 неделях, встроенные AI-инструменты (чат, генерация изображений), биллинг и пополнение баланса.

**URL:** https://21day.club  
**Репозиторий:** https://github.com/Hexttr/21day-platform  
**Ветка деплоя:** `ubuntu`

---

## 1. Структура проекта

```
21day-platform/
├── src/                    # Frontend (React, Vite)
│   ├── components/         # UI-компоненты
│   ├── contexts/          # AuthContext, ProgressContext, BalanceContext, ChatContext, ImpersonationContext
│   ├── pages/             # Страницы приложения
│   ├── data/              # courseData.ts — статическая структура курса (21 урок)
│   └── api/               # API-клиент
├── server/                 # Backend (Fastify, Node.js)
│   ├── src/
│   │   ├── db/            # Drizzle ORM, schema, migrations, seed
│   │   ├── routes/        # API-маршруты
│   │   ├── lib/           # auth, billing, robokassa, provider-keys
│   │   └── uploads/       # PDF, превью (nginx/static)
│   └── dist/              # Скомпилированный сервер
├── dist/                   # Собранный фронтенд (Vite build)
├── deploy_ubuntu.py        # Полный деплой на сервер
├── deploy_update.py       # Быстрое обновление (git pull + build + pm2 restart)
└── docs/
```

---

## 2. База данных (PostgreSQL)

Схема: `server/src/db/schema.ts` (Drizzle ORM).

### 2.1 Пользователи и роли

| Таблица | Описание |
|--------|----------|
| `users` | id, email, passwordHash, name, invitationCodeId, isBlocked, blockedAt |
| `user_roles` | userId, role (`admin` \| `student` \| `ai_user`). Один пользователь — одна роль. |
| `invitation_codes` | code, comment, isActive — пригласительные коды для регистрации |

**Регистрация:** только по пригласительному коду. Новые пользователи получают роль `student`.

### 2.2 Курс и уроки

| Таблица | Описание |
|--------|----------|
| `lesson_content` | lessonId (1–21), customDescription, videoUrls[], videoPreviewUrls[], pdfUrls[], additionalMaterials, aiPrompt, isPublished |

- **lessonId** — целое число 1–21, соответствует `courseData.ts`.
- Контент уроков (видео, PDF) хранится в БД; файлы — в `server/uploads/`.

### 2.3 Прогресс студентов

| Таблица | Описание |
|--------|----------|
| `student_progress` | userId, lessonId, completed, quizCompleted, completedAt |

Уникальный индекс: (userId, lessonId). Одна запись на урок на пользователя.

### 2.4 Практические материалы

| Таблица | Описание |
|--------|----------|
| `practical_materials` | title, description, videoUrl, previewUrl, sortOrder, isPublished |

Отдельные видео-материалы (не привязаны к урокам).

### 2.5 Биллинг и AI

| Таблица | Описание |
|--------|----------|
| `ai_providers` | name, displayName, apiKeyEnv — провайдеры (Gemini и др.) |
| `ai_models` | providerId, modelKey, displayName, modelType (text \| image), inputPricePer1k, outputPricePer1k, fixedPrice, sortOrder |
| `user_balances` | userId, balance — баланс пользователя |
| `balance_transactions` | userId, amount, type (topup \| ai_usage \| bonus \| refund), description, balanceAfter |
| `ai_usage_log` | userId, modelId, requestType (chat \| image \| quiz), inputTokens, outputTokens, baseCost, finalCost, isFree |
| `payments` | userId, invId, amount, status (pending \| completed \| failed) — Robokassa |
| `platform_settings` | key-value: markup_percent, daily_free_requests, min_topup_amount, max_topup_amount, free_for_admins |

**Seed:** `npm run db:seed` — пользователи, коды; `npm run db:seed-billing` — провайдеры, модели, настройки.

---

## 3. Уроки (курс)

### 3.1 Структура

- **Фронтенд:** `src/data/courseData.ts` — статическая структура: 3 недели × 7 уроков = 21 урок.
- **Бэкенд:** `lesson_content` — медиа и метаданные (видео, PDF, aiPrompt).

Связь: `lesson_content.lessonId` (1–21) ↔ `courseData.lessons[].id`.

### 3.2 Недели

1. **Неделя 1:** Основы ИИ, промпт-инженеринг, контент, маркетинг, визуал, исследования, стартапы (уроки 1–7).
2. **Неделя 2:** Клиенты, видео, озвучка, email, соцсети, RAG, практикум (уроки 8–14).
3. **Неделя 3:** No-code, аналитика, персональный GPT, личный бренд, специализация, этика, финал (уроки 15–21).

### 3.3 API уроков

- `GET /api/lessons` — список опубликованных уроков (admin, student).
- `GET /api/lessons/:lessonId` — один урок.
- `GET /api/admin/lessons` — все уроки (только admin).
- `PUT /api/admin/lessons` — создание/обновление урока.

**ai_user:** доступ к урокам запрещён (403).

---

## 4. Инструменты ИИ

### 4.1 Страницы (фронтенд)

| URL | Инструмент | modelPath | Назначение |
|-----|------------|-----------|------------|
| `/chatgpt` | ChatGPT | chatgpt | Текстовый чат |
| `/gemini` | Gemini | gemini | Текстовый чат |
| `/nanobanana` | NanoBanana 3 Pro | nanobanana | Генерация изображений |

Все три доступны в сайдбаре в блоке «Инструменты ИИ».

### 4.2 API

- `POST /api/ai/chat` — стриминг чата (текст). Тело: `{ messages, modelId? }`.
- `POST /api/ai/image` — генерация изображений. Тело: `{ prompt, modelId? }`.
- `POST /api/ai/quiz` — генерация теста по уроку (для student).
- `GET /api/ai/models` — список моделей Gemini (для админки).

Модели берутся из `ai_models`; при отсутствии modelId — дефолтная (первая активная по sortOrder).

### 4.3 Биллинг AI

- **Бесплатно:** N запросов в день (platform_settings.daily_free_requests, по умолчанию 10).
- **Платно:** списание с баланса. Стоимость = базовая × (1 + markup_percent/100).
- **Админы:** при free_for_admins=1 — безлимит бесплатно.

Текстовые модели: inputPricePer1k, outputPricePer1k за токены.  
Изображения: fixedPrice за картинку.

---

## 5. Роли и доступы

### 5.1 Роли

| Роль | Описание |
|------|----------|
| `admin` | Полный доступ: админка, уроки, AI, биллинг, смена ролей |
| `student` | Курс (21 урок), AI-инструменты, пополнение баланса, прогресс |
| `ai_user` | Только AI-инструменты и пополнение баланса. **Нет доступа к урокам и практическим материалам.** |

### 5.2 Матрица доступа

| Функция | admin | student | ai_user |
|---------|-------|---------|---------|
| Dashboard (прогресс) | ✓ | ✓ | ✗ (редирект на /chatgpt) |
| Уроки | ✓ | ✓ | ✗ 403 |
| Прогресс (PUT) | ✓ | ✓ | ✗ 403 |
| Практические материалы | ✓ | ✓ | ✗ 403 |
| AI Chat / Image | ✓ | ✓ | ✓ |
| Пополнение баланса | ✓ | ✓ | ✓ |
| Админка | ✓ | ✗ | ✗ |
| Смена роли | — | — | Только через admin |

### 5.3 Смена роли

- **Эндпоинт:** `POST /api/admin/set-role`  
- **Тело:** `{ userId, role: 'admin' | 'student' | 'ai_user' }`  
- **Доступ:** только admin.  
- **UI:** Админка → Студенты → выпадающий список «Роль» в каждой строке.

Пользователи с ролью `ai_user` создаются только через смену роли в админке (регистрация всегда даёт `student`).

### 5.4 Impersonation

Админ может «войти как» студент: `startImpersonation({ user_id, name, email })`. API-запросы идут от имени выбранного пользователя (getEffectiveUserId). Используется для просмотра прогресса и интерфейса от лица студента.

---

## 6. API-маршруты (сводка)

### Auth
- `POST /api/auth/validate-code` — проверка пригласительного кода
- `POST /api/auth/signup` — регистрация (код обязателен)
- `POST /api/auth/signin` — вход
- `GET /api/auth/me` — текущий пользователь (JWT)

### Уроки
- `GET /api/lessons`, `GET /api/lessons/:lessonId`
- `GET /api/admin/lessons`, `PUT /api/admin/lessons`

### Прогресс
- `GET /api/progress` — прогресс текущего пользователя
- `PUT /api/progress` — обновление (completed, quizCompleted)

### Материалы
- `GET /api/materials` — практические материалы

### AI
- `POST /api/ai/chat`, `POST /api/ai/image`, `POST /api/ai/quiz`
- `GET /api/ai/models`

### Биллинг
- `GET /api/balance` — баланс
- `GET /api/balance/transactions`, `GET /api/balance/usage`
- `POST /api/payments/create` — создание платежа (редирект на Robokassa)
- ResultURL/SuccessURL Robokassa — колбэки

### Админка
- `GET /api/admin/users` — все пользователи с прогрессом и ролью
- `POST /api/admin/block-user`, `POST /api/admin/unblock-user`
- `POST /api/admin/set-role` — смена роли
- `POST /api/admin/users/update-name`
- `POST /api/admin/reset-password`
- Управление кодами, листом ожидания, биллингом

### Прочее
- `POST /api/waitlist` — запись в лист ожидания
- `GET /api/codes` — коды (admin)

---

## 7. Деплой

### Быстрое обновление
```bash
python deploy_update.py
```
Выполняет: git pull (ветка ubuntu), npm run build (frontend), npm run build (server), pm2 restart 21day.

### Полный деплой
```bash
python deploy_ubuntu.py GEMINI_API_KEY
```
Устанавливает Node.js, PostgreSQL, клонирует репозиторий, настраивает .env, nginx, PM2, certbot.

**Сервер:** 195.133.63.34, порт 3001, nginx проксирует 21day.club.

---

## 8. Важные файлы

| Файл | Назначение |
|------|------------|
| `server/src/db/schema.ts` | Схема БД |
| `server/src/lib/auth.ts` | JWT, getAuthFromRequest, типы ролей |
| `server/src/lib/billing.ts` | Баланс, бесплатные запросы, списание |
| `src/data/courseData.ts` | Структура курса (21 урок) |
| `src/contexts/AuthContext.tsx` | Текущий пользователь, роль |
| `src/pages/Index.tsx` | Редирект ai_user → /chatgpt |
| `src/components/AppSidebar.tsx` | Навигация, скрытие «Мой прогресс» для ai_user |
| `src/pages/admin/AdminStudents.tsx` | Список студентов, Select смены роли |

---

## 9. Контексты и провайдеры (frontend)

- **AuthProvider** — user, signIn, signUp, signOut, isAdmin
- **ProgressProvider** — прогресс по урокам, getCompletedCount, getProgressPercentage
- **BalanceProvider** — баланс пользователя
- **ChatContextProvider** — история чатов по modelPath, clearChat
- **ImpersonationProvider** — режим «просмотр от имени» (admin)

---

*Документ обновлён: март 2025*
