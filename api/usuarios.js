// api/usuarios.js — GET/POST (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
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
        const { email, password, nombre_completo, username, edad, rol } = req.body || {};
        if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y username requeridos.' });

        try {
            const salt = await bcrypt.genSalt(10);
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
