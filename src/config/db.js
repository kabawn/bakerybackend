import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

// Disable SSL verify for Supabase on Windows
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
   ssl: true,
});

export default pool;
