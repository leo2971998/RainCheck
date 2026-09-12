import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
import { requestReview, REVIEW_IP, REVIEW_HOST } from '../api/_zeroclaw.js';

function transport(record, capture) {
  return (options, callback) => {
    capture.options = options;
    const req = new EventEmitter();
    req.end = body => {
      capture.body = JSON.parse(body);
      queueMicrotask(() => {
        const res = new EventEmitter(); res.statusCode = 201;
        callback(res); res.emit('data', Buffer.from(JSON.stringify(record))); res.emit('end');
      });
    };
    req.destroy = error => req.emit('error', error);
    return req;
  };
}
const brief = { source: 'nessie-demo', before: { lowCents: 20000 }, after: { lowCents: 12500, contributionFits: true }, evidence: [] };
const record = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', status: 'complete', facts: brief,
  result: { summary: 'The checking buffer is smaller.', observations: [{ text: 'The cushion needs attention.', facts: ['after.lowCents'] }], questions: [] } };
it('accepts only supplied purchase-week evidence paths', async () => {
  const facts = { ...brief, purchaseWeek: { afterLowCents: 10000 } };
  const result = { ...record.result, observations: [{ text: 'The purchase week needs attention.', facts: ['purchaseWeek.afterLowCents'] }] };
  expect((await requestReview(facts, { env: { ZEROCLAW_REVIEW_KEY: 'x'.repeat(64) }, request: transport({ ...record, facts, result }, {}) })).result).toEqual(result);
  result.observations[0].facts = ['purchaseWeek.invented'];
  await expect(requestReview(facts, { env: { ZEROCLAW_REVIEW_KEY: 'x'.repeat(64) }, request: transport({ ...record, facts, result }, {}) })).rejects.toThrow();
});
it('uses verified HTTPS with the public IP and matching SNI; credentials stay in server headers', async () => {
  const capture = {}, key = 'x'.repeat(64);
  const result = await requestReview(brief, { env: { ZEROCLAW_REVIEW_KEY: key }, request: transport(record, capture) });
  expect(result.id).toBe(record.id); expect(capture.body).toEqual(brief);
  expect(capture.options).toMatchObject({ hostname: REVIEW_IP, servername: REVIEW_HOST, port: 443, rejectUnauthorized: true });
  expect(capture.options.headers.Authorization).toBe(`Bearer ${key}`);
  expect(JSON.stringify(capture.body)).not.toContain(key); expect(JSON.stringify(result)).not.toContain(key);
});
it('does not accept an explanation attached to different calculator facts', async () => {
  await expect(requestReview(brief, { env: { ZEROCLAW_REVIEW_KEY: 'x'.repeat(64) },
    request: transport({ ...record, facts: { ...brief, after: { lowCents: 99999 } } }, {}) })).rejects.toThrow('facts');
});
it('rejects malformed responses and invented amounts instead of rendering them', async () => {
  for (const result of [{ summary: 'Missing observations.' }, { ...record.result, summary: 'You can spend $9999 safely.' }])
    await expect(requestReview(brief, { env: { ZEROCLAW_REVIEW_KEY: 'x'.repeat(64) },
      request: transport({ ...record, result }, {}) })).rejects.toThrow();
});
