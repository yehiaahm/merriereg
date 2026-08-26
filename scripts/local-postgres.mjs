// Starts a real, local PostgreSQL instance for development — no Docker, no
// manual Postgres install. This exists because prisma/schema.prisma targets
// `postgresql` everywhere (local dev included), so what gets tested locally
// is exactly what runs on Railway; there is no separate SQLite-for-dev path
// to drift out of sync with production.
//
// Idempotent: safe to run every time before `dev`/`db:migrate`/`db:seed` —
// it only initialises the cluster once and only starts it if it isn't
// already listening.
import EmbeddedPostgresImport from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import net from 'node:net';

const EmbeddedPostgres = EmbeddedPostgresImport.default ?? EmbeddedPostgresImport;

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '.local-postgres-data');
const PORT = 55433;
const USER = 'merrier';
const PASSWORD = 'merrier';
const DB = 'merrier';

export const LOCAL_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (await isPortOpen(PORT)) {
    console.log(`Local Postgres already running on port ${PORT}.`);
    console.log(LOCAL_DATABASE_URL);
    return;
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  const firstRun = !existsSync(dataDir);
  if (firstRun) {
    console.log('Initialising local Postgres cluster (first run only)...');
    await pg.initialise();
  }

  console.log('Starting local Postgres...');
  await pg.start();

  if (firstRun) {
    await pg.createDatabase(DB);
  }

  console.log(`Local Postgres ready: ${LOCAL_DATABASE_URL}`);
}

main().catch((err) => {
  console.error('Failed to start local Postgres:', err);
  process.exit(1);
});
