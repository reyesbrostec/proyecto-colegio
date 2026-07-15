// api/documentos.js — GET (público) + POST/DELETE (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');

function validarURL(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        var u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
    // ── Asegurar tabla ──
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documentos (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                descripcion TEXT DEFAULT '',
                categoria VARCHAR(100) DEFAULT 'general',
                url VARCHAR(500) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
    } catch (err) {
        console.error('Error creando tabla documentos:', err);
    }

    // ── GET: listar todos ──
    if (req.method === 'GET') {
        try {
            const result = await pool.query('SELECT * FROM documentos ORDER BY id DESC');
            res.json(result.rows);
        } catch (err) {
            console.error('Error GET documentos:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── POST: crear (secretaria o admin) ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { titulo, descripcion, categoria, url } = req.body || {};
        if (!titulo || !url) return res.status(400).json({ message: 'Título y URL requeridos.' });
        if (!validarURL(url)) return res.status(400).json({ message: 'URL inválida. Debe comenzar con http:// o https://' });

        try {
            const result = await pool.query(
                'INSERT INTO documentos (titulo, descripcion, categoria, url) VALUES ($1,$2,$3,$4) RETURNING *',
                [titulo, descripcion || '', categoria || 'general', url]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('Error POST documento:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── DELETE: eliminar por ID (secretaria o admin) ──
    if (req.method === 'DELETE') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { id } = req.body || {};
        if (!id) return res.status(400).json({ message: 'ID requerido.' });

        try {
            await pool.query('DELETE FROM documentos WHERE id = $1', [id]);
            res.status(204).send('');
        } catch (err) {
            console.error('Error DELETE documento:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
