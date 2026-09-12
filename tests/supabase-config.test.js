import { describe, expect, it } from 'vitest';
import { databaseConfig } from '../scripts/supabase-db.mjs';

const env = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_DB_HOST: 'aws-0-ca-central-1.pooler.supabase.com', SUPABASE_DB_PORT: '5432',
  SUPABASE_DB_USER: 'postgres.abcdefghijklmnopqrst', SUPABASE_DB_NAME: 'postgres',
  SUPABASE_DB_PASSWORD: 'raw:#$@password' };

describe('Supabase setup connection', () => {
  it('verifies the server certificate and preserves a raw password', () => {
    const config = databaseConfig(env);
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toContain('BEGIN CERTIFICATE');
    expect(config.password).toBe(env.SUPABASE_DB_PASSWORD);
    expect(config.connectionTimeoutMillis).toBe(10000);
  });
  it('refuses missing passwords without echoing credentials', () => {
    expect(() => databaseConfig({ ...env, SUPABASE_DB_PASSWORD: '' })).toThrow('SUPABASE_DB_PASSWORD');
  });
  it('refuses a database user for another project', () => {
    expect(() => databaseConfig({ ...env, SUPABASE_DB_USER: 'postgres.other' })).toThrow('project');
  });
});
