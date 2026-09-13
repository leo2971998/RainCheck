/** This prototype has no public user ownership yet. Never enable local mutations on hosting. */
export function localReviewAllowed(req, env = process.env) {
  return env.RAINCHECK_AI_LOCAL === '1' && !env.VERCEL && env.NODE_ENV !== 'production'
    && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)
    && /^(127\.0\.0\.1|localhost|\[::1\]):5176$/.test(req.headers?.host || '');
}
