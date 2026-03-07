#!/usr/bin/env python3
"""Точечное обновление 21day: fast-forward pull + migrate + build + pm2 restart."""

import sys
try:
    import paramiko
except ImportError:
    print("Установите paramiko: pip install paramiko")
    sys.exit(1)

SSH_HOST = "195.133.63.34"
SSH_USER = "root"
SSH_PASSWORD = "hdp-k.PD6u8K7U"
DEPLOY_DIR = "/var/www/21day-platform"
BRANCH = "ubuntu"


def run_ssh(ssh, cmd, check=True):
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=False)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if check and exit_code != 0:
        raise RuntimeError(f"Exit {exit_code}:\n{cmd}\n{out}\n{err}")
    return out, err, exit_code


def main():
    print("=== Обновление 21day-platform на сервере ===\n")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASSWORD, timeout=30)
    except Exception as e:
        print(f"Ошибка подключения: {e}")
        sys.exit(1)

    try:
        print("1. Проверка nginx-конфига только для 21day...")
        run_ssh(client, "test -L /etc/nginx/sites-enabled/21day && nginx -t")

        print("2. Fast-forward обновление ветки ubuntu...")
        run_ssh(client, f"cd {DEPLOY_DIR} && git fetch origin && git checkout {BRANCH} && git pull --ff-only origin {BRANCH}")

        print("3. Миграции БД...")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run db:migrate")

        print("4. Frontend build...")
        run_ssh(client, f"cd {DEPLOY_DIR} && VITE_API_URL=/api npm run build")

        print("5. Server build...")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run build")

        print("6. DB seed-billing...")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run db:seed-billing", check=False)

        print("7. PM2 restart only for 21day...")
        run_ssh(client, "pm2 restart 21day")

        print("8. Post-checks...")
        run_ssh(client, "pm2 show 21day >/dev/null && curl -fsS https://21day.club/api/ai/health >/dev/null")

        print("\nГотово. https://21day.club")
    finally:
        client.close()


if __name__ == "__main__":
    main()
