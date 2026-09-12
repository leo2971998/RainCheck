"""Run on the server; the API secret stays there and is never printed.

Input is a minimal synthetic brief on stdin. --public pins the existing HTTPS
hostname to its public IP while retaining certificate/hostname verification.
"""
import argparse
import http.client
import json
from pathlib import Path
import socket
import ssl
import sys

from service import MAX_BODY, validate_brief

HOST = 'zeroclaw.leo-photoserver.com'
PUBLIC_IP = '98.44.156.202'


class PublicConnection(http.client.HTTPSConnection):
    def __init__(self):
        super().__init__(HOST, timeout=85, context=ssl.create_default_context())

    def connect(self):
        raw = socket.create_connection((PUBLIC_IP, 443), timeout=self.timeout)
        try: self.sock = self._context.wrap_socket(raw, server_hostname=HOST)
        except BaseException:
            raw.close()
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--public', action='store_true')
    options = parser.parse_args()
    data = validate_brief(json.loads(sys.stdin.buffer.read(MAX_BODY + 1)))
    key = (Path(__file__).parent / '.api-key').read_text().strip()
    def request(method, path, body=None, authenticated=True):
        connection = PublicConnection() if options.public else http.client.HTTPConnection('127.0.0.1', 43120, timeout=85)
        try:
            headers = {'Content-Type': 'application/json'}
            if authenticated: headers['Authorization'] = 'Bearer ' + key
            connection.request(method, path, json.dumps(body) if body is not None else None, headers)
            response = connection.getresponse()
            return response.status, json.loads(response.read(32768))
        finally: connection.close()
    assert request('GET', '/raincheck/health', authenticated=False) == (200, {'ok': True})
    unauthorized, _ = request('POST', '/raincheck/reviews', data, authenticated=False)
    assert unauthorized == 401, 'Unauthenticated review was not rejected.'
    status, review = request('POST', '/raincheck/reviews', data)
    if status not in (200, 201) or review.get('status') != 'complete':
        print(json.dumps({'status': 'failed', 'httpStatus': status, 'reviewId': review.get('id')}))
        raise SystemExit(1)
    assert request('GET', review['url']) == (200, review)
    assert request('POST', '/raincheck/reviews', data) == (200, review)
    print(json.dumps({'transport': 'public-ip-verified-https' if options.public else 'server-loopback',
                      'unauthenticatedStatus': unauthorized, 'status': 'complete',
                      'reviewId': review['id'], 'cacheVerified': True,
                      'assessment': review['assessment'], 'result': review['result']}, indent=2))


if __name__ == '__main__': main()
