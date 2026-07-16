// api/galeria.js — GET público + POST/DELETE (secretaria/admin) + subida a Cloudinary
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');
const { applyRateLimit } = require('./_lib/rateLimit');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        cb(null, tipos.includes(file.mimetype));
    }
});

function parseForm(req, res) {
    return new Promise((resolve, reject) => {
        upload.single('foto')(req, res, (err) => {
            if (err) reject(err); else resolve(req.file);
        });
    });
}

function uploadToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `colegio-uepam/${folder}`, resource_type: 'image',
              transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
            (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(buffer);
    });
}

module.exports = async function handler(req, res) {
    // ── Rate limit: 20 req/min por IP ──
    if (!applyRateLimit(req, res, 20, 60)) return;

    // ── Asegurar tabla ──
    try {
        await pool.query("CREATE TABLE IF NOT EXISTS galeria (id SERIAL PRIMARY KEY, titulo VARCHAR(255) NOT NULL DEFAULT '', descripcion TEXT DEFAULT '', album VARCHAR(100) DEFAULT 'general', url VARCHAR(500) NOT NULL, public_id VARCHAR(200) NOT NULL, width INT DEFAULT 0, height INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())");
    } catch (err) { console.error('Error creando tabla galeria:', err); }

    const { id, album } = req.query;

    // ── DELETE /api/galeria?id=X ──
    if (req.method === 'DELETE' && id) {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const result = await pool.query('SELECT public_id FROM galeria WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Foto no encontrada' });
            try { await cloudinary.uploader.destroy(result.rows[0].public_id); } catch (e) { console.warn('Cloudinary:', e.message); }
            await pool.query('DELETE FROM galeria WHERE id = $1', [id]);
            res.status(204).send('');
        } catch (err) { console.error('Error DELETE galeria:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── GET /api/galeria?album=X ──
    if (req.method === 'GET') {
        try {
            const result = album
                ? await pool.query('SELECT id, titulo, descripcion, album, url, width, height, created_at FROM galeria WHERE album = $1 ORDER BY created_at DESC LIMIT 100', [album])
                : await pool.query('SELECT id, titulo, descripcion, album, url, width, height, created_at FROM galeria ORDER BY created_at DESC LIMIT 100');
            res.json(result.rows);
        } catch (err) { console.error('Error GET galeria:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── POST: subir foto ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const file = await parseForm(req, res);
            if (!file) return res.status(400).json({ message: 'Selecciona una imagen.' });
            const titulo = req.body.titulo || '', descripcion = req.body.descripcion || '';
            const albumName = req.body.album || 'general';
            const result = await uploadToCloudinary(file.buffer, albumName);
            const insertResult = await pool.query(
                'INSERT INTO galeria (titulo, descripcion, album, url, public_id, width, height) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
                [titulo, descripcion, albumName, result.secure_url, result.public_id, result.width, result.height]);
            res.status(201).json(insertResult.rows[0]);
        } catch (err) {
            console.error('Error POST galeria:', err);
            if (err.message && err.message.includes('Solo se permiten')) return res.status(400).json({ message: err.message });
            res.status(500).json({ message: 'Error al subir la foto' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
