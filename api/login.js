// api/login.js — POST /api/login
const { pool } = require('./_lib/db');
const { applyRateLimit } = require('./_lib/rateLimit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
    // ── Rate limit: 10 intentos por IP cada 15 min ──
    if (!applyRateLimit(req, res, 10, 900)) return;
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' });

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos.' });

    var ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
    if (!loginRateCheck(ip)) {
        return res.status(429).json({ message: 'Demasiados intentos. Espere 15 minutos.' });
    }

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login exitoso', token, user: { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre_completo } });
    } catch (err) {
        console.error('Error en login:', err.message);
        res.status(500).json({ message: 'Error del servidor' });
    }
}

// ── Rate limiting para login (anti brute-force) ──
var loginAttempts = {};
var LOGIN_MAX = 10;
var LOGIN_WINDOW = 900;
function loginRateCheck(ip) {
    var now = Math.floor(Date.now() / 1000);
    var entry = loginAttempts[ip];
    if (!entry || now > entry.resetAt) {
        loginAttempts[ip] = { count: 1, resetAt: now + LOGIN_WINDOW };
        return true;
    }
    if (entry.count >= LOGIN_MAX) return false;
    entry.count++;
    return true;
};
