// ensure-db.js — NON-destructive DB initializer
// Creates tables IF NOT EXISTS, inserts admin user IF NOT EXISTS
// Safe to run multiple times on Render production database
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function ensureDatabase() {
    console.log('🔧 Verificando base de datos...');
    const client = await pool.connect();
    try {
        // 1. Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre_completo VARCHAR(255),
                username VARCHAR(100) UNIQUE,
                edad INT,
                rol VARCHAR(50) DEFAULT 'estudiante' NOT NULL,
                creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "usuarios" verificada.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS noticias (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                contenido TEXT,
                imagen_url TEXT,
                video_url TEXT,
                creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla "noticias" verificada (con imagen_url y video_url).');

        await client.query(`
            CREATE TABLE IF NOT EXISTS notas (
                id SERIAL PRIMARY KEY,
                estudiante_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
                materia VARCHAR(100) NOT NULL,
                parcial1 NUMERIC(4, 2),
                parcial2 NUMERIC(4, 2),
                examen_final NUMERIC(4, 2),
                nota_final NUMERIC(4, 2),
                editado_por VARCHAR(255),
                fecha_edicion TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('✅ Tabla "notas" verificada.');

        // 2. Add imagen_url and video_url columns if they don't exist
        await client.query(`ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen_url TEXT;`);
        await client.query(`ALTER TABLE noticias ADD COLUMN IF NOT EXISTS video_url TEXT;`);
        console.log('✅ Columnas imagen_url y video_url verificadas en noticias.');

        // 3. Create admin user if not exists
        const adminCheck = await client.query('SELECT id FROM usuarios WHERE email = $1', ['admin@colegio.com']);
        if (adminCheck.rows.length === 0) {
            const salt = await bcrypt.genSalt(12);
            const password_hash = await bcrypt.hash('reyesbrostec', salt);
            await client.query(
                `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['admin@colegio.com', password_hash, 'Administrador', 'admin', 'admin']
            );
            console.log('✅ Usuario administrador creado: admin@colegio.com / admin477');
        } else {
            console.log('✅ Usuario administrador ya existe.');
        }

        // 4. Create docente user if not exists
        const docenteCheck = await client.query('SELECT id FROM usuarios WHERE email = $1', ['docente@colegio.com']);
        if (docenteCheck.rows.length === 0) {
            const salt = await bcrypt.genSalt(12);
            const password_hash = await bcrypt.hash('profesor123', salt);
            await client.query(
                `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['docente@colegio.com', password_hash, 'Profesor Ejemplo', 'profe_ejemplo', 'docente']
            );
            console.log('✅ Usuario docente creado: docente@colegio.com / profesor123');
        } else {
            console.log('✅ Usuario docente ya existe.');
        }

        console.log('\n🎉 ¡Base de datos lista!');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        await client.release();
        await pool.end();
    }
}

ensureDatabase();
