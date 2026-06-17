import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const backend = resolve(here, '..');

for (const file of [
  resolve(root, '.env.local'),
  resolve(root, '.env'),
  resolve(backend, '.env.local'),
  resolve(backend, '.env'),
]) {
  loadEnvFile(file);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to apply the Postgres schema.');
}

const schemaPath = resolve(backend, 'db/schema.sql');
const schema = await readFile(schemaPath, 'utf8');
const client = new Client({
  connectionString: databaseUrl,
  ssl: sslConfig(),
});

try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(schema);
  await client.query('COMMIT');
  console.log('Postgres schema applied successfully.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sslConfig() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  if (process.env.DATABASE_SSL_CA_FILE) {
    return {
      rejectUnauthorized: true,
      ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, 'utf8'),
    };
  }
  return { rejectUnauthorized: true };
}
