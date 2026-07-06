// api/noticias.js — GET (público) + POST (admin)
const { sql } = require('./_lib/db');
const { requireAdmin } = require('./_lib/auth');

module.exports = async function handler(req, res) {
    // ── GET: listar todas ──
    if (req.method === 'GET') {
        try {
            const { rows } = await sql`SELECT * FROM noticias ORDER BY id DESC`;
            res.json(rows);
        } catch (err) {
            console.error('Error GET noticias:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── POST: crear (solo admin) ──
    if (req.method === 'POST') {
        const user = requireAdmin(req, res);
        if (!user) return;

        const { titulo, contenido, imagen_url, video_url } = req.body || {};
        if (!titulo || !contenido) return res.status(400).json({ message: 'Título y contenido requeridos.' });

        try {
            const { rows } = await sql`
                INSERT INTO noticias (titulo, contenido, imagen_url, video_url)
                VALUES (${titulo}, ${contenido}, ${imagen_url || null}, ${video_url || null})
                RETURNING *
            `;
            res.status(201).json(rows[0]);
        } catch (err) {
            console.error('Error POST noticia:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
