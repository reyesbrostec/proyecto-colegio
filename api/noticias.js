// api/noticias.js — GET (público) + POST (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');

module.exports = async function handler(req, res) {
    // ── GET: listar todas ──
    if (req.method === 'GET') {
        try {
            const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC');
            res.json(result.rows);
        } catch (err) {
            console.error('Error GET noticias:', err);
            res.status(500).json({ message: 'Error del servidor', detail: err.message });
        }
        return;
    }

    // ── POST: crear (secretaria o admin) ──
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
        } catch (err) {
            console.error('Error POST noticia:', err);
            res.status(500).json({ message: 'Error del servidor', detail: err.message });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
