import { Pool } from "pg";

if (!process.env.DB_PASSWORD) {
  throw new Error("DB_PASSWORD is not set — refusing to start with no explicit database password");
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433", 10),
  database: process.env.DB_NAME || "sakhgo",
  user: process.env.DB_USER || "sakhgo",
  password: process.env.DB_PASSWORD,
});

export default pool;
