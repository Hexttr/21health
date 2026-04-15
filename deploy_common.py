#!/usr/bin/env python3
"""Shared helpers for remote deployment via Paramiko."""

from __future__ import annotations

import os
import posixpath
import shlex
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

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
    "SSH_HOME": "/home/artem",
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
    ssh_home: str


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
        ssh_home=values["SSH_HOME"],
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
