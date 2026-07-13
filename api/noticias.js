// api/noticias.js — GET público + GET/:id + POST + PUT + DELETE (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    // ── GET /api/noticias?id=X ──
    if (req.method === 'GET' && id) {
        try {
            const result = await pool.query('SELECT * FROM noticias WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
            res.json(result.rows[0]);
        } catch (err) { console.error('Error GET noticia:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── GET /api/noticias ──
    if (req.method === 'GET') {
        try {
            const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC');
            res.json(result.rows);
        } catch (err) { console.error('Error GET noticias:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── PUT /api/noticias?id=X ──
    if (req.method === 'PUT' && id) {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { titulo, contenido, imagen_url, video_url } = req.body || {};
        if (!titulo || !contenido) return res.status(400).json({ message: 'Título y contenido requeridos.' });
        try {
            const result = await pool.query(
                'UPDATE noticias SET titulo=$1, contenido=$2, imagen_url=$3, video_url=$4 WHERE id=$5 RETURNING *',
                [titulo, contenido, imagen_url || null, video_url || null, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
            res.json(result.rows[0]);
        } catch (err) { console.error('Error PUT noticia:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── DELETE /api/noticias?id=X ──
    if (req.method === 'DELETE' && id) {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try { await pool.query('DELETE FROM noticias WHERE id = $1', [id]); res.status(204).send(''); }
        catch (err) { console.error('Error DELETE noticia:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── POST /api/noticias ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { titulo, contenido, imagen_url, video_url } = req.body || {};
        if (!titulo || !contenido) return res.status(400).json({ message: 'Título y contenido requeridos.' });
        try {
            const result = await pool.query(
                'INSERT INTO noticias (titulo, contenido, imagen_url, video_url) VALUES ($1,$2,$3,$4) RETURNING *',
                [titulo, contenido, imagen_url || null, video_url || null]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) { console.error('Error POST noticia:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
