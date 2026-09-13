import { localReviewAllowed } from './_local-workspace.js';

export function createSessionHandler({ env = process.env, request = fetch } = {}) {
  let attempts = [];
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const available = localReviewAllowed(req, env) && !!env.ELEVENLABS_API_KEY && !!env.ELEVENLABS_AGENT_ID;
    if (req.method === 'GET') return res.status(200).json({ available });
    if (!available) return res.status(403).json({ message: 'Chat is available in the local test workspace only for now.' });
    if (req.method !== 'POST') return res.status(405).json({ message: 'Start a chat from RainCheck.' });
    if (req.headers?.origin !== `http://${req.headers.host}` || req.headers['content-type']?.split(';')[0] !== 'application/json')
      return res.status(403).json({ message: 'Open RainCheck locally to start a chat.' });
    if (!req.body || req.body.consent !== true || Object.keys(req.body).length !== 1)
      return res.status(400).json({ message: 'Please allow cloud chat before starting.' });
    attempts = attempts.filter(t => t > Date.now() - 60000);
    if (attempts.length >= 5) return res.status(429).json({ message: 'Please wait a minute before starting another chat.' });
    attempts.push(Date.now());
    try {
      const response = await request(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}`, {
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Unavailable');
      const { signed_url: signedUrl } = await response.json();
      const url = new URL(signedUrl);
      if (url.protocol !== 'wss:' || url.hostname !== 'api.elevenlabs.io' || url.pathname !== '/v1/convai/conversation') throw new Error('Invalid session');
      return res.status(200).json({ signedUrl });
    } catch {
      return res.status(503).json({ message: 'Chat could not connect right now. Please try again. Your plan is unchanged.' });
    }
  };
}
export default createSessionHandler();
