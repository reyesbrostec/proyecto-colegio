// api/noticias/[id].js — GET + PUT + DELETE /api/noticias/:id
const { sql } = require('../_lib/db');
const { requireSecretaria } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'ID requerido' });

    // ── GET: obtener una ──
    if (req.method === 'GET') {
        try {
            const { rows } = await sql`SELECT * FROM noticias WHERE id = ${id}`;
            if (rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
            res.json(rows[0]);
        } catch (err) {
            console.error('Error GET noticia:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── PUT: actualizar (secretaria o admin) ──
    if (req.method === 'PUT') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { titulo, contenido, imagen_url, video_url } = req.body || {};
        if (!titulo || !contenido) return res.status(400).json({ message: 'Título y contenido requeridos.' });

        try {
            const { rows } = await sql`
                UPDATE noticias
                SET titulo = ${titulo}, contenido = ${contenido},
                    imagen_url = ${imagen_url || null}, video_url = ${video_url || null}
                WHERE id = ${id}
                RETURNING *
            `;
            if (rows.length === 0) return res.status(404).json({ message: 'Noticia no encontrada.' });
            res.json(rows[0]);
        } catch (err) {
            console.error('Error PUT noticia:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── DELETE: eliminar (secretaria o admin) ──
    if (req.method === 'DELETE') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        try {
            await sql`DELETE FROM noticias WHERE id = ${id}`;
            res.status(204).send('');
        } catch (err) {
            console.error('Error DELETE noticia:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
