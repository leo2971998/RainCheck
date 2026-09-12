"""One administrator step: add isolated paths without replacing existing routes.

The original config is backed up; failed validation/reload restores it. No
certificate, upstream application, DNS record or firewall rule is changed.
"""
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import subprocess

MARKER = '    # RainCheck isolated read-only review v1\n'
BLOCK = MARKER + '''    location = /raincheck/health {
        proxy_pass http://127.0.0.1:43120;
        access_log off;
    }
    location ^~ /raincheck/reviews {
        client_max_body_size 16k;
        proxy_pass http://127.0.0.1:43120;
        proxy_read_timeout 90s;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        access_log off;
    }

'''


def render_nginx(original):
    if MARKER in original: return original
    anchor = '    location / {'
    if (original.count('server_name zeroclaw.leo-photoserver.com;') != 1
            or original.count(anchor) != 1 or 'listen 443 ssl' not in original
            or '/raincheck/' in original):
        raise ValueError('Unexpected Nginx config. Nothing changed; manual review is needed.')
    return original.replace(anchor, BLOCK + anchor, 1)


def main():
    if os.geteuid() != 0: raise SystemExit('Run this HTTPS activation with sudo.')
    path = Path('/etc/nginx/sites-available/zeroclaw.conf')
    enabled = Path('/etc/nginx/sites-enabled/zeroclaw.conf')
    if path.resolve() != path or enabled.resolve() != path:
        raise SystemExit('Unexpected config target; nothing changed.')
    original = path.read_text()
    updated = render_nginx(original)
    if updated == original:
        print('RainCheck HTTPS routes are already installed.'); return
    backup = Path('/etc/nginx') / ('raincheck-original-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.conf')
    shutil.copy2(path, backup)
    temporary = path.with_name('zeroclaw.conf.raincheck-pending')
    try:
        with temporary.open('x') as stream: stream.write(updated)
        shutil.copymode(path, temporary)
        os.replace(temporary, path)
        subprocess.run(['/usr/sbin/nginx', '-t'], check=True)
        subprocess.run(['/usr/bin/systemctl', 'reload', 'nginx'], check=True)
    except BaseException:
        shutil.copy2(backup, path)
        subprocess.run(['/usr/sbin/nginx', '-t'], check=False)
        subprocess.run(['/usr/bin/systemctl', 'reload', 'nginx'], check=False)
        raise
    print('RainCheck HTTPS paths activated. Existing default route preserved.')
    print('Original configuration backup: ' + str(backup))


if __name__ == '__main__': main()
