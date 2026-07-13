// api/setup.js — GET /api/setup (one-time DB + user setup)
const { pool } = require('./_lib/db');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    const results = [];
    try {
        // Tablas
        await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL, nombre_completo VARCHAR(255) DEFAULT '',
            username VARCHAR(100) UNIQUE NOT NULL, edad INT DEFAULT 0,
            rol VARCHAR(50) DEFAULT 'estudiante', created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ usuarios');

        await pool.query(`CREATE TABLE IF NOT EXISTS noticias (
            id SERIAL PRIMARY KEY, titulo VARCHAR(255) NOT NULL,
            contenido TEXT NOT NULL, imagen_url TEXT, video_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ noticias');

        await pool.query(`CREATE TABLE IF NOT EXISTS notas (
            id SERIAL PRIMARY KEY, estudiante_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
            materia VARCHAR(100) NOT NULL, parcial1 NUMERIC(5,2) DEFAULT 0,
            parcial2 NUMERIC(5,2) DEFAULT 0, examen_final NUMERIC(5,2) DEFAULT 0,
            nota_final NUMERIC(5,2) DEFAULT 0, editado_por VARCHAR(255), fecha_edicion TIMESTAMPTZ)`);
        results.push('✅ notas');

        await pool.query(`CREATE TABLE IF NOT EXISTS galeria (
            id SERIAL PRIMARY KEY, titulo VARCHAR(255) NOT NULL DEFAULT '',
            descripcion TEXT DEFAULT '', album VARCHAR(100) DEFAULT 'general',
            url VARCHAR(500) NOT NULL, public_id VARCHAR(200) NOT NULL,
            width INT DEFAULT 0, height INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ galeria');

        // Admin
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('reyesbrostec', salt);
        await pool.query(`INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol)
            VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
            ['rybr0ss@colegio.com', adminHash, 'Administrador', 'admin', 0, 'admin']);
        results.push('✅ admin (rybr0ss@colegio.com / reyesbrostec)');

        // Docente
        const docenteHash = await bcrypt.hash('profesor123', salt);
        await pool.query(`INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol)
            VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
            ['docente@colegio.com', docenteHash, 'Docente Principal', 'docente', 0, 'docente']);
        results.push('✅ docente (docente@colegio.com / profesor123)');

        res.json({ ok: true, results });
    } catch (err) {
        console.error('Error en setup:', err);
        res.status(500).json({ ok: false, message: err.message, detail: err.stack, results });
    }
};
