import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { localReviewAllowed } from './_local-workspace.js';

// Public chat is a separate read-only capability. Never relax the mutation/review gate.
export function chatAccess(req, env = process.env) {
  if (localReviewAllowed(req, env)) return 'local';
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.RAINCHECK_PUBLIC_CHAT !== '1'
      || !/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(env.SUPABASE_URL || '')
      || !env.SUPABASE_SECRET_KEY || (env.RAINCHECK_CHAT_RATE_SECRET || '').length < 32) return null;
  try {
    const url = new URL(env.RAINCHECK_CHAT_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== env.RAINCHECK_CHAT_ORIGIN || req.headers?.host !== url.host) return null;
    return 'public';
  } catch { return null; }
}

export function chatOriginAllowed(req, mode, env = process.env) {
  const expected = mode === 'local' ? `http://${req.headers.host}` : env.RAINCHECK_CHAT_ORIGIN;
  return !!mode && req.headers?.origin === expected && req.headers['content-type']?.split(';')[0] === 'application/json';
}

export async function consumeChatLimit(req, kind, env = process.env, request = fetch) {
  // Only called behind the Vercel-only public gate; this header is set by Vercel.
  const ip = req.headers?.['x-vercel-forwarded-for'];
  if (typeof ip !== 'string' || !isIP(ip) || !['session','context'].includes(kind)) throw new Error('Chat limits unavailable');
  const subject = createHmac('sha256', env.RAINCHECK_CHAT_RATE_SECRET).update(ip).digest('hex');
  const response = await request(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/raincheck_chat_quota`, {
    method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_subject: subject, p_kind: kind }), signal: AbortSignal.timeout(8000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Chat limits unavailable');
  const result = await response.json();
  if (typeof result?.allowed !== 'boolean' || !Number.isInteger(result.retryAfter) || result.retryAfter < 0 || result.retryAfter > 86400)
    throw new Error('Chat limits unavailable');
  return result;
}

export async function checkChatLimit(req, res, kind, env, limit = consumeChatLimit) {
  try {
    const result = await limit(req, kind, env);
    if (result.allowed) return true;
    res.setHeader('Retry-After', String(result.retryAfter || 60));
    res.status(429).json({ message: 'The demo is taking a short break after several requests. Please try again later. Your plan is unchanged.' });
  } catch {
    res.status(503).json({ message: 'Chat is temporarily unavailable. Please try again shortly. Your plan is unchanged.' });
  }
  return false;
}
