// api/migrate.js — POST /api/migrate (one-time DB setup)
const { pool } = require('./_lib/db');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Usa POST para ejecutar migración' });

    const results = [];
    try {
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
            nota_final NUMERIC(5,2) DEFAULT 0, editado_por VARCHAR(255), fecha_edicion TIMESTAMPTZ,
            UNIQUE(estudiante_id, materia))`);
        results.push('✅ notas');

        await pool.query(`CREATE TABLE IF NOT EXISTS galeria (
            id SERIAL PRIMARY KEY, titulo VARCHAR(255) NOT NULL DEFAULT '',
            descripcion TEXT DEFAULT '', album VARCHAR(100) DEFAULT 'general',
            url VARCHAR(500) NOT NULL, public_id VARCHAR(200) NOT NULL,
            width INT DEFAULT 0, height INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ galeria');

        await pool.query(`CREATE TABLE IF NOT EXISTS documentos (
            id SERIAL PRIMARY KEY, titulo VARCHAR(255) NOT NULL,
            descripcion TEXT DEFAULT '', categoria VARCHAR(100) DEFAULT 'general',
            url VARCHAR(500) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ documentos');

        const salt = await bcrypt.genSalt(10);

        // ── Helper: insertar si no existe (por email y username) ──
        async function insertarUsuario(email, hash, nombre, username, rol) {
            const existe = await pool.query(
                'SELECT id FROM usuarios WHERE email = $1 OR username = $2', [email, username]);
            if (existe.rows.length > 0) return '⚠️ ya existe';
            await pool.query(
                'INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1,$2,$3,$4,$5,$6)',
                [email, hash, nombre, username, 0, rol]);
            return '✅';
        }

        const rAdmin = await insertarUsuario('rybr0ss@colegio.com',
            await bcrypt.hash('reyesbrostec', salt), 'Administrador', 'admin', 'admin');
        results.push(rAdmin + ' admin (rybr0ss@colegio.com / reyesbrostec)');

        const rDocente = await insertarUsuario('docente@colegio.com',
            await bcrypt.hash('profesor123', salt), 'Docente Principal', 'docente', 'docente');
        results.push(rDocente + ' docente (docente@colegio.com / profesor123)');

        const rSecre = await insertarUsuario('secretaria@colegio.com',
            await bcrypt.hash('secretaria123', salt), 'Secretaría General', 'secretaria', 'secretaria');
        results.push(rSecre + ' secretaria (secretaria@colegio.com / secretaria123)');

        res.json({ ok: true, results });
    } catch (err) {
        console.error('Error en migración:', err);
        res.status(500).json({ ok: false, message: err.message, results });
    }
};
