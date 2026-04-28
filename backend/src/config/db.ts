import { Pool, types } from 'pg'

// ── Type parsers to match Supabase client behavior ──

// DATE (1082) → return as "YYYY-MM-DD" string, not Date object
types.setTypeParser(1082, (val: string) => val)

// NUMERIC (1700) → return as number, not string
types.setTypeParser(1700, (val: string) => parseFloat(val))

// BIGINT (20) → return as number (safe for JS up to 2^53)
types.setTypeParser(20, (val: string) => parseInt(val, 10))

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
