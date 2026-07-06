// api/galeria.js — GET (público) + POST (admin, upload foto a Cloudinary)
const { sql } = require('./_lib/db');
const { requireAdmin } = require('./_lib/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// ── Cloudinary config ──
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Multer en memoria ──
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
    // ── GET: listar fotos ──
    if (req.method === 'GET') {
        try {
            const { album } = req.query;
            let query = 'SELECT * FROM galeria';
            const params = [];
            if (album) { query += ' WHERE album = $1'; params.push(album); }
            query += ' ORDER BY created_at DESC LIMIT 100';
            const { rows } = album
                ? await sql`SELECT * FROM galeria WHERE album = ${album} ORDER BY created_at DESC LIMIT 100`
                : await sql`SELECT * FROM galeria ORDER BY created_at DESC LIMIT 100`;
            res.json(rows);
        } catch (err) {
            console.error('Error GET galeria:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── POST: subir foto ──
    if (req.method === 'POST') {
        const user = requireAdmin(req, res);
        if (!user) return;

        try {
            const file = await parseForm(req, res);
            if (!file) return res.status(400).json({ message: 'Selecciona una imagen.' });

            const titulo = req.body.titulo || '';
            const descripcion = req.body.descripcion || '';
            const album = req.body.album || 'general';

            const result = await uploadToCloudinary(file.buffer, album);

            const { rows } = await sql`
                INSERT INTO galeria (titulo, descripcion, album, url, public_id, width, height)
                VALUES (${titulo}, ${descripcion}, ${album}, ${result.secure_url}, ${result.public_id}, ${result.width}, ${result.height})
                RETURNING *
            `;
            res.status(201).json(rows[0]);
        } catch (err) {
            console.error('Error POST galeria:', err);
            if (err.message && err.message.includes('Solo se permiten')) {
                return res.status(400).json({ message: err.message });
            }
            res.status(500).json({ message: 'Error al subir la foto' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
