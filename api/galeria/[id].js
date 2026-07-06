// api/galeria/[id].js — DELETE /api/galeria/:id (admin)
const { sql } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ message: 'Método no permitido' });

    const user = requireAdmin(req, res);
    if (!user) return;

    const { id } = req.query;

    try {
        // Obtener public_id antes de borrar
        const { rows } = await sql`SELECT public_id FROM galeria WHERE id = ${id}`;
        if (rows.length === 0) return res.status(404).json({ message: 'Foto no encontrada' });

        // Borrar de Cloudinary
        try {
            await cloudinary.uploader.destroy(rows[0].public_id);
        } catch (cloudErr) {
            console.warn('⚠️ No se pudo borrar de Cloudinary:', cloudErr.message);
        }

        // Borrar de DB
        await sql`DELETE FROM galeria WHERE id = ${id}`;
        res.status(204).send('');
    } catch (err) {
        console.error('Error DELETE galeria:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
