import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';

/**
 * Serves the files in api/ during `npm run dev`, the way Vercel serves them in production.
 * Without this the app can only ever run on sample data locally, because /api/* 404s and the
 * fetch falls back silently — which is exactly how a broken Nessie wiring goes unnoticed.
 */
function apiRoutes(env) {
  return {
    name: 'raincheck-api',
    configureServer(server) {
      Object.assign(process.env, env);           // handlers read secrets from process.env
      const routes = readdirSync(new URL('./api/', import.meta.url))
        .filter(f => f.endsWith('.js') && !f.startsWith('_'))
        .map(f => f.replace(/\.js$/, ''));

      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0].replace(/\/$/, '');
        const name = path.startsWith('/api/') ? path.slice(5) : null;
        if (!name || !routes.includes(name)) return next();

        try {
          const body = await readJson(req);
          const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`);
          await handler({ ...req, method: req.method, body, query: {} }, shim(res));
        } catch (err) {
          console.error(`[api/${name}]`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'The local API route failed.', detail: String(err?.message || err) }));
        }
      });

      server.httpServer?.once('listening', () => {
        const mode = env.VITE_DATA_MODE === 'nessie' ? 'live Nessie sandbox' : 'sample data';
        console.log(`\n  RainCheck API: ${routes.map(r => '/api/' + r).join(', ')}  ·  data source: ${mode}\n`);
      });
    },
  };
}

function readJson(req) {
  if (req.method !== 'POST' && req.method !== 'PUT') return Promise.resolve(undefined);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

/** The small slice of the Vercel response object the handlers actually use. */
function shim(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) { res.statusCode = code; return this; },
    json(payload) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return this; },
    end(payload) { res.end(payload); return this; },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');   // '' so server-only names load too, not just VITE_*
  return { plugins: [react(), apiRoutes(env)] };
});
