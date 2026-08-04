import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433", 10),
  database: process.env.DB_NAME || "sakhgo",
  user: process.env.DB_USER || "sakhgo",
  password: process.env.DB_PASSWORD || "sakhgo_dev_2026",
});

export default pool;
