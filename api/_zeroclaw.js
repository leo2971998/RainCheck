import https from 'node:https';
import { readFile } from 'node:fs/promises';

// Fixed destination: the public IP with the certificate's host/SNI, never insecure TLS.
export const REVIEW_HOST = 'zeroclaw.leo-photoserver.com';
export const REVIEW_IP = '98.44.156.202';

async function send(method, path, body, { env = process.env, request = https.request } = {}) {
  const secret = env.ZEROCLAW_REVIEW_KEY || (env.ZEROCLAW_REVIEW_KEY_FILE ? await readFile(env.ZEROCLAW_REVIEW_KEY_FILE, 'utf8') : '');
  const key = secret.trim();
  if (!/^[a-zA-Z0-9_-]{40,200}$/.test(key)) throw new Error('Review not configured');
  const encoded = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = request({ hostname: REVIEW_IP, servername: REVIEW_HOST, port: 443, method, path,
      headers: { Host: REVIEW_HOST, Authorization: `Bearer ${key}`, ...(encoded ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) } : {}) },
      rejectUnauthorized: true, agent: false }, res => {
      const chunks = []; let size = 0;
      res.on('data', b => { size += b.length; if (size > 65536) req.destroy(new Error('Oversized response')); else chunks.push(b); });
      res.on('end', () => {
        clearTimeout(timer);
        try { if (res.statusCode < 200 || res.statusCode >= 300) throw new Error(); resolve(JSON.parse(Buffer.concat(chunks))); }
        catch { reject(new Error('Review unavailable')); }
      });
      res.on('error', () => { clearTimeout(timer); reject(new Error('Review unavailable')); });
    });
    const timer = setTimeout(() => req.destroy(new Error('Review timed out')), 85000);
    req.on('error', () => { clearTimeout(timer); reject(new Error('Review unavailable')); });
    req.end(encoded);
  });
}

function publicRecord(record) {
  if (!/^[a-f0-9-]{36}$/.test(record.id || '') || record.status !== 'complete' || !record.result || record.facts?.source !== 'nessie-demo')
    throw new Error('Invalid review');
  const { summary, observations, questions } = record.result;
  const prose = (s, limit) => typeof s === 'string' && s.trim().length > 0 && s.length <= limit && !/[\d$€£%<>\u0000-\u001f]|https?:\/\/|www\./i.test(s);
  const known = new Set(['cushionCents', 'windowDays', 'asOf', ...['before', 'after'].flatMap(side => Object.keys(record.facts[side] || {}).map(k => `${side}.${k}`)),
    ...(record.facts.evidence || []).map((_, i) => `evidence.${i}`),
    ...Object.keys(record.facts.purchaseWeek || {}).map(k => `purchaseWeek.${k}`)]);
  if (!prose(summary, 400) || !Array.isArray(observations) || !observations.length || observations.length > 4
    || observations.some(o => !prose(o.text, 300) || !Array.isArray(o.facts) || !o.facts.length || o.facts.length > 8 || o.facts.some(f => !known.has(f)))
    || !Array.isArray(questions) || questions.length > 2 || questions.some(q => !prose(q, 200))
    || (!record.facts.after?.contributionFits && !observations.some(o => o.facts.includes('after.contributionFits'))))
    throw new Error('Invalid review explanation');
  // Strings are rendered as text, never HTML/Markdown or model-provided actions.
  return { id: record.id, createdAt: record.createdAt, status: record.status, model: record.model,
    result: { summary, observations: observations.map(o => ({ text: o.text, facts: o.facts })), questions },
    facts: record.facts, tokenUsage: record.tokenUsage ?? null, estimatedCost: record.estimatedCost ?? null };
}
export async function requestReview(brief, dependencies) {
  const record = await send('POST', '/raincheck/reviews', brief, dependencies);
  if (JSON.stringify(record.facts) !== JSON.stringify(brief)) throw new Error('Review facts changed');
  return publicRecord(record);
}
export async function savedReview(id, dependencies) {
  if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Invalid review');
  return publicRecord(await send('GET', `/raincheck/reviews/${id}`, null, dependencies));
}
