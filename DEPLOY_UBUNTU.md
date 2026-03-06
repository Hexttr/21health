# Деплой 21day-platform на Ubuntu (ветка ubuntu)

Скрипт `deploy_ubuntu.py` выполняет установку на сервер через SSH (Paramiko).

## Требования

- Python 3.8+
- Paramiko: `pip install -r requirements-deploy.txt`

## Использование

```bash
# Разведка (проверка подключения и конфигурации сервера)
python deploy_ubuntu.py --check

# Полный деплой (нужен ключ Gemini API)
python deploy_ubuntu.py ВАШ_GEMINI_API_KEY
```

Ключ Gemini: https://aistudio.google.com/apikey

## Безопасность

⚠️ **SSH-пароль в скрипте** — для production рекомендуется:
- Использовать SSH-ключи вместо пароля
- Передавать учётные данные через переменные окружения: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PASSWORD`

## Совместимость с существующими проектами

Скрипт **не затрагивает** NAVORADIO и promo.21day.club:
- Отдельная БД `21day` и пользователь `21day_user`
- Порт приложения: 3001 (nginx проксирует 21day.club)
- Отдельный конфиг nginx: `/etc/nginx/sites-available/21day`

## После деплоя

- Приложение: https://21day.club
- Админ: admin@example.com / admin123 (**смените пароль!**)
- Инвайт-код: ADMIN2025
