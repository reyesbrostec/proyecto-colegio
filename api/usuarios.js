// api/usuarios.js — GET/POST (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');
const { applyRateLimit } = require('./_lib/rateLimit');
const { cleanStr } = require('./_lib/sanitize');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    // ── Rate limit: 30 req/min por IP ──
    if (!applyRateLimit(req, res, 30, 60)) return;
    // ── GET: listar todos ──
    if (req.method === 'GET') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) { console.error('Error GET usuarios:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── POST: crear ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { email, password, nombre_completo: rawNombre, username: rawUser, edad, rol } = req.body || {};
        const nombre_completo = cleanStr(rawNombre, 255);
        const username = cleanStr(rawUser, 100);
        if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y username requeridos.' });

        // Validación de fortaleza de contraseña
        var passErr = validarPassword(password);
        if (passErr) return res.status(400).json({ message: passErr });

        try {
            const salt = await bcrypt.genSalt(12);
            const password_hash = await bcrypt.hash(password, salt);
            const result = await pool.query(
                'INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, rol',
                [email, password_hash, nombre_completo, username, edad || 0, rol || 'estudiante']
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            if (err.code === '23505') return res.status(400).json({ message: 'El email o username ya está registrado.' });
            console.error('Error POST usuario:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};

function validarPassword(pw) {
    if (typeof pw !== 'string' || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pw)) return 'La contraseña debe contener al menos una mayúscula.';
    if (!/[0-9]/.test(pw)) return 'La contraseña debe contener al menos un número.';
    return null;
}
