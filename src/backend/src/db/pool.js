import pg from 'pg';

const { Pool, types } = pg;

// DATE columns (e.g. accommodations.start_date) default to parsing into a JS
// Date, which round-trips through JSON as a UTC datetime and can shift the
// calendar day depending on the server's timezone. Keep the raw 'YYYY-MM-DD'
// string instead.
types.setTypeParser(types.builtins.DATE, (val) => val);

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
