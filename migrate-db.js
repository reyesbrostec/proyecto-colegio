require('dotenv').config(); // Carga las variables de entorno desde .env
const { Pool } = require('pg');

// La configuración de la conexión se toma de la variable de entorno DATABASE_URL
// que debes tener en tu archivo .env apuntando a tu base de datos de Render.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- QUERIES DE MIGRACIÓN ---
// Estos comandos ALTERAN la tabla 'notas' para añadir las columnas que faltan.
// Usamos "IF NOT EXISTS" para que el script se pueda ejecutar varias veces sin dar error.
const migrationQueries = `
    ALTER TABLE notas ADD COLUMN IF NOT EXISTS editado_por VARCHAR(255);
    ALTER TABLE notas ADD COLUMN IF NOT EXISTS fecha_edicion TIMESTAMP WITH TIME ZONE;
`;

async function migrateDatabase() {
    console.log('Iniciando script de migración de base de datos...');
    const client = await pool.connect();
    try {
        await client.query(migrationQueries);
        console.log('✅ ¡Migración completada! Las columnas "editado_por" y "fecha_edicion" se han añadido a la tabla "notas".');
    } catch (err) {
        console.error('❌ Error durante la migración de la base de datos:', err);
    } finally {
        await client.release();
        await pool.end();
        console.log('Script de migración finalizado.');
    }
}

migrateDatabase();