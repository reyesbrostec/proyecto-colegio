const express = require('express');
const pool = require('../db');
const { verifyToken, isAdmin, isSecretaria } = require('../middleware/auth');

const router = express.Router();

// ── Helper: admin o secretaria pueden crear/editar/eliminar noticias ──
const puedeEditar = (req, res, next) => {
    if (req.user && (req.user.rol === 'admin' || req.user.rol === 'secretaria')) {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de admin o secretaria.' });
};

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

// GET /api/noticias/:id — Obtener una noticia individual
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

// POST /api/noticias - Crear una nueva noticia (admin o secretaria)
router.post('/', verifyToken, puedeEditar, async (req, res) => {
    const { titulo, contenido, imagen_url, video_url, tipo_media } = req.body;
    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'El título y el contenido son requeridos.' });
    }
    try {
        const nuevaNoticia = await pool.query(
            `INSERT INTO noticias (titulo, contenido, imagen_url, video_url, tipo_media)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [titulo, contenido, imagen_url || null, video_url || null, tipo_media || null]
        );
        res.status(201).json(nuevaNoticia.rows[0]);
    } catch (err) {
        console.error('Error al crear noticia:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// PUT /api/noticias/:id — Editar noticia (admin o secretaria)
router.put('/:id', verifyToken, puedeEditar, async (req, res) => {
    const { id } = req.params;
    const { titulo, contenido, imagen_url, video_url, tipo_media } = req.body;
    try {
        const result = await pool.query(
            `UPDATE noticias SET titulo = $1, contenido = $2, imagen_url = $3, video_url = $4, tipo_media = $5
             WHERE id = $6 RETURNING *`,
            [titulo, contenido, imagen_url || null, video_url || null, tipo_media || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al editar noticia:', err);
        res.status(500).json({ message: "Error del servidor" });
    }
});

// DELETE /api/noticias/:id - Eliminar una noticia (admin o secretaria)
router.delete('/:id', verifyToken, puedeEditar, async (req, res) => {
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