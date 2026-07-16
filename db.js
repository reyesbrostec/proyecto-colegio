const { Pool } = require('pg');

// ── Pool optimizado para Neon serverless + Vercel ──
// Neon ya tiene pooler integrado (hostname contiene "-pooler"),
// por lo que usamos pocas conexiones locales. Cada cold start
// de Vercel crea una instancia nueva del pool.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    // Neon pooler maneja la concurrencia — mantener esto bajo
    max: 3,
    // Liberar rápido en serverless para no colgar la función
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    // Reciclar conexiones antes del timeout de Neon (5 min inactivo)
    maxLifetimeMillis: 240000,
    // Permitir que el event loop se cierre cuando no hay conexiones activas
    allowExitOnIdle: true,
});

pool.on('error', (err) => {
    console.error('⚠️ Error del pool de DB:', err.message);
});

module.exports = pool;