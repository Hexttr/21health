#!/usr/bin/env python3
"""Деплой 21health: с ПК по SSH.

Два режима (см. deploy.local):
- DEPLOY_CODE_SOURCE=git — на сервере `git fetch` + сборка (нужен интернет на сервере).
- DEPLOY_CODE_SOURCE=local — `npm ci`/сборка на этом ПК, архив по SSH, на сервере без git/npm.
"""

from __future__ import annotations

import sys
from pathlib import Path

from deploy_common import connect, load_config, prepare_pc_bundle_and_upload, run_remote


def main() -> None:
    config = load_config()
    bundle = config.code_source == "local"
    print(f"=== Deploy {config.app_name} (code_source={config.code_source}) ===")

    ssh = connect(config)
    repo_root = Path(__file__).resolve().parent
    try:
        if not config.skip_ollama_setup and config.quiz_provider.strip().lower() == "ollama":
            print("0. Ensuring Ollama model...")
            run_remote(ssh, "systemctl enable --now ollama", sudo=True, sudo_password=config.ssh_password, timeout=180)
            run_remote(ssh, f"ollama pull {config.ollama_model}", timeout=3600)

        print("1. Validating nginx config...")
        run_remote(ssh, "nginx -t", sudo=True, sudo_password=config.ssh_password)

        if bundle:
            print("2. Local build + upload bundle (server has no Internet)…")
            prepare_pc_bundle_and_upload(ssh, config, repo_root)
        else:
            print("2. Syncing repo on server from origin (git)…")
            run_remote(
                ssh,
                f"cd {config.deploy_dir} && git fetch origin && git checkout {config.branch} "
                f"&& git clean -fd && git reset --hard origin/{config.branch}",
                timeout=600,
            )

        if not config.skip_npm_on_server:
            print("3. Installing dependencies on server...")
            run_remote(ssh, f"cd {config.deploy_dir} && npm ci", timeout=1800)
            run_remote(ssh, f"cd {config.deploy_dir}/server && npm ci", timeout=1800)
        else:
            print("3. Skipping npm ci on server (dependencies bundled from PC).")

        print("4. Running DB migrations...")
        run_remote(ssh, f"cd {config.deploy_dir}/server && npm run db:migrate", timeout=1200)

        if not config.skip_npm_on_server:
            print("5. Building frontend on server...")
            run_remote(ssh, f"cd {config.deploy_dir} && VITE_API_URL=/api npm run build", timeout=1800)
            print("6. Building backend on server...")
            run_remote(ssh, f"cd {config.deploy_dir}/server && npm run build", timeout=1800)
        else:
            print("5–6. Skipping build on server (already built on PC).")

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
