#!/usr/bin/env python3
"""
Скрипт деплоя 21day-platform на Ubuntu-сервер через SSH (Paramiko).
Не затрагивает NAVORADIO и promo.21day.club — использует отдельную БД и порт 3001.
"""

import os
import sys

try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)

# === Конфигурация (можно переопределить через переменные окружения) ===
SSH_HOST = os.environ.get("DEPLOY_SSH_HOST", "195.133.63.34")
SSH_USER = os.environ.get("DEPLOY_SSH_USER", "root")
SSH_PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "hdp-k.PD6u8K7U")
SSH_PORT = int(os.environ.get("DEPLOY_SSH_PORT", "22"))

# Обязательно задать: GEMINI_API_KEY (env или аргумент)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Путь на сервере
DEPLOY_DIR = "/var/www/21day-platform"
REPO_URL = "https://github.com/Hexttr/21day-platform.git"
BRANCH = "ubuntu"

# Порт приложения (не конфликтует с NAVORADIO/promo — они обычно на 80/443 через nginx)
APP_PORT = 3001


def run_ssh(ssh: paramiko.SSHClient, cmd: str, check: bool = True) -> tuple[str, str, int]:
    """Выполнить команду по SSH и вернуть (stdout, stderr, exit_code)."""
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if check and exit_code != 0:
        raise RuntimeError(f"Команда завершилась с кодом {exit_code}:\n{cmd}\nstdout: {out}\nstderr: {err}")
    return out, err, exit_code


def run_ssh_stream(ssh: paramiko.SSHClient, cmd: str) -> None:
    """Выполнить команду и выводить вывод в реальном времени."""
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    for line in iter(stdout.readline, ""):
        # Windows cp1251 не поддерживает все Unicode — заменяем проблемные символы
        safe = line.encode("ascii", errors="replace").decode("ascii")
        print(safe, end="", flush=True)
    exit_code = stdout.channel.recv_exit_status()
    if exit_code != 0:
        raise RuntimeError(f"Команда завершилась с кодом {exit_code}")


def main():
    global GEMINI_API_KEY
    check_only = "--check" in sys.argv or "-c" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if args:
        GEMINI_API_KEY = args[0]
    # GEMINI_API_KEY не обязателен при повторном деплое — возьмём с сервера

    print("=== Развёртывание 21day-platform на 21day.club ===\n")
    print("Подключение к серверу...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD, timeout=30)
    except Exception as e:
        print(f"Ошибка подключения: {e}")
        sys.exit(1)

    try:
        # --- 1. Разведка: не затронем ли существующие проекты ---
        print("\n--- 1. Проверка существующей конфигурации ---")
        if check_only:
            print("(режим --check: только разведка, деплой не выполняется)")
        out, _, _ = run_ssh(client, "ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true", check=False)
        print("Nginx sites-enabled:", out.strip() or "(пусто)")

        out, _, _ = run_ssh(client, "ss -tlnp 2>/dev/null | grep -E ':(80|443|3001|3002)' || true", check=False)
        print("Занятые порты (80,443,3001,3002):", out.strip() or "(ничего)")

        out, _, _ = run_ssh(client, "node -v 2>/dev/null || echo 'Node не установлен'", check=False)
        print("Node.js:", out.strip())

        out, _, _ = run_ssh(client, "psql --version 2>/dev/null || echo 'PostgreSQL не установлен'", check=False)
        print("PostgreSQL:", out.strip())

        if check_only:
            print("\n--- Разведка завершена. Для полного деплоя запустите без --check ---")
            return

        # --- 2. Установка Node.js 20 (если нет) ---
        print("\n--- 2. Node.js ---")
        out, _, code = run_ssh(client, "node -v 2>/dev/null", check=False)
        if code != 0 or "v18" not in out and "v20" not in out and "v22" not in out:
            print("Установка Node.js 20...")
            run_ssh_stream(client, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs")
        else:
            print(f"Node.js уже установлен: {out.strip()}")

        # --- 3. PostgreSQL: создание БД и пользователя ---
        print("\n--- 3. PostgreSQL ---")
        out, _, _ = run_ssh(client, r'''sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='21day'" 2>/dev/null || echo ""''', check=False)
        db_exists = "1" in out
        if not db_exists:
            db_password = "21day_" + os.urandom(8).hex()
            print("Создание БД 21day и пользователя 21day_user...")
            run_ssh(client, f"sudo -u postgres psql -c \"CREATE USER 21day_user WITH PASSWORD '{db_password}';\" 2>/dev/null || true")
            run_ssh(client, 'sudo -u postgres psql -c "CREATE DATABASE 21day OWNER 21day_user;" 2>/dev/null || true')
            run_ssh(client, 'sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE 21day TO 21day_user;" 2>/dev/null || true')
            print("БД создана.")
        else:
            print("БД 21day уже существует. Используем существующий server/.env.")
            out, _, _ = run_ssh(client, f"grep DATABASE_URL {DEPLOY_DIR}/server/.env 2>/dev/null || true", check=False)
            if "DATABASE_URL" in out:
                db_password = "PRESERVED"  # не перезаписываем
            else:
                db_password = "21day_" + os.urandom(8).hex()

        # --- 4. Клонирование/обновление репозитория ---
        print("\n--- 4. Репозиторий ---")
        run_ssh(client, f"mkdir -p {DEPLOY_DIR}")
        out, _, code = run_ssh(client, f"test -d {DEPLOY_DIR}/.git && echo yes || echo no", check=False)
        if "yes" in out:
            run_ssh(client, f"cd {DEPLOY_DIR} && git fetch origin && (git checkout {BRANCH} 2>/dev/null || git checkout -b {BRANCH} origin/{BRANCH}) && git pull origin {BRANCH}")
        else:
            run_ssh(client, f"git clone -b {BRANCH} {REPO_URL} {DEPLOY_DIR} 2>/dev/null || git clone -b master {REPO_URL} {DEPLOY_DIR}")
            run_ssh(client, f"cd {DEPLOY_DIR} && (git checkout {BRANCH} 2>/dev/null || git checkout -b {BRANCH} origin/{BRANCH} 2>/dev/null || true)")

        # --- 5. server/.env ---
        print("\n--- 5. Переменные окружения ---")
        jwt_secret_out, _, _ = run_ssh(client, "openssl rand -base64 32", check=False)
        jwt_secret = jwt_secret_out.strip() or "21day-dev-secret-change-in-production"

        # Сохраняем DATABASE_URL и GEMINI_API_KEY из существующего .env
        existing_env, _, _ = run_ssh(client, f"cat {DEPLOY_DIR}/server/.env 2>/dev/null || true", check=False)
        db_url_line = f'DATABASE_URL="postgresql://21day_user:{db_password}@localhost:5432/21day"'
        gemini_key = GEMINI_API_KEY
        if "DATABASE_URL=" in existing_env:
            for line in existing_env.splitlines():
                s = line.strip()
                if s.startswith("DATABASE_URL="):
                    db_url_line = s
                    break
        if db_password == "PRESERVED":
            pass  # уже подхватили выше
        elif "DATABASE_URL=" not in existing_env:
            db_url_line = 'DATABASE_URL="postgresql://21day_user:CHANGE_ME@localhost:5432/21day"'
            print("Внимание: БД существует, но server/.env не найден. Задайте DATABASE_URL вручную после деплоя.")
        if not gemini_key and "GEMINI_API_KEY=" in existing_env:
            for line in existing_env.splitlines():
                s = line.strip()
                if s.startswith("GEMINI_API_KEY="):
                    gemini_key = s.split("=", 1)[1].strip().strip('"').strip("'")
                    break
            if gemini_key:
                print("Используем GEMINI_API_KEY с сервера (повторный деплой)")
        if not gemini_key:
            print("Ошибка: GEMINI_API_KEY не задан и не найден на сервере. Первый деплой? Передайте ключ: python deploy_ubuntu.py ВАШ_КЛЮЧ")
            sys.exit(1)

        env_content = f"""# 21day-platform production
{db_url_line}
JWT_SECRET="{jwt_secret}"
GEMINI_API_KEY="{gemini_key}"
NODE_ENV=production
PORT={APP_PORT}
"""
        run_ssh(client, f"mkdir -p {DEPLOY_DIR}/server")
        sftp = client.open_sftp()
        with sftp.file(f"{DEPLOY_DIR}/server/.env", "w") as f:
            f.write(env_content)
        sftp.close()

        run_ssh(client, f"echo 'VITE_API_URL=/api' > {DEPLOY_DIR}/.env")

        # --- 6. Зависимости и сборка ---
        print("\n--- 6. Установка зависимостей и сборка ---")
        run_ssh(client, f"cd {DEPLOY_DIR} && npm install")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm install")

        run_ssh(client, f"mkdir -p {DEPLOY_DIR}/server/uploads/pdfs {DEPLOY_DIR}/server/uploads/previews")
        run_ssh(client, f"chmod -R 755 {DEPLOY_DIR}/server/uploads")

        print("Сборка фронтенда...")
        run_ssh(client, f"cd {DEPLOY_DIR} && VITE_API_URL=/api npm run build")

        print("Сборка бэкенда...")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run build")

        # --- 7. Миграции и seed ---
        print("\n--- 7. База данных ---")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run db:migrate 2>/dev/null || true")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run db:seed 2>/dev/null || true")

        # --- 8. PM2 ---
        print("\n--- 8. PM2 ---")
        run_ssh(client, "npm list -g pm2 2>/dev/null || npm install -g pm2", check=False)
        run_ssh(client, f"cd {DEPLOY_DIR}/server && pm2 delete 21day 2>/dev/null || true")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && pm2 start dist/index.js --name 21day --env production")
        run_ssh(client, "pm2 save && pm2 startup 2>/dev/null || true")

        # --- 9. Nginx для 21day.club ---
        print("\n--- 9. Nginx ---")
        nginx_conf = f'''server {{
    listen 80;
    server_name 21day.club www.21day.club;
    client_max_body_size 25m;

    location / {{
        proxy_pass http://127.0.0.1:{APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}
}}
'''
        sftp = client.open_sftp()
        with sftp.file("/etc/nginx/sites-available/21day", "w") as f:
            f.write(nginx_conf)
        sftp.close()

        run_ssh(client, "ln -sf /etc/nginx/sites-available/21day /etc/nginx/sites-enabled/21day 2>/dev/null || true")
        run_ssh(client, "nginx -t && systemctl reload nginx")

        # --- 10. HTTPS (Let's Encrypt) ---
        print("\n--- 10. HTTPS ---")
        run_ssh(client, "which certbot 2>/dev/null || apt-get install -y certbot python3-certbot-nginx", check=False)
        run_ssh(client, "certbot --nginx -d 21day.club -d www.21day.club --non-interactive --agree-tos --email admin@21day.club --redirect 2>/dev/null || echo 'Certbot: выполните вручную: certbot --nginx -d 21day.club'")

        print("\n=== Готово! ===")
        print("Приложение: https://21day.club")
        print("Админ: admin@example.com / admin123 (смените пароль!)")
        print("Инвайт-код: ADMIN2025")

    finally:
        client.close()


if __name__ == "__main__":
    main()
