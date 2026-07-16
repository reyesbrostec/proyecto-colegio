// migrate.js — Crea las tablas automáticamente si no existen
const pool = require('./db');
const bcrypt = require('bcryptjs');

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

        // Añadir columnas de media (si no existen)
        await pool.query(`ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen_url TEXT;`);
        await pool.query(`ALTER TABLE noticias ADD COLUMN IF NOT EXISTS video_url TEXT;`);
        console.log('✅ Columnas media (noticias): OK');

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

        // ── Insertar usuarios por defecto (admin + docente) ──
        const salt = await bcrypt.genSalt(10);

        // Admin
        const adminHash = await bcrypt.hash('reyesbrostec', salt);
        await pool.query(`
            INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING;
        ['admin@colegio.com', adminHash, 'Administrador', 'admin', 0, 'admin']);
        console.log('✅ Usuario admin: OK');

        // Docente
        const docenteHash = await bcrypt.hash('profesor123', salt);
        await pool.query(`
            INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING;
        `, ['docente@colegio.com', docenteHash, 'Docente Principal', 'docente', 0, 'docente']);
        console.log('✅ Usuario docente: OK');

        console.log('🎉 Migraciones completadas.');
    } catch (err) {
        console.error('❌ Error en migraciones:', err.message);
        // No tiramos el servidor — permitimos que siga aunque falle la migración
    }
}

module.exports = migrate;
