#!/usr/bin/env python3
"""Incremental deploy for 21health: pull, migrate, build, restart, verify."""

from __future__ import annotations

import sys

from deploy_common import connect, load_config, run_remote


def main() -> None:
    config = load_config()
    print(f"=== Incremental deploy for {config.app_name} ===")

    ssh = connect(config)
    try:
        print("1. Validating nginx config...")
        run_remote(ssh, "nginx -t", sudo=True, sudo_password=config.ssh_password)

        print("2. Pulling latest code...")
        run_remote(
            ssh,
            f"cd {config.deploy_dir} && git fetch origin && git checkout {config.branch} && git pull --ff-only origin {config.branch}",
            timeout=600,
        )

        print("3. Installing dependencies...")
        run_remote(ssh, f"cd {config.deploy_dir} && npm ci", timeout=1800)
        run_remote(ssh, f"cd {config.deploy_dir}/server && npm ci", timeout=1800)

        print("4. Running DB migrations...")
        run_remote(ssh, f"cd {config.deploy_dir}/server && npm run db:migrate", timeout=1200)

        print("5. Building frontend...")
        run_remote(ssh, f"cd {config.deploy_dir} && VITE_API_URL=/api npm run build", timeout=1800)

        print("6. Building backend...")
        run_remote(ssh, f"cd {config.deploy_dir}/server && npm run build", timeout=1800)

        print("7. Restarting PM2 app...")
        run_remote(ssh, f"pm2 restart {config.app_name} --update-env", timeout=300)
        run_remote(ssh, "pm2 save", timeout=120)

        print("8. Post-deploy checks...")
        run_remote(ssh, f"pm2 describe {config.app_name}", timeout=120)
        run_remote(ssh, f"curl -fsS http://127.0.0.1:{config.app_port}/api/ai/health", timeout=60)
        run_remote(ssh, "curl -fsS http://127.0.0.1/api/ai/health", timeout=60)

        print(f"\nDeploy completed: {config.base_url}")
    finally:
        ssh.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Deploy update failed: {exc}")
        sys.exit(1)
