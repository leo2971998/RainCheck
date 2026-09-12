import json
from pathlib import Path
import tempfile
import tomllib
import unittest

from activate_https import BLOCK, render_nginx
from import_auth import copy_access_token


class DeploymentTests(unittest.TestCase):
    def test_reuses_only_codex_access_without_changing_original_login(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'; source.mkdir()
            target = Path(directory) / 'profile'; target.mkdir()
            auth = {'profiles': {'codex': {'model_provider': 'openai.codex',
                                          'access_token': 'fixture-access',
                                          'refresh_token': 'fixture-refresh', 'id_token': 'fixture-id'},
                                 'other': {'model_provider': 'other', 'access_token': 'not-copied'}},
                    'active_profiles': {'other': 'other', 'openai.codex': 'codex'}}
            original = json.dumps(auth)
            (source / 'auth-profiles.json').write_text(original)
            (source / '.secret_key').write_text('fixture-encryption-key')
            copy_access_token(target, source)
            saved = json.loads((target / 'auth-profiles.json').read_text())
            self.assertEqual(list(saved['profiles']), ['codex'])
            self.assertIsNone(saved['profiles']['codex']['refresh_token'])
            self.assertIsNone(saved['profiles']['codex']['id_token'])
            self.assertEqual((source / 'auth-profiles.json').read_text(), original)

    def test_nginx_adds_only_isolated_routes_and_preserves_existing_default(self):
        original = '''server {
    server_name zeroclaw.leo-photoserver.com;
    location / {
        proxy_pass http://127.0.0.1:43100;
    }
    listen 443 ssl;
}
server { listen 80; return 404; }
'''
        changed = render_nginx(original)
        self.assertIn('proxy_pass http://127.0.0.1:43100;', changed)
        self.assertIn('location = /raincheck/health', changed)
        self.assertIn('location ^~ /raincheck/reviews', changed)
        self.assertEqual(render_nginx(changed), changed)
        self.assertTrue(changed.endswith('server { listen 80; return 404; }\n'))
        with self.assertRaises(ValueError): render_nginx('unrecognized server configuration')

    def test_profile_disables_all_tools_memory_delegation_and_content_logs(self):
        config = tomllib.loads((Path(__file__).parent / 'profile/config.toml').read_text())
        agent = config['agents']['raincheck']
        for key in ['channels', 'delegates', 'skill_bundles', 'mcp_bundles', 'knowledge_bundles']:
            self.assertEqual(agent[key], [])
        self.assertEqual(agent['memory']['backend'], 'none')
        self.assertEqual(config['risk_profiles']['review']['allowed_tools'], ['raincheck_no_tools'])
        self.assertFalse(config['runtime_profiles']['review']['agentic'])
        self.assertEqual(config['observability']['log_persistence'], 'none')
        self.assertEqual(config['memory']['backend'], 'none')

    def test_certbot_repeated_hostname_keeps_http_redirect_unchanged(self):
        https = '''server {
    server_name zeroclaw.leo-photoserver.com;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:43100;
        proxy_set_header Host $host;
    }
    listen 443 ssl; # managed by Certbot
}'''
        redirect = '''server {
    if ($host = zeroclaw.leo-photoserver.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
    listen 80;
    server_name zeroclaw.leo-photoserver.com;
    return 404; # managed by Certbot
}'''
        original = https + redirect
        changed = render_nginx(original)
        self.assertEqual(changed.replace(BLOCK, '', 1), original)
        self.assertEqual(changed.count(BLOCK), 1)
        self.assertTrue(changed.endswith(redirect))
        self.assertEqual(render_nginx(changed), changed)
        with self.assertRaises(ValueError): render_nginx(original + redirect)


if __name__ == '__main__':
    unittest.main()
