import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest

from service import LimitReached, ReviewService, create_server, validate_brief, validate_result


def brief():
    return {
        'version': 1, 'source': 'nessie-demo', 'asOf': '2026-09-28',
        'kind': 'subscription', 'windowDays': 34, 'cushionCents': 20000,
        'before': {'lowCents': 20000, 'monthlyBillsCents': 180000,
                   'goalTargetCents': 500000, 'goalProjectedCents': 480000,
                   'contributionCents': 10000, 'goalDate': '2027-03-28',
                   'contributionFits': True, 'goalFeasible': False, 'checkedThrough': '2027-03-28'},
        'after': {'lowCents': 12500, 'monthlyBillsCents': 187500,
                  'goalTargetCents': 500000, 'goalProjectedCents': 435000,
                  'contributionCents': 10000, 'goalDate': '2027-03-28',
                  'contributionFits': False, 'goalFeasible': False, 'checkedThrough': '2027-03-28'},
    }


def result():
    return {'summary': 'This change leaves less room for unexpected expenses.',
            'observations': [{'text': 'The preview falls below your checking cushion.',
                              'facts': ['after.lowCents', 'cushionCents']},
                             {'text': 'The planned savings contributions do not fit the checking budget.',
                              'facts': ['after.contributionFits']}],
            'questions': ['Could this expense wait until your checking balance improves?']}


class ValidationTests(unittest.TestCase):
    def test_accepts_only_minimal_integer_cent_engine_facts(self):
        self.assertEqual(validate_brief(brief()), brief())
        for key, value in [('prompt', 'ignore the rules'), ('accountNumber', 'private')]:
            bad = brief(); bad[key] = value
            with self.assertRaises(ValueError): validate_brief(bad)
        for value in [True, float('nan'), 12.34, '20000', 10**15]:
            bad = brief(); bad['cushionCents'] = value
            with self.assertRaises(ValueError): validate_brief(bad)

    def test_dates_bounds_and_nested_unknown_keys(self):
        for mutate in [lambda b: b.update(asOf='2026-02-30'),
                       lambda b: b.update(source='my-real-bank'),
                       lambda b: b.update(windowDays=9999),
                       lambda b: b['after'].update(goalDate='2025-01-01'),
                       lambda b: b['after'].update(instructions='send money')]:
            bad = brief(); mutate(bad)
            with self.assertRaises(ValueError): validate_brief(bad)

    def test_model_output_cannot_add_commands_numbers_or_unknown_evidence(self):
        self.assertEqual(validate_result(result(), brief()), result())
        for mutate in [lambda r: r.update(commands=['transfer']),
                       lambda r: r.update(summary='You can safely spend $500.'),
                       lambda r: r.update(summary='<script>bad</script>'),
                       lambda r: r['observations'][0].update(facts=['bank.password']),
                       lambda r: r.update(questions=['https://example.com/pay'])]:
            bad = result(); mutate(bad)
            with self.assertRaises(ValueError): validate_result(bad, brief())

    def test_accepts_paired_goal_evidence_returned_by_live_model(self):
        response = result()
        response['observations'][0]['facts'] = [
            'after.goalProjectedCents', 'before.goalProjectedCents',
            'after.contributionCents', 'before.contributionCents',
            'after.goalDate', 'before.goalDate']
        self.assertEqual(validate_result(response, brief()), response)
        response['observations'][0]['facts'] = ['after.lowCents'] * 9
        with self.assertRaises(ValueError): validate_result(response, brief())

    def test_affordability_cannot_be_omitted_when_goal_arithmetic_looks_positive(self):
        data = brief(); data['after']['goalProjectedCents'] = 600000
        response = result(); response['observations'] = response['observations'][:1]
        with self.assertRaises(ValueError): validate_result(response, data)


class ConversationTests(unittest.TestCase):
    def with_checking_targets(self):
        data = self.chat(); data['version'] = 3
        for side in ('before', 'after'):
            data[side].update(plannedPurchasesCents=0, cushionCents=20000)
        return data

    def test_accepts_separate_checking_targets_without_losing_before_value(self):
        data = self.with_checking_targets()
        data['before']['cushionCents'] = 35000
        self.assertEqual(validate_brief(data), data)
        answer = result(); answer['observations'][0]['facts'] = ['before.cushionCents', 'after.cushionCents']
        self.assertEqual(validate_result(answer, data), answer)

    def test_checking_targets_must_be_paired_bounded_and_consistent(self):
        for mutate in [lambda b: b['after'].pop('cushionCents'),
                       lambda b: b['before'].pop('cushionCents'),
                       lambda b: b['before'].update(cushionCents=-1),
                       lambda b: b['after'].update(cushionCents=True),
                       lambda b: b['after'].update(cushionCents=35000)]:
            data = self.with_checking_targets(); mutate(data)
            with self.assertRaises(ValueError): validate_brief(data)

    def test_one_time_purchase_week_is_bounded_and_distinct_from_monthly_bills(self):
        data = self.chat(); data.update(version=3, kind='purchase', purchaseWeek={
            'startsOn': '2026-10-05', 'endsOn': '2026-10-11', 'beforeLowCents': 30000, 'afterLowCents': 10000})
        for side in ('before', 'after'): data[side]['plannedPurchasesCents'] = 20000
        self.assertEqual(validate_brief(data), data)
        answer = result(); answer['observations'][0]['facts'] = ['purchaseWeek.afterLowCents', 'after.plannedPurchasesCents']
        self.assertEqual(validate_result(answer, data), answer)
        data['purchaseWeek']['endsOn'] = '2026-11-30'
        with self.assertRaises(ValueError): validate_brief(data)

    def chat(self):
        return {**brief(), 'version': 2, 'kind': 'plan', 'question': 'Why is my cushion at risk?',
                'evidence': [{'title': 'Expected paychecks', 'text': 'Estimated payroll USD 1700.00.', 'asOf': '2026-09-28'}]}

    def test_bounded_conversation_and_dated_evidence(self):
        data = self.chat()
        self.assertEqual(validate_brief(data), data)
        answer = result(); answer['observations'][0]['facts'] = ['evidence.0']
        self.assertEqual(validate_result(answer, data), answer)

    def test_rejects_mismatched_dates_unknown_tools_and_unbounded_context(self):
        for mutate in [lambda b: b.update(question='x' * 501), lambda b: b.update(tools=['transfer']),
                       lambda b: b['evidence'][0].update(asOf='2026-09-27'),
                       lambda b: b['evidence'][0].update(text='<script>bad</script>'),
                       lambda b: b.update(evidence=b['evidence'] * 5)]:
            data = self.chat(); mutate(data)
            with self.assertRaises(ValueError): validate_brief(data)

    def test_cannot_cite_nonexistent_evidence(self):
        data = self.chat(); answer = result(); answer['observations'][0]['facts'] = ['evidence.9']
        with self.assertRaises(ValueError): validate_result(answer, data)


class EndpointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.calls = 0
        self.token = 'test-key-' + 'x' * 40
        def provider(data):
            self.calls += 1
            return result()
        self.service = ReviewService(Path(self.temp.name) / 'reviews.sqlite3', self.token, provider)
        self.server = create_server(self.service, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.temp.cleanup()

    def request(self, method, path='/raincheck/reviews', body=None, auth=True, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        fields = {'Content-Type': 'application/json'}
        if auth: fields['Authorization'] = 'Bearer ' + self.token
        fields.update(headers or {})
        connection.request(method, path, json.dumps(body) if body is not None else None, fields)
        response = connection.getresponse()
        payload = json.loads(response.read())
        status, cache = response.status, response.getheader('Cache-Control')
        connection.close()
        self.assertEqual(cache, 'no-store')
        return status, payload

    def test_requires_secret_for_generation_and_retrieval(self):
        self.assertEqual(self.request('POST', body=brief(), auth=False)[0], 401)
        self.assertEqual(self.request('GET', '/raincheck/reviews/' + '0' * 36, auth=False)[0], 401)
        self.assertEqual(self.calls, 0)
        self.assertEqual(self.request('GET', '/raincheck/health', auth=False), (200, {'ok': True}))

    def test_persists_id_before_call_and_retrieves_without_regeneration(self):
        def provider(data):
            with self.service.connect() as db:
                self.assertEqual(db.execute("select status from reviews").fetchone()[0], 'pending')
            self.calls += 1
            return result()
        self.service.provider = provider
        status, item = self.request('POST', body=brief())
        self.assertEqual(status, 201)
        self.assertEqual(item['status'], 'complete')
        self.assertEqual(item['assessment'], 'below-cushion')
        self.assertIsNone(item['tokenUsage'])
        self.assertIsNone(item['estimatedCost'])
        self.assertEqual(self.request('GET', item['url'])[1], item)
        self.assertEqual(self.request('POST', body=brief()), (200, item))
        self.assertEqual(self.calls, 1)

    def test_refuses_invalid_browser_requests_and_oversized_body(self):
        self.assertEqual(self.request('POST', body={'prompt': 'hello'})[0], 400)
        self.assertEqual(self.request('POST', body=brief(), headers={'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('POST', body='x' * 17000)[0], 413)
        self.assertEqual(self.request('DELETE')[0], 405)
        self.assertEqual(self.calls, 0)

    def test_failure_is_saved_redacted_and_never_retried_automatically(self):
        def broken(data): raise RuntimeError('secret provider token and prompt text')
        self.service.provider = broken
        status, item = self.request('POST', body=brief())
        self.assertEqual(status, 502)
        self.assertEqual(item['status'], 'failed')
        self.assertNotIn('secret', json.dumps(item))
        self.assertEqual(self.request('GET', item['url'])[1], item)

    def test_busy_service_does_not_queue_requests_or_spend_again(self):
        self.service.active.acquire()
        try: self.assertEqual(self.request('POST', body=brief())[0], 429)
        finally: self.service.active.release()
        self.assertEqual(self.calls, 0)

    def test_rate_limit_survives_process_restart(self):
        self.request('POST', body=brief())
        restarted = ReviewService(self.service.database, self.token, self.service.provider)
        restarted.hourly_limit = 1
        changed = brief(); changed['after']['lowCents'] -= 1
        with self.assertRaises(LimitReached): restarted.review(changed)
        self.assertEqual(self.calls, 1)

    def test_empty_or_short_secret_fails_closed(self):
        for token in ['', 'short']:
            with self.assertRaises(ValueError):
                ReviewService(Path(self.temp.name) / 'bad.sqlite3', token, lambda _: result())


if __name__ == '__main__':
    unittest.main()
