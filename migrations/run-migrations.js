/**
 * SakhGO · Migration Runner
 *
 * Connects to PostgreSQL using the same environment variables as src/lib/pg.ts,
 * tracks which migrations have been applied in a `_migrations` table, and runs
 * new .sql files in sorted order.
 *
 * Usage:  node migrations/run-migrations.js
 * Via npm: npm run db:migrate
 *
 * Environment variables (matching pg.ts defaults for production):
 *   DB_HOST     — default: localhost
 *   DB_PORT     — default: 5432
 *   DB_NAME     — default: sakhgo
 *   DB_USER     — default: sakhgo
 *   DB_PASSWORD — default: sakhgo_dev_2026
 *
 * The defaults here match production; pg.ts has dev defaults (port 5433).
 * When running in production, set the env vars or rely on defaults.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// ── Config (same source as pg.ts, production-oriented defaults) ─────────────
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "sakhgo",
  user: process.env.DB_USER || "sakhgo",
  password: process.env.DB_PASSWORD || "sakhgo_dev_2026",
});

const MIGRATIONS_DIR = path.join(__dirname);

// ── Bootstrap: ensure _migrations table exists ─────────────────────────────
async function bootstrap() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        serial PRIMARY KEY,
        filename  text NOT NULL UNIQUE,
        hash      text,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log("✓ Migration tracking table ready (_migrations)");
  } finally {
    client.release();
  }
}

// ── Get already-applied migrations ─────────────────────────────────────────
async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT filename FROM _migrations ORDER BY filename"
    );
    return new Set(res.rows.map((r) => r.filename));
  } finally {
    client.release();
  }
}

// ── Compute a simple hash of file contents (for change detection logging) ──
function hashContent(content) {
  // Simple djb2 hash — no crypto module needed, fast for strings
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = (h * 33) ^ content.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

// ── Run a single migration file ────────────────────────────────────────────
async function runMigration(filename, applied) {
  if (applied.has(filename)) {
    console.log(`  … ${filename} — already applied, skipping`);
    return;
  }

  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, "utf8");

  console.log(`  ▶ ${filename} …`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    const hash = hashContent(sql);
    await client.query(
      "INSERT INTO _migrations (filename, hash) VALUES ($1, $2)",
      [filename, hash]
    );
    await client.query("COMMIT");
    console.log(`    ✓ done`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`    ✗ FAILED: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

// ── Discover SQL files in the migrations directory ─────────────────────────
function discoverMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f) && f !== ".template.sql")
    .sort();
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n═══ SakhGO · Migration Runner ═══\n");

  // 1. Bootstrap the tracking table
  await bootstrap();

  // 2. Discover + filter
  const files = discoverMigrations();
  const applied = await getAppliedMigrations();

  console.log(`\nPending migrations: ${files.filter((f) => !applied.has(f)).length} of ${files.length}\n`);

  if (files.length === 0) {
    console.log("No migration files found.\n");
    await pool.end();
    return;
  }

  // 3. Run each file in order
  let failed = false;
  for (const file of files) {
    try {
      await runMigration(file, applied);
    } catch {
      failed = true;
      break;
    }
  }

  await pool.end();

  if (failed) {
    console.error("\n✕ Migration failed. Fix the error and re-run.\n");
    process.exit(1);
  }

  console.log("\n✓ All migrations complete.\n");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
