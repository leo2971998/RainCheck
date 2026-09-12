"""Install only the user-owned RainCheck service. HTTPS activation is separate."""
import os
from pathlib import Path
import secrets
import subprocess

from import_auth import copy_access_token, private_write


def main():
    root = Path(__file__).resolve().parent
    if root != Path('/home/leo29798/raincheck-review') or os.geteuid() == 0:
        raise SystemExit('Run as leo29798 from the dedicated RainCheck directory.')
    os.umask(0o077)
    root.chmod(0o700)
    for name in ['profile', 'state']:
        (root / name).mkdir(mode=0o700, exist_ok=True)
        (root / name).chmod(0o700)
    secret = root / '.api-key'
    if not secret.exists(): private_write(secret, secrets.token_urlsafe(48).encode())
    secret.chmod(0o600)
    copy_access_token(root / 'profile')
    unit = Path('/home/leo29798/.config/systemd/user/raincheck-review.service')
    unit.parent.mkdir(parents=True, exist_ok=True)
    private_write(unit, (root / 'raincheck-review.service').read_bytes())
    subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
    subprocess.run(['systemctl', '--user', 'enable', '--now', 'raincheck-review.service'], check=True)
    subprocess.run(['systemctl', '--user', 'restart', 'raincheck-review.service'], check=True)
    print('RainCheck service installed on loopback only. Credentials were not printed.')


if __name__ == '__main__': main()
