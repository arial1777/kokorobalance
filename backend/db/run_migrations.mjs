import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!PASSWORD || !REF) {
  console.error(
    'SUPABASE_DB_PASSWORD と SUPABASE_PROJECT_REF を環境変数で指定してください。',
  );
  process.exit(1);
}

const regions = [
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
  'sa-east-1', 'ca-central-1',
];
const clusters = ['aws-0', 'aws-1', 'aws-2'];
const ports = [6543, 5432];

const attempts = [
  // Direct connection (region-agnostic, resolves per-project)
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  ...clusters.flatMap((cluster) =>
    ports.flatMap((port) =>
      regions.map((region) => ({
        host: `${cluster}-${region}.pooler.supabase.com`,
        port,
        user: `postgres.${REF}`,
      })),
    ),
  ),
];

async function tryConnect({ host, port, user }) {
  const client = new Client({
    host, port, user,
    password: PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function main() {
  let client;

  for (const attempt of attempts) {
    try {
      process.stdout.write(`Trying ${attempt.host}:${attempt.port} ... `);
      client = await tryConnect(attempt);
      console.log('Connected!');
      break;
    } catch (e) {
      console.log(`Failed: ${e.message.split('\n')[0]}`);
    }
  }

  if (!client) {
    console.error('\nAll connection attempts failed.');
    process.exit(1);
  }

  const sqlFile = join(__dirname, 'migrations', 'all_migrations.sql');
  const sql = readFileSync(sqlFile, 'utf8');

  console.log('\nRunning migrations...');
  try {
    await client.query(sql);
    console.log('Migrations applied successfully!');
  } catch (e) {
    console.error('Migration error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
