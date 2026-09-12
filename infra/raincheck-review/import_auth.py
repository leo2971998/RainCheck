"""Server-local access-token reuse; never rotate another application's login."""
import json
import os
from pathlib import Path
import tempfile

SOURCE = Path('/home/leo29798/.zeroclaw-poketeam')


def private_write(path, content):
    descriptor, name = tempfile.mkstemp(prefix='.raincheck-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(content)
        os.chmod(name, 0o600)
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)


def copy_access_token(target, source=SOURCE):
    # Credential values remain inside this process; no stdout or diagnostic dump.
    data = json.loads((source / 'auth-profiles.json').read_text())
    profiles = {key: value for key, value in data['profiles'].items()
                if value.get('model_provider') == 'openai.codex'}
    if len(profiles) != 1: raise ValueError('Existing Codex login unavailable.')
    profile = next(iter(profiles.values()))
    if not profile.get('access_token'): raise ValueError('Existing Codex login unavailable.')
    profile['refresh_token'] = None
    profile['id_token'] = None
    data['profiles'] = profiles
    data['active_profiles'] = {'openai.codex': next(iter(profiles))}
    private_write(target / '.secret_key', (source / '.secret_key').read_bytes())
    private_write(target / 'auth-profiles.json', json.dumps(data).encode())
