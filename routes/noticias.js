const express = require('express');
const pool = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/noticias - Ruta pública para obtener todas las noticias
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener noticias:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// POST /api/noticias - Crear una nueva noticia (solo admin)
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    try {
        const nuevaNoticia = await pool.query(
            'INSERT INTO noticias (titulo, contenido) VALUES ($1, $2) RETURNING *',
            [titulo, contenido]
        );
        res.status(201).json(nuevaNoticia.rows[0]);
    } catch (err) {
        console.error('Error al crear noticia:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// DELETE /api/noticias/:id - Eliminar una noticia (solo admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM noticias WHERE id = $1', [id]);
        res.status(204).send(); // No Content
    } catch (err) {
        console.error(`Error al eliminar noticia ${id}:`, err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

module.exports = router;