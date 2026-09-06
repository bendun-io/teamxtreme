import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'teamxtreme',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'teamxtreme',
});

export function query(text, params) {
  return pool.query(text, params);
}
