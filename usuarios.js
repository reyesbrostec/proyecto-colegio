const express = require('express');
const pool = require('../db'); // Asumimos que tienes un archivo db.js que exporta el pool
const bcrypt = require('bcryptjs');
const { verifyToken, isAdmin } = require('../middleware/auth'); // Usaremos el middleware de auth

const router = express.Router();

// GET todos los usuarios (solo admin)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

// GET un usuario por ID (solo admin)
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
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
    const { email, password, nombre_completo, username, edad, rol } = req.body;
    if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y nombre de usuario son requeridos.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = await pool.query('INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, rol', [email, password_hash, nombre_completo, username, edad, rol || 'estudiante']);
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'El email o nombre de usuario ya está registrado.' });
        res.status(500).json({ message: "Error del servidor" });
    }
});

// PUT actualizar un usuario (solo admin)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, username, email, rol, edad } = req.body;
    // ... (el resto de tu lógica de actualización va aquí)
});

// DELETE eliminar un usuario (solo admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    // ... (el resto de tu lógica de eliminación va aquí)
});

module.exports = router;