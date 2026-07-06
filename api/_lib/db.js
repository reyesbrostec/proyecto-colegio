// api/_lib/db.js — Helper de base de datos con Vercel Postgres
const { sql } = require('@vercel/postgres');

// sql usa automáticamente POSTGRES_URL (inyectada por Vercel al conectar una DB)
module.exports = { sql };
