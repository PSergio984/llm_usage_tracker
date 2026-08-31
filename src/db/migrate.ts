import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const dir = path.join(__dirname, '../../migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  console.log(`[migrate] found ${files.length} files`);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] applying ${file} ...`);
    await pool.query(sql);
    console.log(`[migrate] done ${file}`);
  }
  await pool.end();
  console.log('[migrate] all done');
}

migrate().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
