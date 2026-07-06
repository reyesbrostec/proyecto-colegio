// api/usuarios/[id].js — GET + PUT + DELETE /api/usuarios/:id
const { sql } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'ID requerido' });

    // ── GET: obtener uno ──
    if (req.method === 'GET') {
        const user = requireAdmin(req, res);
        if (!user) return;
        try {
            const { rows } = await sql`SELECT id, email, nombre_completo, username, edad, rol FROM usuarios WHERE id = ${id}`;
            if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
            res.json(rows[0]);
        } catch (err) {
            console.error('Error GET usuario:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── PUT: actualizar ──
    if (req.method === 'PUT') {
        const user = requireAdmin(req, res);
        if (!user) return;

        const { nombre_completo, username, email, rol, edad } = req.body || {};
        if (!nombre_completo || !username || !email || !rol) {
            return res.status(400).json({ message: 'Todos los campos requeridos excepto edad.' });
        }

        try {
            const { rows } = await sql`
                UPDATE usuarios
                SET nombre_completo = ${nombre_completo}, username = ${username},
                    email = ${email}, rol = ${rol}, edad = ${edad || null}
                WHERE id = ${id}
                RETURNING id, nombre_completo, username, email, rol, edad
            `;
            if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
            res.json(rows[0]);
        } catch (err) {
            if (err.code === '23505') return res.status(400).json({ message: 'El email o username ya existe.' });
            console.error('Error PUT usuario:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    // ── DELETE: eliminar ──
    if (req.method === 'DELETE') {
        const user = requireAdmin(req, res);
        if (!user) return;

        try {
            await sql`DELETE FROM usuarios WHERE id = ${id}`;
            res.status(204).send('');
        } catch (err) {
            console.error('Error DELETE usuario:', err);
            res.status(500).json({ message: 'Error del servidor' });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
