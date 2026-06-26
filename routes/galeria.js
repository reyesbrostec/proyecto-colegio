const express = require('express');
const pool = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// ── Configuración de Cloudinary ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Multer: almacenamiento en memoria (pasamos el buffer a Cloudinary) ──
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (req, file, cb) => {
    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (tipos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'), false);
    }
  }
});

// ── Helper: subir buffer a Cloudinary ──
function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `colegio-uepam/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ── Asegurar tabla galeria ──
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS galeria (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL DEFAULT '',
        descripcion TEXT DEFAULT '',
        album VARCHAR(100) DEFAULT 'general',
        url VARCHAR(500) NOT NULL,
        public_id VARCHAR(200) NOT NULL,
        width INT DEFAULT 0,
        height INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla galeria verificada/creada.');
  } catch (err) {
    console.warn('⚠️  No se pudo verificar/crear tabla galeria:', err.message);
  }
})();

// ── GET /api/galeria — Listar todas las fotos ──
router.get('/', async (req, res) => {
  try {
    const { album } = req.query;
    let query = 'SELECT * FROM galeria';
    const params = [];
    if (album) {
      query += ' WHERE album = $1';
      params.push(album);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener galería:', err);
    res.status(500).json({ message: 'Error del servidor', error: err.message, stack: err.stack });
  }
});

// ── GET /api/galeria/albums — Listar álbumes ──
router.get('/albums', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT album, COUNT(*) as total, MIN(url) as portada FROM galeria GROUP BY album ORDER BY album'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener álbumes:', err);
    res.status(500).json({ message: 'Error del servidor', error: err.message, stack: err.stack });
  }
});

// ── POST /api/galeria — Subir foto (admin) ──
router.post('/', verifyToken, isAdmin, upload.single('foto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Debes seleccionar una imagen.' });
  }

  try {
    const { titulo = '', descripcion = '', album = 'general' } = req.body;
    const result = await uploadToCloudinary(req.file.buffer, album);

    const nueva = await pool.query(
      `INSERT INTO galeria (titulo, descripcion, album, url, public_id, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [titulo, descripcion, album, result.secure_url, result.public_id, result.width, result.height]
    );

    res.status(201).json(nueva.rows[0]);
  } catch (err) {
    console.error('Error al subir foto:', err);
    if (err.message.includes('Solo se permiten')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error al subir la foto.' });
  }
});

// ── DELETE /api/galeria/:id — Eliminar foto (admin) ──
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const foto = await pool.query('SELECT * FROM galeria WHERE id = $1', [id]);
    if (foto.rows.length === 0) {
      return res.status(404).json({ message: 'Foto no encontrada.' });
    }

    // Eliminar de Cloudinary
    try {
      await cloudinary.uploader.destroy(foto.rows[0].public_id);
    } catch (cloudErr) {
      console.warn('⚠️ No se pudo eliminar de Cloudinary:', cloudErr.message);
    }

    await pool.query('DELETE FROM galeria WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Error al eliminar foto:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
