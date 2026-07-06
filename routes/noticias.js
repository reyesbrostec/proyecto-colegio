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

// GET /api/noticias/:id - Obtener una noticia por ID
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener noticia:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// POST /api/noticias - Crear una nueva noticia (solo admin)
router.post('/', verifyToken, isAdmin, async (req, res) => {
    const { titulo, contenido, imagen_url, video_url } = req.body;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    try {
        const nuevaNoticia = await pool.query(
            'INSERT INTO noticias (titulo, contenido, imagen_url, video_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [titulo, contenido, imagen_url || null, video_url || null]
        );
        res.status(201).json(nuevaNoticia.rows[0]);
    } catch (err) {
        console.error('Error al crear noticia:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// PUT /api/noticias/:id - Actualizar una noticia (solo admin)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    const { titulo, contenido, imagen_url, video_url } = req.body;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    try {
        const result = await pool.query(
            'UPDATE noticias SET titulo = $1, contenido = $2, imagen_url = $3, video_url = $4 WHERE id = $5 RETURNING *',
            [titulo, contenido, imagen_url || null, video_url || null, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error al actualizar noticia ${req.params.id}:`, err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// DELETE /api/noticias/:id - Eliminar una noticia (solo admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM noticias WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`Error al eliminar noticia ${id}:`, err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

module.exports = router;