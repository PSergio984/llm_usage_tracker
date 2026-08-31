import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/llm_usage_tracker';

export const pool = new pg.Pool({
  connectionString,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[pool] unexpected error', err);
  process.exit(1);
});
