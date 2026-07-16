// api/migrate.js — POST /api/migrate (one-time DB setup, ADMIN ONLY)
const { pool } = require('./_lib/db');
const { requireAdmin } = require('./_lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Usa POST para ejecutar migración' });

    const admin = requireAdmin(req, res);
    if (!admin) return;

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

        await pool.query(`CREATE TABLE IF NOT EXISTS contactos (
            id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL, telefono VARCHAR(50) DEFAULT '',
            asunto VARCHAR(255) NOT NULL, mensaje TEXT NOT NULL,
            ip_origen VARCHAR(50) DEFAULT '', pagina VARCHAR(255) DEFAULT '',
            leido BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
        results.push('✅ contactos');

        const salt = await bcrypt.genSalt(12);

        // ── Helper: insertar si no existe (por email y username) ──
        async function insertarUsuario(email, hash, nombre, username, rol) {
            const existe = await pool.query(
                'SELECT id FROM usuarios WHERE email = $1 OR username = $2', [email, username]);
            if (existe.rows.length > 0) {
                // Actualizar contraseña si ya existe
                await pool.query(
                    'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
                    [hash, existe.rows[0].id]);
                return '🔄 actualizado';
            }
            await pool.query(
                'INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1,$2,$3,$4,$5,$6)',
                [email, hash, nombre, username, 0, rol]);
            return '✅';
        }

        var adminEmail = process.env.SEED_ADMIN_EMAIL || 'rybr0ss@colegio.com';
        var adminPass = process.env.SEED_ADMIN_PASS || 'reyesbrostec';
        var docenteEmail = process.env.SEED_DOCENTE_EMAIL || 'docente@colegio.com';
        var docentePass = process.env.SEED_DOCENTE_PASS || 'profesor123';
        var secreEmail = process.env.SEED_SECRE_EMAIL || 'secretaria@colegio.com';
        var secrePass = process.env.SEED_SECRE_PASS || 'secretaria123';

        const rAdmin = await insertarUsuario(adminEmail,
            await bcrypt.hash(adminPass, salt), 'Administrador', 'admin', 'admin');
        results.push(rAdmin + ' admin');

        const rDocente = await insertarUsuario(docenteEmail,
            await bcrypt.hash(docentePass, salt), 'Docente Principal', 'docente', 'docente');
        results.push(rDocente + ' docente');

        const rSecre = await insertarUsuario(secreEmail,
            await bcrypt.hash(secrePass, salt), 'Secretaría General', 'secretaria', 'secretaria');
        results.push(rSecre + ' secretaria');

        res.json({ ok: true, results, tables: results.slice(0, 6) });
    } catch (err) {
        console.error('Error en migración:', err);
        res.status(500).json({ ok: false, message: 'Error del servidor' });
    }
};
