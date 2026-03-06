#!/usr/bin/env python3
"""Copy uploads + migration_export to server, run import, restart PM2."""
import os
import zipfile
import tempfile
import paramiko
from pathlib import Path

SSH_HOST = "195.133.63.34"
SSH_USER = "root"
SSH_PASSWORD = "hdp-k.PD6u8K7U"
DEPLOY_DIR = "/var/www/21day-platform"
LOCAL_SERVER = Path(__file__).parent / "server"


def main():
    print("Creating zip...")
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
        zip_path = f.name
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in ["uploads", "migration_export"]:
            p = LOCAL_SERVER / d
            if p.exists():
                for item in p.rglob("*"):
                    if item.is_file():
                        arcname = f"{d}/{item.relative_to(p)}".replace("\\", "/")
                        zf.write(item, arcname)
        zf.write(LOCAL_SERVER / "scripts" / "import-from-data-package.ts", "scripts/import-from-data-package.ts")
    print("  Done")

    print("Connecting...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, username=SSH_USER, password=SSH_PASSWORD, timeout=60)

    sftp = client.open_sftp()
    print("Uploading deploy.zip...")
    sftp.put(zip_path, f"{DEPLOY_DIR}/deploy_data.zip")
    sftp.close()
    os.unlink(zip_path)
    print("  Done")

    print("Extracting and importing on server...")
    cmd = f"""cd {DEPLOY_DIR}/server && unzip -o ../deploy_data.zip -d . 2>/dev/null && \\
    mkdir -p scripts && unzip -o ../deploy_data.zip 'scripts/*' -d . 2>/dev/null; \\
    ./node_modules/.bin/tsx scripts/import-from-data-package.ts migration_export 2>&1; \\
    pm2 restart 21day; pm2 save"""
    _, o, e = client.exec_command(cmd)
    o.channel.recv_exit_status()
    out = o.read().decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii")
    err = e.read().decode("utf-8", errors="replace").encode("ascii", errors="replace").decode("ascii")
    print(out)
    if err:
        print("stderr:", err)

    client.close()
    print("Done.")


if __name__ == "__main__":
    main()
