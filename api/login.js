// api/login.js — POST /api/login
const { sql } = require('./_lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos.' });

    try {
        const { rows } = await sql`SELECT * FROM usuarios WHERE email = ${email}`;
        if (rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login exitoso', token });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
