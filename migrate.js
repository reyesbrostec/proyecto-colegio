// migrate.js — Crea las tablas automáticamente si no existen
const pool = require('./db');

async function migrate() {
    console.log('🔧 Ejecutando migraciones...');
    
    try {
        // Tabla usuarios
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                nombre_completo VARCHAR(255) DEFAULT '',
                username VARCHAR(100) UNIQUE NOT NULL,
                edad INT DEFAULT 0,
                rol VARCHAR(50) DEFAULT 'estudiante',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Tabla usuarios: OK');

        // Tabla noticias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS noticias (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                contenido TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Tabla noticias: OK');

        // Tabla notas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notas (
                id SERIAL PRIMARY KEY,
                estudiante_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
                materia VARCHAR(100) NOT NULL,
                parcial1 NUMERIC(5,2) DEFAULT 0,
                parcial2 NUMERIC(5,2) DEFAULT 0,
                examen_final NUMERIC(5,2) DEFAULT 0,
                nota_final NUMERIC(5,2) DEFAULT 0,
                editado_por VARCHAR(255),
                fecha_edicion TIMESTAMPTZ
            );
        `);
        console.log('✅ Tabla notas: OK');

        // Tabla galeria
        await pool.query(`
            CREATE TABLE IF NOT EXISTS galeria (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL DEFAULT '',
                descripcion TEXT DEFAULT '',
                album VARCHAR(100) DEFAULT 'general',
                url VARCHAR(500) NOT NULL,
                public_id VARCHAR(200) NOT NULL,
                width INT DEFAULT 0,
                height INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Tabla galeria: OK');

        console.log('🎉 Migraciones completadas.');
    } catch (err) {
        console.error('❌ Error en migraciones:', err.message);
        // No tiramos el servidor — permitimos que siga aunque falle la migración
    }
}

module.exports = migrate;
