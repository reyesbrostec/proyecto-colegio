const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { verifyToken, isAdmin, isEditor } = require('../middleware/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// ── Sanitizador inline ──
const clean = (v, max) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').substring(0, max || 500).trim() : '');

// GET todos los usuarios (admin, secretaria, docente)
router.get('/', verifyToken, isEditor, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

// GET un usuario por ID (admin, secretaria, docente)
router.get('/:id', verifyToken, isEditor, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

// POST crear un nuevo usuario (solo admin)
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const nombre_completo = clean(req.body.nombre_completo, 255);
    const username = clean(req.body.username, 100);
    const { edad, rol } = req.body;
    if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y nombre de usuario son requeridos.' });
    if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    try {
        // ✅ Single call: bcrypt.hash(password, rounds) — nunca separar genSalt + hash
        const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const newUser = await pool.query(
            'INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, rol',
            [email, password_hash, nombre_completo, username, edad, rol || 'estudiante']
        );
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'El email o nombre de usuario ya está registrado.' });
        console.error('Error al crear usuario:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// PUT actualizar un usuario (solo admin)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, username, email, rol, edad } = req.body;
    if (!nombre_completo || !username || !email || !rol) {
        return res.status(400).json({ message: 'Todos los campos requeridos excepto la edad.' });
    }

    try {
        const result = await pool.query(
            'UPDATE usuarios SET nombre_completo = $1, username = $2, email = $3, rol = $4, edad = $5 WHERE id = $6 RETURNING id, nombre_completo, username, email, rol, edad',
            [nombre_completo, username, email, rol, edad || null, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: 'El email o nombre de usuario ya existe.' });
        }
        console.error(`Error al actualizar usuario ${id}:`, err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// DELETE eliminar un usuario (solo admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`Error al eliminar usuario ${id}:`, err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

module.exports = router;