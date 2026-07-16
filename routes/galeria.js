const express = require('express');
const pool = require('../db');
const { verifyToken, isAdmin, isSecretaria } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// ── Helper: admin o secretaria pueden gestionar galería ──
const puedeEditar = (req, res, next) => {
    if (req.user && (req.user.rol === 'admin' || req.user.rol === 'secretaria')) {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de admin o secretaria.' });
};

// ── Configuración de Cloudinary ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Multer: almacenamiento en memoria (pasamos el buffer a Cloudinary) ──
// ⚠️  Vercel tiene límite de 4.5 MB en serverless. Archivos mayores
//     requieren Cloudinary Upload Widget (subida directa desde el navegador).
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB (bajo el límite de 4.5 MB de Vercel)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
                   'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (tipos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP, GIF) y videos (MP4, WebM, MOV, AVI)'), false);
    }
  }
});

// ── Helper: subir buffer a Cloudinary (detecta si es imagen o video) ──
function uploadToCloudinary(buffer, folder, mimetype) {
  return new Promise((resolve, reject) => {
    const isVideo = mimetype && mimetype.startsWith('video/');
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `colegio-uepam/${folder}`,
        resource_type: isVideo ? 'video' : 'image',
        transformation: isVideo
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : [{ quality: 'auto', fetch_format: 'auto' }]
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
    res.status(500).json({ message: 'Error del servidor' });
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
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ── POST /api/galeria — Subir foto o video (admin o secretaria) ──
// Multer error handler: captura LIMIT_FILE_SIZE y archivos inválidos
router.post('/', verifyToken, puedeEditar, function(req, res, next) {
  upload.single('foto')(req, res, function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Archivo demasiado grande. Máximo 4 MB. Para videos más grandes contacta al administrador.' });
      }
      if (err.message && err.message.includes('Solo se permiten')) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: 'Error al procesar el archivo.' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Debes seleccionar una imagen o video.' });
  }

  try {
    const { titulo = '', descripcion = '', album = 'general', tipo_acceso = 'publico' } = req.body;
    const result = await uploadToCloudinary(req.file.buffer, album, req.file.mimetype);

    const nueva = await pool.query(
      `INSERT INTO galeria (titulo, descripcion, album, url, public_id, width, height, tipo_acceso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [titulo, descripcion, album, result.secure_url, result.public_id, result.width, result.height, tipo_acceso]
    );

    res.status(201).json(nueva.rows[0]);
  } catch (err) {
    console.error('Error al subir archivo:', err);
    res.status(500).json({ message: 'Error al subir el archivo.' });
  }
});

// ── DELETE /api/galeria/:id — Eliminar archivo (admin o secretaria) ──
router.delete('/:id', verifyToken, puedeEditar, async (req, res) => {
  const { id } = req.params;
  try {
    const foto = await pool.query('SELECT * FROM galeria WHERE id = $1', [id]);
    if (foto.rows.length === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
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
    console.error('Error al eliminar archivo:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ── GET /api/galeria/ver/:id — Acceso controlado con privacidad ──
// Archivos "publico": cualquiera ve la URL. "restringido": solo con sesión.
// Cumple con Ley de Protección de Datos Personales (Ecuador) para fotos de menores.
router.get('/ver/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM galeria WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Archivo no encontrado.' });

    const archivo = result.rows[0];

    // Público: acceso libre
    if (archivo.tipo_acceso === 'publico') {
      return res.json({ url: archivo.url, tipo: archivo.tipo_acceso });
    }

    // Restringido: requiere token válido
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ message: 'Este contenido requiere autenticación.' });
    }
    const jwt = require('jsonwebtoken');
    try {
      jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      return res.json({ url: archivo.url, tipo: archivo.tipo_acceso });
    } catch {
      return res.status(403).json({ message: 'Sesión inválida o expirada.' });
    }
  } catch (err) {
    console.error('Error al ver archivo:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
