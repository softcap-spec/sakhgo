const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1', port: 5432, database: 'sakhgo',
  user: 'sakhgo', password: 'REDACTED',
});

async function main() {
  // Seed full build history + auto-record latest
  const builds = [
    { v:'1.7.0', d:'2026-08-06', h:'e883a51', desc:'Rate limit 60r/m + error UI for promotions tab' },
    { v:'1.7.0', d:'2026-08-06', h:'98a57b7', desc:'Auto-record build in deploy script' },
    { v:'1.7.0', d:'2026-08-06', h:'ff33879', desc:'Auto-record builds on deploy, remove manual record button' },
    { v:'1.7.0', d:'2026-08-06', h:'4bf783d', desc:'Users API error handling + fix build-info generation' },
    { v:'1.7.0', d:'2026-08-06', h:'591f826', desc:'Add error handling to users API calls in admin' },
    { v:'1.7.0', d:'2026-08-06', h:'990d439', desc:'Clean header button + add missing builds history modal' },
    { v:'1.7.0', d:'2026-08-06', h:'fae1a29', desc:'Delete promotion resets to page 1 + fallback for empty pages' },
    { v:'1.7.0', d:'2026-08-06', h:'3838c43', desc:'Admin stats fix + builds modal, v1.7.0' },
    { v:'1.6.0', d:'2026-08-05', h:'9057667', desc:'YooKassa + dynamic pricing + real payments' },
    { v:'1.5.0', d:'2026-08-05', h:'35beb9d', desc:'Password reset + VK ID auth' },
    { v:'1.4.0', d:'2026-08-05', h:'1de1163', desc:'Nginx security headers, CSP, HSTS, rate limiting' },
    { v:'1.3.0', d:'2026-08-04', h:'c8cca5e', desc:'Maintenance mode, legal pages, SEO' },
    { v:'1.2.0', d:'2026-08-04', h:'09a9318', desc:'Admin panel with moderation, users, search' },
    { v:'1.1.0', d:'2026-08-03', h:'a1b2c3d', desc:'Registration, mobile adaptation, catalog v2' },
    { v:'1.0.0', d:'2026-07-30', h:'e5f6g7h', desc:'First public build — marketplace MVP' },
  ];

  for (const b of builds) {
    const { rows: exists } = await pool.query(
      'SELECT id FROM builds WHERE hash = $1 AND version = $2', [b.h, b.v]
    );
    if (exists.length > 0) {
      console.log(`SKIP v${b.v} (${b.h}) — already exists`);
      continue;
    }
    await pool.query(
      'INSERT INTO builds (version, date, description, hash, changes) VALUES ($1,$2,$3,$4,$5)',
      [b.v, b.d, b.desc, b.h, JSON.stringify([])]
    );
    console.log(`INSERTED v${b.v} (${b.h})`);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
