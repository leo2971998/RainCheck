import { localReviewAllowed } from './_local-workspace.js';
import { consumeChatLimit } from './_chat-access.js';

// Shared demo purchases use the existing local-demo table. This does not grant
// access to bank mutations or the separate local-only AI review endpoints.
export function purchaseAccess(req, env = process.env) {
  if (localReviewAllowed(req, env)) return 'local';
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.RAINCHECK_SHARED_DEMO !== '1'
      || !env.NESSIE_KEY || !env.NESSIE_CUSTOMER_ID || !env.NESSIE_CHECKING_ID || !env.NESSIE_SAVINGS_ID
      || !/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(env.SUPABASE_URL || '') || !env.SUPABASE_SECRET_KEY
      || (env.RAINCHECK_CHAT_RATE_SECRET || '').length < 32) return null;
  try {
    const url = new URL(env.RAINCHECK_DEMO_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.RAINCHECK_DEMO_ORIGIN || req.headers?.host !== url.host) return null;
    return 'shared';
  } catch { return null; }
}

export function purchaseOriginAllowed(req, mode, env = process.env) {
  if (!mode || req.headers?.['sec-fetch-site'] === 'cross-site') return false;
  const expected = mode === 'local' ? `http://${req.headers.host}` : env.RAINCHECK_DEMO_ORIGIN;
  if (req.method === 'GET') return !req.headers?.origin || req.headers.origin === expected;
  return req.headers?.origin === expected && req.headers['content-type']?.split(';')[0] === 'application/json';
}

export async function checkPurchaseLimit(req, res, env, limit = consumeChatLimit) {
  try {
    // Share the existing durable demo-action quota with chat context requests.
    // No new table, raw IP storage or instance-local rate counter is needed.
    const result = await limit(req, 'context', env);
    if (result.allowed) return true;
    res.setHeader('Retry-After', String(result.retryAfter || 60));
    res.status(429).json({ message: 'Several demo changes were made recently. Please wait a moment and try again. Nothing was changed.' });
  } catch {
    res.status(503).json({ message: 'Saving is temporarily unavailable. Please try again shortly. Nothing was changed.' });
  }
  return false;
}
