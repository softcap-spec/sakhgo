// Auto-record build to DB — run during deploy
const { execSync } = require('child_process');
const { Pool } = require('pg');
const path = require('path');

async function main() {
  const projectDir = '/home/alex/sakhgo';
  const pkg = require(path.join(projectDir, 'package.json'));

  const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: projectDir }).trim();
  const date = execSync('git log -1 --format=%cd --date=short HEAD', { encoding: 'utf8', cwd: projectDir }).trim();
  const msg = execSync('git log -1 --format=%s HEAD', { encoding: 'utf8', cwd: projectDir }).trim();

  const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'sakhgo',
    user: 'sakhgo',
    password: 'REDACTED',
  });

  try {
    const { rows: exists } = await pool.query(
      'SELECT id FROM builds WHERE hash = $1 AND version = $2',
      [hash, pkg.version]
    );
    if (exists.length > 0) {
      console.log(`[auto-record] Build v${pkg.version} (${hash}) already recorded, skipping`);
      return;
    }

    await pool.query(
      `INSERT INTO builds (version, date, description, hash, changes)
       VALUES ($1, $2, $3, $4, $5)`,
      [pkg.version, date, msg, hash, JSON.stringify([])]
    );
    console.log(`[auto-record] Build v${pkg.version} (${hash}) recorded`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[auto-record] Failed:', e.message);
  process.exit(1);
});
