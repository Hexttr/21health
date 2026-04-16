#!/usr/bin/env python3
"""Shared helpers for remote deployment via Paramiko."""

from __future__ import annotations

import os
import posixpath
import shlex
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, Tuple

import paramiko


DEFAULT_CONFIG: Dict[str, str] = {
    "DEPLOY_SSH_HOST": "",
    "DEPLOY_SSH_PORT": "22",
    "DEPLOY_SSH_USER": "",
    "DEPLOY_SSH_PASSWORD": "",
    "DEPLOY_DIR": "/var/www/21health",
    "DEPLOY_REPO_URL": "https://github.com/Hexttr/21health.git",
    "DEPLOY_BRANCH": "master",
    "APP_NAME": "21health",
    "APP_PORT": "3001",
    "BASE_URL": "http://172.16.8.78",
    "NGINX_SERVER_NAME": "_",
    "DB_NAME": "21health",
    "DB_USER": "21health_user",
    "DB_PASSWORD": "",
    "JWT_SECRET": "",
    "PROVIDER_SECRET_KEY": "",
    "GEMINI_API_KEY": "",
    "QUIZ_PROVIDER": "",
    "OLLAMA_HOST": "http://127.0.0.1:11434",
    "OLLAMA_MODEL": "qwen2.5:0.5b",
    "OLLAMA_TIMEOUT_MS": "90000",
    "SSH_HOME": "/home/artem",
    # git — обновление кода на сервере через `git fetch` (нужен интернет на сервере).
    # local — упаковка текущего каталога на ПК и выгрузка по SSH (сервер без интернета).
    "DEPLOY_CODE_SOURCE": "git",
    # При DEPLOY_CODE_SOURCE=local по умолчанию не тянем модель Ollama на сервере.
    "DEPLOY_SKIP_OLLAMA_SETUP": "",
    # Принудительно не вызывать npm ci на сервере (если уже в образе).
    "DEPLOY_SKIP_NPM_ON_SERVER": "",
}


@dataclass
class DeployConfig:
    ssh_host: str
    ssh_port: int
    ssh_user: str
    ssh_password: str
    deploy_dir: str
    repo_url: str
    branch: str
    app_name: str
    app_port: int
    base_url: str
    nginx_server_name: str
    db_name: str
    db_user: str
    db_password: str
    jwt_secret: str
    provider_secret_key: str
    gemini_api_key: str
    quiz_provider: str
    ollama_host: str
    ollama_model: str
    ollama_timeout_ms: int
    ssh_home: str
    code_source: str
    skip_ollama_setup: bool
    skip_npm_on_server: bool


def _read_local_kv_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_config() -> DeployConfig:
    root = Path(__file__).resolve().parent
    file_values = _read_local_kv_file(root / "deploy.local")
    values = dict(DEFAULT_CONFIG)
    values.update(file_values)
    for key in values:
      env_value = os.environ.get(key)
      if env_value is not None:
          values[key] = env_value

    missing = [
        key
        for key in ("DEPLOY_SSH_HOST", "DEPLOY_SSH_USER", "DEPLOY_SSH_PASSWORD")
        if not values[key]
    ]
    if missing:
        raise RuntimeError(
            "Missing deployment config keys: "
            + ", ".join(missing)
            + ". Set them in deploy.local or environment variables."
        )

    code_source = values.get("DEPLOY_CODE_SOURCE", "git").strip().lower()
    if code_source not in ("git", "local"):
        raise RuntimeError("DEPLOY_CODE_SOURCE must be 'git' or 'local'")

    def _flag(key: str, default: bool) -> bool:
        raw = values.get(key, "")
        if raw == "":
            return default
        return raw.strip().lower() in ("1", "true", "yes", "on")

    skip_ollama = _flag("DEPLOY_SKIP_OLLAMA_SETUP", default=(code_source == "local"))
    skip_npm = _flag("DEPLOY_SKIP_NPM_ON_SERVER", default=(code_source == "local"))

    return DeployConfig(
        ssh_host=values["DEPLOY_SSH_HOST"],
        ssh_port=int(values["DEPLOY_SSH_PORT"]),
        ssh_user=values["DEPLOY_SSH_USER"],
        ssh_password=values["DEPLOY_SSH_PASSWORD"],
        deploy_dir=values["DEPLOY_DIR"],
        repo_url=values["DEPLOY_REPO_URL"],
        branch=values["DEPLOY_BRANCH"],
        app_name=values["APP_NAME"],
        app_port=int(values["APP_PORT"]),
        base_url=values["BASE_URL"],
        nginx_server_name=values["NGINX_SERVER_NAME"],
        db_name=values["DB_NAME"],
        db_user=values["DB_USER"],
        db_password=values["DB_PASSWORD"],
        jwt_secret=values["JWT_SECRET"],
        provider_secret_key=values["PROVIDER_SECRET_KEY"],
        gemini_api_key=values["GEMINI_API_KEY"],
        quiz_provider=values["QUIZ_PROVIDER"],
        ollama_host=values["OLLAMA_HOST"],
        ollama_model=values["OLLAMA_MODEL"],
        ollama_timeout_ms=int(values["OLLAMA_TIMEOUT_MS"]),
        ssh_home=values["SSH_HOME"],
        code_source=code_source,
        skip_ollama_setup=skip_ollama,
        skip_npm_on_server=skip_npm,
    )


def connect(config: DeployConfig) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        config.ssh_host,
        port=config.ssh_port,
        username=config.ssh_user,
        password=config.ssh_password,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
    )
    return client


def run_remote(
    ssh: paramiko.SSHClient,
    command: str,
    *,
    sudo: bool = False,
    sudo_password: str = "",
    check: bool = True,
    timeout: int = 120,
) -> tuple[str, str, int]:
    wrapped = f"bash -lc {shlex.quote(command)}"
    if sudo:
        wrapped = f"sudo -S -p '' {wrapped}"
    stdin, stdout, stderr = ssh.exec_command(wrapped, get_pty=sudo, timeout=timeout)
    if sudo:
        stdin.write(sudo_password + "\n")
        stdin.flush()
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if check and exit_code != 0:
        raise RuntimeError(
            f"Remote command failed with exit code {exit_code}\n"
            f"COMMAND: {command}\n"
            f"STDOUT:\n{out}\n"
            f"STDERR:\n{err}"
        )
    return out, err, exit_code


def write_remote_text(
    ssh: paramiko.SSHClient,
    remote_path: str,
    content: str,
    *,
    sudo: bool = False,
    sudo_password: str = "",
    mode: str | None = None,
) -> None:
    sftp = ssh.open_sftp()
    try:
        if not sudo:
            directory = posixpath.dirname(remote_path)
            if directory:
                run_remote(ssh, f"mkdir -p {shlex.quote(directory)}")
            with sftp.file(remote_path, "w") as handle:
                handle.write(content)
            if mode:
                run_remote(ssh, f"chmod {mode} {shlex.quote(remote_path)}")
            return

        filename = posixpath.basename(remote_path)
        temp_remote = f"/tmp/{filename}.{next(tempfile._get_candidate_names())}"
        with sftp.file(temp_remote, "w") as handle:
            handle.write(content)
        if mode:
            run_remote(
                ssh,
                f"install -m {mode} -o root -g root {shlex.quote(temp_remote)} {shlex.quote(remote_path)}",
                sudo=True,
                sudo_password=sudo_password,
            )
        else:
            run_remote(
                ssh,
                f"install -o root -g root {shlex.quote(temp_remote)} {shlex.quote(remote_path)}",
                sudo=True,
                sudo_password=sudo_password,
            )
        run_remote(
            ssh,
            f"rm -f {shlex.quote(temp_remote)}",
            check=False,
        )
    finally:
        sftp.close()


_SKIP_DIR_NAMES = frozenset({".git", "__pycache__", ".cursor", ".idea"})


def _iter_bundle_files(repo_root: Path) -> Iterator[Tuple[Path, str]]:
    """Файлы для архива деплоя с ПК (без секретов и мусора)."""
    root = repo_root.resolve()
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        rel_dir = Path(dirpath).relative_to(root)
        if rel_dir.parts and rel_dir.parts[0] in _SKIP_DIR_NAMES:
            dirnames.clear()
            continue
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIR_NAMES]
        for name in filenames:
            if name == "deploy.local":
                continue
            if name.endswith(".pyc"):
                continue
            full = Path(dirpath) / name
            rel = full.relative_to(root)
            key = rel.as_posix()
            if key == "server/.env" or key == ".env":
                continue
            yield full, key


def run_local_npm_build(repo_root: Path) -> None:
    """Сборка и установка зависимостей на ПК (где есть интернет)."""
    root = repo_root.resolve()
    print("  (local) npm ci — корень проекта...")
    subprocess.run(["npm", "ci"], cwd=str(root), check=True)
    print("  (local) npm ci — server/...")
    subprocess.run(["npm", "ci"], cwd=str(root / "server"), check=True)
    env = os.environ.copy()
    env["VITE_API_URL"] = "/api"
    print("  (local) npm run build — фронт (VITE_API_URL=/api)...")
    subprocess.run(["npm", "run", "build"], cwd=str(root), check=True, env=env)
    print("  (local) npm run build — backend...")
    subprocess.run(["npm", "run", "build"], cwd=str(root / "server"), check=True)


def create_bundle_tarball(repo_root: Path) -> Path:
    fd, path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    tar_path = Path(path)
    print(f"  (local) архив: {tar_path} …")
    with tarfile.open(tar_path, "w:gz") as tf:
        for abs_path, arcname in _iter_bundle_files(repo_root):
            tf.add(abs_path, arcname=arcname, recursive=False)
    return tar_path


def upload_bundle_and_extract(ssh: paramiko.SSHClient, config: DeployConfig, tarball: Path) -> None:
    remote_tar = "/tmp/21health-deploy-bundle.tgz"
    deploy = config.deploy_dir
    size_kb = max(1, tarball.stat().st_size // 1024)
    print(f"  (scp) загрузка архива ~{size_kb} KB на сервер…")
    sftp = ssh.open_sftp()
    try:
        sftp.put(str(tarball), remote_tar)
    finally:
        sftp.close()

    run_remote(
        ssh,
        f"mkdir -p {shlex.quote(deploy)} && "
        f"if [ -f {shlex.quote(deploy)}/server/.env ]; then cp -a {shlex.quote(deploy)}/server/.env /tmp/21health.env.bak.deploy; fi",
        timeout=120,
    )
    run_remote(
        ssh,
        f"cd {shlex.quote(deploy)} && tar -xzf {shlex.quote(remote_tar)}",
        timeout=3600,
    )
    run_remote(
        ssh,
        "if [ -f /tmp/21health.env.bak.deploy ]; then "
        f"cp -a /tmp/21health.env.bak.deploy {shlex.quote(deploy)}/server/.env; "
        "rm -f /tmp/21health.env.bak.deploy; fi",
        timeout=60,
    )
    run_remote(ssh, f"rm -f {shlex.quote(remote_tar)}", check=False, timeout=60)


def prepare_pc_bundle_and_upload(ssh: paramiko.SSHClient, config: DeployConfig, repo_root: Path) -> None:
    """Деплой без интернета на сервере: сборка на ПК, выгрузка по SSH, распаковка."""
    run_local_npm_build(repo_root)
    tar_path = create_bundle_tarball(repo_root)
    try:
        upload_bundle_and_extract(ssh, config, tar_path)
    finally:
        tar_path.unlink(missing_ok=True)
