import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { rootCertificates } from 'node:tls';
import pg from 'pg';

export function loadLocalEnv() {
  Object.assign(process.env, parseEnv(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')));
}

/** Setup scripts only; this privileged connection is never used by the browser. */
export function databaseConfig(env = process.env) {
  for (const key of ['SUPABASE_URL', 'SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PASSWORD']) {
    if (!env[key]) throw new Error(`Missing ${key}. Fill .env.local before database setup.`);
  }
  const project = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.SUPABASE_URL)?.[1];
  if (!project || env.SUPABASE_DB_USER !== `postgres.${project}`)
    throw new Error('The database user must match the Supabase project.');
  if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(env.SUPABASE_DB_HOST)
      || String(env.SUPABASE_DB_PORT || '5432') !== '5432' || env.SUPABASE_DB_NAME !== 'postgres')
    throw new Error('Use the project session pooler settings for database setup.');
  // Public CA from the project's Database > Settings > Download certificate link.
  // https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
  const certificate = readFileSync(new URL('./certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');
  return { host: env.SUPABASE_DB_HOST, port: 5432, database: 'postgres', user: env.SUPABASE_DB_USER,
    password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: true, ca: [...rootCertificates, certificate].join('\n') },
    connectionTimeoutMillis: 10000, statement_timeout: 30000, application_name: 'raincheck-setup' };
}

export async function openSetupDatabase() {
  const client = new pg.Client(databaseConfig());
  try { await client.connect(); return client; }
  catch (error) { await client.end().catch(() => {}); throw error; }
}
