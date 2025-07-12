require('dotenv').config();
const { Pool } = require('pg');

const createUsersTableQuery = `
  CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nombre VARCHAR(100),
      rol VARCHAR(50) DEFAULT 'estudiante' NOT NULL,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('Creando la tabla de usuarios...');
pool.query(createUsersTableQuery)
    .then(() => {
        console.log('✅ ¡Tabla "usuarios" verificada/creada exitosamente!');
        pool.end();
    })
    .catch(err => {
        console.error('❌ Error al crear la tabla "usuarios":', err);
        pool.end();
    });