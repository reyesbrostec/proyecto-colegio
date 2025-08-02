const { Pool } = require('pg');

// La configuración de la conexión se toma automáticamente de las variables de entorno
// que Render establece (DATABASE_URL).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;