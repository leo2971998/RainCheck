import { createHmac, timingSafeEqual } from 'node:crypto';
import { purchaseAccess, purchaseOriginAllowed } from './_purchase-access.js';
import { consumeChatLimit } from './_chat-access.js';

// Read-only AI is a separate opt-in; shared purchases alone never enable it.
export function reviewAccess(req, env = process.env) {
  const mode = purchaseAccess(req, env);
  if (mode === 'local') return mode;
  return mode === 'shared' && env.RAINCHECK_PUBLIC_REVIEW === '1'
    && /^[a-zA-Z0-9_-]{40,200}$/.test((env.ZEROCLAW_REVIEW_KEY || '').trim()) ? mode : null;
}
export const reviewOriginAllowed = purchaseOriginAllowed;

export async function checkReviewLimit(req, res, env, limit = consumeChatLimit) {
  try {
    // Model runs share the stricter, durable chat-session quota, including its global cap.
    const result = await limit(req, req.method === 'POST' ? 'session' : 'context', env);
    if (result.allowed) return true;
    res.setHeader('Retry-After', String(result.retryAfter || 60));
    res.status(429).json({ message: 'Several analyses were requested recently. Please wait a minute and try again. Your budgets are unchanged.' });
  } catch {
    res.status(503).json({ message: 'Analysis is temporarily unavailable. Please try again shortly. Your budgets are unchanged.' });
  }
  return false;
}

export function savedReviewToken(id, env) {
  return createHmac('sha256', env.RAINCHECK_CHAT_RATE_SECRET)
    .update(`raincheck-public-review:${env.RAINCHECK_DEMO_ORIGIN}:${id}`).digest('hex');
}
export function savedReviewAllowed(query, env) {
  return typeof query?.id === 'string' && /^[a-f0-9-]{36}$/.test(query.id)
    && typeof query.token === 'string' && /^[a-f0-9]{64}$/.test(query.token)
    && timingSafeEqual(Buffer.from(query.token, 'hex'), Buffer.from(savedReviewToken(query.id, env), 'hex'));
}

