// api/usuarios.js — GET (admin) + POST (admin)
const { sql } = require('./_lib/db');
const { requireAdmin } = require('./_lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
    // ── GET: listar todos ──
    if (req.method === 'GET') {
        const user = requireAdmin(req, res);
        if (!user) return;
        try {
            const { rows } = await sql`SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC`;
            res.json(rows);
        } catch (err) {
            console.error('Error GET usuarios:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── POST: crear ──
    if (req.method === 'POST') {
        const user = requireAdmin(req, res);
        if (!user) return;

        const { email, password, nombre_completo, username, edad, rol } = req.body || {};
        if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y username requeridos.' });

        try {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            const { rows } = await sql`
                INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol)
                VALUES (${email}, ${password_hash}, ${nombre_completo}, ${username}, ${edad || 0}, ${rol || 'estudiante'})
                RETURNING id, email, rol
            `;
            res.status(201).json(rows[0]);
        } catch (err) {
            if (err.code === '23505') return res.status(400).json({ message: 'El email o username ya está registrado.' });
            console.error('Error POST usuario:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
