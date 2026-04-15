#!/usr/bin/env python3
"""Bootstrap and first deploy for 21health via Paramiko."""

from __future__ import annotations

import re
import secrets
import sys
from urllib.parse import quote, urlsplit

from deploy_common import connect, load_config, run_remote, write_remote_text


def parse_env(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def sql_literal(value: str) -> str:
    return value.replace("'", "''")


def sql_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def resolve_database_url(existing_env: dict[str, str], config_db_url: str) -> str:
    return existing_env.get("DATABASE_URL") or config_db_url


def ensure_base_packages(ssh, config) -> None:
    print("Installing system packages...")
    run_remote(
        ssh,
        "apt-get update && apt-get install -y "
        "curl ca-certificates gnupg build-essential git nginx postgresql postgresql-contrib",
        sudo=True,
        sudo_password=config.ssh_password,
        timeout=1200,
    )

    node_out, _, code = run_remote(ssh, "node -v", check=False)
    if code != 0 or not node_out.strip().startswith("v20."):
        print("Installing Node.js 20...")
        run_remote(
            ssh,
            "curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh && "
            "bash /tmp/nodesource_setup.sh && "
            "apt-get install -y nodejs && "
            "rm -f /tmp/nodesource_setup.sh",
            sudo=True,
            sudo_password=config.ssh_password,
            timeout=1200,
        )

    run_remote(
        ssh,
        "npm install -g pm2",
        sudo=True,
        sudo_password=config.ssh_password,
        timeout=1200,
    )
    run_remote(ssh, "systemctl enable --now postgresql nginx", sudo=True, sudo_password=config.ssh_password)


def ensure_ollama_ready(ssh, config) -> None:
    if config.quiz_provider.strip().lower() != "ollama":
        return

    print("Ensuring Ollama runtime for quiz POC...")
    out, _, code = run_remote(ssh, "command -v ollama", check=False, timeout=60)
    if code != 0 or not out.strip():
        run_remote(
            ssh,
            "curl -fsSL https://ollama.com/install.sh | sh",
            sudo=True,
            sudo_password=config.ssh_password,
            timeout=1800,
        )

    run_remote(ssh, "systemctl enable --now ollama", sudo=True, sudo_password=config.ssh_password, timeout=180)
    run_remote(ssh, f"ollama pull {config.ollama_model}", timeout=3600)


def prepare_repo(ssh, config) -> None:
    print("Preparing application directory...")
    run_remote(
        ssh,
        f"mkdir -p {config.deploy_dir} && chown -R {config.ssh_user}:{config.ssh_user} {config.deploy_dir}",
        sudo=True,
        sudo_password=config.ssh_password,
    )

    out, _, _ = run_remote(ssh, f"test -d {config.deploy_dir}/.git && echo yes || echo no")
    if out.strip() == "yes":
        print("Updating existing repository...")
        run_remote(
            ssh,
            f"cd {config.deploy_dir} && git fetch origin && git checkout {config.branch} && git pull --ff-only origin {config.branch}",
            timeout=600,
        )
    else:
        print("Cloning repository...")
        run_remote(
            ssh,
            f"git clone -b {config.branch} {config.repo_url} {config.deploy_dir}",
            timeout=600,
        )


def read_remote_env(ssh, config) -> dict[str, str]:
    out, _, _ = run_remote(ssh, f"cat {config.deploy_dir}/server/.env 2>/dev/null || true", check=False)
    return parse_env(out)


def ensure_database(ssh, config, db_name: str, db_user: str, db_password: str) -> None:
    print("Ensuring PostgreSQL role and database...")
    quoted_db_user = sql_ident(db_user)
    quoted_db_name = sql_ident(db_name)
    role_exists, _, _ = run_remote(
        ssh,
        f"sudo -u postgres psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='{sql_literal(db_user)}'\"",
        sudo=True,
        sudo_password=config.ssh_password,
        check=False,
        timeout=120,
    )
    if role_exists.strip() != "1":
        run_remote(
            ssh,
            (
                "sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'\n"
                f"CREATE USER {quoted_db_user} WITH PASSWORD '{sql_literal(db_password)}';\n"
                "SQL"
            ),
            sudo=True,
            sudo_password=config.ssh_password,
            timeout=120,
        )
    else:
        run_remote(
            ssh,
            (
                "sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'\n"
                f"ALTER USER {quoted_db_user} WITH PASSWORD '{sql_literal(db_password)}';\n"
                "SQL"
            ),
            sudo=True,
            sudo_password=config.ssh_password,
            timeout=120,
        )

    db_exists, _, _ = run_remote(
        ssh,
        f"sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='{sql_literal(db_name)}'\"",
        sudo=True,
        sudo_password=config.ssh_password,
        check=False,
        timeout=120,
    )
    if db_exists.strip() != "1":
        run_remote(
            ssh,
            (
                "sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'\n"
                f"CREATE DATABASE {quoted_db_name} OWNER {quoted_db_user};\n"
                "SQL"
            ),
            sudo=True,
            sudo_password=config.ssh_password,
            timeout=120,
        )
    run_remote(
        ssh,
        (
            "sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'\n"
            f"GRANT ALL PRIVILEGES ON DATABASE {quoted_db_name} TO {quoted_db_user};\n"
            "SQL"
        ),
        sudo=True,
        sudo_password=config.ssh_password,
        check=False,
        timeout=120,
    )


def build_server_env(existing_env: dict[str, str], config) -> tuple[str, str]:
    db_password = config.db_password or secrets.token_urlsafe(18)
    database_url = f"postgresql://{quote(config.db_user)}:{quote(db_password)}@localhost:5432/{config.db_name}"
    database_url = resolve_database_url(existing_env, database_url)

    jwt_secret = existing_env.get("JWT_SECRET") or config.jwt_secret or secrets.token_urlsafe(48)
    provider_secret_key = (
        existing_env.get("PROVIDER_SECRET_KEY")
        or config.provider_secret_key
        or secrets.token_urlsafe(48)
    )
    gemini_api_key = existing_env.get("GEMINI_API_KEY") or config.gemini_api_key
    quiz_provider = existing_env.get("QUIZ_PROVIDER") or config.quiz_provider
    ollama_host = existing_env.get("OLLAMA_HOST") or config.ollama_host
    ollama_model = existing_env.get("OLLAMA_MODEL") or config.ollama_model
    ollama_timeout_ms = existing_env.get("OLLAMA_TIMEOUT_MS") or str(config.ollama_timeout_ms)

    env_content = "\n".join(
        [
            "# 21health production",
            f'DATABASE_URL="{database_url}"',
            f'JWT_SECRET="{jwt_secret}"',
            f'PROVIDER_SECRET_KEY="{provider_secret_key}"',
            f'GEMINI_API_KEY="{gemini_api_key}"',
            f'QUIZ_PROVIDER="{quiz_provider}"',
            f'OLLAMA_HOST="{ollama_host}"',
            f'OLLAMA_MODEL="{ollama_model}"',
            f'OLLAMA_TIMEOUT_MS="{ollama_timeout_ms}"',
            'NODE_ENV="production"',
            f'PORT="{config.app_port}"',
            "",
        ]
    )
    return env_content, database_url


def install_dependencies_and_build(ssh, config) -> None:
    print("Installing npm dependencies...")
    run_remote(ssh, f"cd {config.deploy_dir} && npm ci", timeout=1800)
    run_remote(ssh, f"cd {config.deploy_dir}/server && npm ci", timeout=1800)
    run_remote(ssh, f"mkdir -p {config.deploy_dir}/server/uploads/pdfs {config.deploy_dir}/server/uploads/previews")
    run_remote(ssh, f"chmod -R 755 {config.deploy_dir}/server/uploads")

    print("Running database migrations and seed...")
    run_remote(ssh, f"cd {config.deploy_dir}/server && npm run db:migrate", timeout=1200)
    run_remote(ssh, f"cd {config.deploy_dir}/server && npm run db:seed", timeout=1200)

    print("Building frontend and backend...")
    run_remote(ssh, f"cd {config.deploy_dir} && VITE_API_URL=/api npm run build", timeout=1800)
    run_remote(ssh, f"cd {config.deploy_dir}/server && npm run build", timeout=1800)


def ensure_ai_runtime_seed(ssh, config) -> None:
    print("Ensuring Gemini provider and quiz model...")
    sql = """
INSERT INTO ai_providers (name, display_name, api_key_env, is_active)
VALUES ('gemini', 'Google Gemini', 'GEMINI_API_KEY', true)
ON CONFLICT (name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    api_key_env = EXCLUDED.api_key_env,
    is_active = true;

DO $$
DECLARE
  provider_uuid uuid;
  model_uuid uuid;
BEGIN
  SELECT id INTO provider_uuid FROM ai_providers WHERE name = 'gemini' LIMIT 1;
  SELECT id INTO model_uuid
  FROM ai_models
  WHERE provider_id = provider_uuid AND model_key = 'gemini-2.5-flash'
  LIMIT 1;

  IF model_uuid IS NULL THEN
    INSERT INTO ai_models (
      provider_id,
      model_key,
      display_name,
      model_type,
      supports_streaming,
      supports_image_input,
      supports_document_input,
      supports_image_output,
      supports_system_prompt,
      input_price_per_1k,
      output_price_per_1k,
      fixed_price,
      is_active,
      sort_order
    )
    VALUES (
      provider_uuid,
      'gemini-2.5-flash',
      'Gemini 2.5 Flash',
      'text',
      true,
      true,
      true,
      false,
      true,
      '0',
      '0',
      '0',
      true,
      0
    )
    RETURNING id INTO model_uuid;
  ELSE
    UPDATE ai_models
    SET display_name = 'Gemini 2.5 Flash',
        model_type = 'text',
        supports_streaming = true,
        supports_image_input = true,
        supports_document_input = true,
        supports_image_output = false,
        supports_system_prompt = true,
        is_active = true,
        sort_order = 0,
        updated_at = now()
    WHERE id = model_uuid;
  END IF;

  INSERT INTO platform_settings (key, value)
  VALUES ('ai_quiz_model_id', model_uuid::text)
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();
END $$;
"""
    run_remote(
        ssh,
        f"cd {config.deploy_dir}/server && source .env && psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 <<'SQL'\n{sql}\nSQL",
        timeout=1200,
    )


def configure_pm2(ssh, config) -> None:
    print("Configuring PM2...")
    run_remote(
        ssh,
        (
            f"pm2 describe {config.app_name} >/dev/null 2>&1 "
            f"&& pm2 restart {config.app_name} --update-env "
            f"|| pm2 start {config.deploy_dir}/server/dist/index.js --name {config.app_name} --cwd {config.deploy_dir}/server"
        ),
        timeout=300,
    )
    run_remote(ssh, "pm2 save", timeout=300)
    run_remote(
        ssh,
        f"export PATH=$PATH:$(dirname $(command -v node)); $(command -v pm2) startup systemd -u {config.ssh_user} --hp {config.ssh_home}",
        sudo=True,
        sudo_password=config.ssh_password,
        check=False,
        timeout=300,
    )


def configure_nginx(ssh, config) -> None:
    print("Configuring nginx reverse proxy...")
    nginx_conf = f"""server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name {config.nginx_server_name};
    client_max_body_size 25m;

    location / {{
        proxy_pass http://127.0.0.1:{config.app_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}
}}
"""
    write_remote_text(
        ssh,
        "/etc/nginx/sites-available/21health",
        nginx_conf,
        sudo=True,
        sudo_password=config.ssh_password,
        mode="644",
    )
    run_remote(
        ssh,
        "rm -f /etc/nginx/sites-enabled/default && ln -sf /etc/nginx/sites-available/21health /etc/nginx/sites-enabled/21health",
        sudo=True,
        sudo_password=config.ssh_password,
    )
    run_remote(ssh, "nginx -t", sudo=True, sudo_password=config.ssh_password)
    run_remote(ssh, "systemctl reload nginx", sudo=True, sudo_password=config.ssh_password)


def verify_deploy(ssh, config) -> None:
    print("Running health checks...")
    run_remote(ssh, f"curl -fsS http://127.0.0.1:{config.app_port}/api/ai/health", timeout=60)
    run_remote(ssh, "curl -fsS http://127.0.0.1/api/ai/health", timeout=60)


def main() -> None:
    config = load_config()
    check_only = "--check" in sys.argv or "-c" in sys.argv

    print(f"=== Deploy bootstrap for {config.app_name} ===")
    print(f"Host: {config.ssh_host}")
    print(f"Dir:  {config.deploy_dir}")

    ssh = connect(config)
    try:
        if check_only:
            out, _, _ = run_remote(ssh, "hostname && uname -a && free -h && df -h /", timeout=120)
            print(out)
            return

        ensure_base_packages(ssh, config)
        prepare_repo(ssh, config)
        existing_env = read_remote_env(ssh, config)
        env_content, database_url = build_server_env(existing_env, config)

        parsed_url = urlsplit(database_url)
        db_user = parsed_url.username or config.db_user
        db_password = parsed_url.password or config.db_password or ""
        db_name = parsed_url.path.lstrip("/") or config.db_name

        if not db_password:
            raise RuntimeError("Could not determine database password for deployment.")

        ensure_database(ssh, config, db_name, db_user, db_password)
        write_remote_text(ssh, f"{config.deploy_dir}/server/.env", env_content, mode="600")
        write_remote_text(ssh, f"{config.deploy_dir}/.env", 'VITE_API_URL="/api"\n', mode="644")

        ensure_ollama_ready(ssh, config)
        install_dependencies_and_build(ssh, config)
        ensure_ai_runtime_seed(ssh, config)
        configure_pm2(ssh, config)
        configure_nginx(ssh, config)
        verify_deploy(ssh, config)

        print("\nDeployment finished.")
        print(f"Base URL: {config.base_url}")
        if not config.gemini_api_key and not existing_env.get("GEMINI_API_KEY"):
            print("Warning: GEMINI_API_KEY is empty. Site is up, but AI quiz will stay unavailable until you add a real key.")
    finally:
        ssh.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Deployment failed: {exc}")
        sys.exit(1)
