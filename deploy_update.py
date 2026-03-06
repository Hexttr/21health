#!/usr/bin/env python3
"""Быстрое обновление: git pull + build + pm2 restart. Не трогает .env."""

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
        print("1. Git pull...")
        run_ssh(client, f"cd {DEPLOY_DIR} && git fetch origin && git checkout {BRANCH} && git reset --hard origin/{BRANCH}")

        print("2. Frontend build...")
        run_ssh(client, f"cd {DEPLOY_DIR} && VITE_API_URL=/api npm run build")

        print("3. Server build...")
        run_ssh(client, f"cd {DEPLOY_DIR}/server && npm run build")

        print("4. PM2 restart...")
        run_ssh(client, "pm2 restart 21day")

        print("\nГотово. https://21day.club")
    finally:
        client.close()


if __name__ == "__main__":
    main()
