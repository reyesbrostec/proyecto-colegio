const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// POST /api/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'El email y la contraseña son requeridos.' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // Respuesta genérica — no revelar si el email existe o no
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = userResult.rows[0];

        // Lockout por intentos fallidos
        if (user.failed_attempts >= MAX_LOGIN_ATTEMPTS && user.last_failed_at) {
            const lockUntil = new Date(user.last_failed_at.getTime() + LOCKOUT_MINUTES * 60 * 1000);
            if (new Date() < lockUntil) {
                const mins = Math.ceil((lockUntil - new Date()) / 60000);
                return res.status(429).json({ message: `Demasiados intentos. Espere ${mins} minuto(s).` });
            }
            // Lockout expiró — resetear contador
            await pool.query('UPDATE usuarios SET failed_attempts = 0 WHERE id = $1', [user.id]);
            user.failed_attempts = 0;
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            await pool.query(
                'UPDATE usuarios SET failed_attempts = COALESCE(failed_attempts,0) + 1, last_failed_at = NOW() WHERE id = $1',
                [user.id]
            );
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Login exitoso — resetear contador
        await pool.query('UPDATE usuarios SET failed_attempts = 0, last_failed_at = NULL WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login exitoso', token: token, user: { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre_completo } });
    } catch (err) {
        console.error('Error en el login:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

module.exports = router;