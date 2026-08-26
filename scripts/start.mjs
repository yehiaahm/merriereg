// Cross-platform production start script.
//
// `next start` does NOT read process.env.PORT on its own — it only listens
// on the port passed via `-p`. Railway assigns a random port at runtime via
// the PORT env var and routes traffic to exactly that port, so without this
// the app would always bind to 3000 and Railway's health checks/routing
// would fail. This is plain Node (not bash `${PORT:-3000}` syntax) so it
// also works unchanged in local Windows dev.
//
// Invokes Next's CLI entry file directly via `node <entry> start -p <port>`
// rather than spawning `npx`/`next` through a shell, so no argument
// escaping/shell-injection surface exists at all.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env ourselves (minimal parser, no dependency) before checking
// required vars below — this script runs before Next's own CLI code (which
// is what normally loads .env) even gets required. On Railway there is no
// .env file at all (the platform injects real env vars directly into the
// process), so this is a local-dev-only convenience and silently no-ops in
// production.
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Fail fast with a clear message if required config is missing, instead of
// booting successfully and only crashing (cryptically) on the first request
// that touches the database or a customer session cookie.
const REQUIRED_ENV = ['MERRIER_DATABASE_URL', 'CUSTOMER_SESSION_SECRET'];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('Set these in the Railway service Variables tab before deploying.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.CUSTOMER_SESSION_SECRET === 'change-me') {
    console.warn('⚠️ WARNING: Using default CUSTOMER_SESSION_SECRET in production! Please generate a secure random 32-byte secret.');
  }
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const port = process.env.PORT || '3000';

const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
