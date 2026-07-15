// api/_lib/db.js — Helper de base de datos (pg Pool directo)
// NOTA: Neon PostgreSQL requiere SSL sin verificación de CA en entornos serverless.
// rejectUnauthorized: false es necesario para Neon; en producción con PostgreSQL
// propio, cambiar a rejectUnauthorized: true con CA proporcionada.
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

// También exportamos sql de @vercel/postgres para queries simples
let sql;
try { const vp = require('@vercel/postgres'); sql = vp.sql; } catch (e) { sql = null; }

module.exports = { pool, sql };
