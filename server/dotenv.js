// Minimal .env loader (zero deps). Only fills variables missing from the environment.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseDotenv(text) {
  const out = {};
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out[key] = value;
  }
  return out;
}

export function loadDotenv(envPath) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = envPath || resolve(here, '../.env');
  if (!existsSync(target)) return { loaded: false, path: target };
  const parsed = parseDotenv(readFileSync(target, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) process.env[key] = value;
  }
  return { loaded: true, path: target, keys: Object.keys(parsed) };
}
