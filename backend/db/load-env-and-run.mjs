import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = join(__dirname, '..', '.env.migrate.local');

const lines = readFileSync(envFile, 'utf8').split('\n');
for (const line of lines) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  process.env[key] = value;
}

await import('./run_migrations.mjs');
