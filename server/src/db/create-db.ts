/**
 * Create database if not exists. Run before migrate.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const baseUrl = process.env.DATABASE_URL?.replace(/\/21day.*$/, '') || 'postgresql://postgres:postgres@localhost:5432';
const conn = new pg.Client({ connectionString: baseUrl + '/postgres' });

async function run() {
  await conn.connect();
  const res = await conn.query(
    "SELECT 1 FROM pg_database WHERE datname = '21day'"
  );
  if (res.rows.length === 0) {
    await conn.query('CREATE DATABASE "21day"');
    console.log('Database 21day created');
  } else {
    console.log('Database 21day already exists');
  }
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
