#!/usr/bin/env node
/**
 * Auto-record a build in the builds history table.
 * Reads DB credentials from environment variables.
 * Usage: node scripts/record-build.js
 */

const { Pool } = require("pg");

if (!process.env.DB_PASSWORD) {
  console.error("[auto-record] DB_PASSWORD not set in environment");
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  port:     parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME     || "sakhgo",
  user:     process.env.DB_USER     || "sakhgo",
  password: process.env.DB_PASSWORD,
});

async function main() {
  const { execSync } = require("child_process");
  const hash    = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const branch  = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const msg     = execSync("git log -1 --pretty=%B", { encoding: "utf8" }).trim().split("\n")[0];
  const version = require("../package.json").version;
  const date    = new Date().toISOString().split("T")[0];

  // Check for duplicate
  const { rows } = await pool.query(
    "SELECT id FROM builds WHERE hash = $1 AND version = $2",
    [hash, version]
  );
  if (rows.length > 0) {
    console.log("[auto-record] Build v" + version + " (" + hash + ") already recorded, skipping");
    await pool.end();
    return;
  }

  await pool.query(
    "INSERT INTO builds (version, date, description, hash, changes) VALUES ($1, $2, $3, $4, $5)",
    [version, date, msg, hash, JSON.stringify([msg])]
  );

  console.log("[auto-record] Build v" + version + " (" + hash + ") recorded");
  await pool.end();
}

main().catch((e) => {
  console.error("[auto-record] Error:", e.message);
  process.exit(1);
});
