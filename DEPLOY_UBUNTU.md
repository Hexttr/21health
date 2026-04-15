# Деплой `21health` на Ubuntu

Скрипт `deploy_ubuntu.py` автоматизирует установку проекта на новый сервер по SSH.

## Требования

- Python 3.8+
- Paramiko: `pip install -r requirements-deploy.txt`

## Использование

```bash
# Проверка подключения и конфигурации
python deploy_ubuntu.py --check

# Полный деплой
python deploy_ubuntu.py ВАШ_GEMINI_API_KEY
```

Ключ Gemini: https://aistudio.google.com/apikey

## Что ожидает скрипт

- Отдельный каталог приложения, например `/var/www/21health`
- Отдельную PostgreSQL базу, например `21health`
- Node.js, npm, nginx и PM2 на сервере
- Домен, который будет проксироваться на порт `3001`

## Безопасность

- Для production лучше использовать SSH-ключи вместо пароля.
- Учётные данные лучше передавать через `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PASSWORD`.
- После первого запуска обязательно смените пароль администратора.

## После деплоя

- Приложение должно открываться по вашему домену.
- Админ по умолчанию: `admin@example.com / admin123`
- Регистрация пользователей: обычная `email/password`, без инвайтов и соцлогина
- Платёжные интеграции и публичные AI-инструменты в этой версии отсутствуют
