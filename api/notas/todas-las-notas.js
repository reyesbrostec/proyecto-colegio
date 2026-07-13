// api/notas/todas-las-notas.js — GET /api/notas/todas-las-notas (secretaria/admin/docente)
const { sql } = require('../_lib/db');
const { requireSecretaria } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Método no permitido' });

    const user = requireSecretaria(req, res);
    if (!user) return;

    try {
        const { rows } = await sql`
            SELECT n.id, u.nombre_completo, u.username, n.materia,
                   n.parcial1, n.parcial2, n.examen_final, n.nota_final,
                   n.editado_por, n.fecha_edicion
            FROM notas n
            JOIN usuarios u ON n.estudiante_id = u.id
            WHERE u.rol = 'estudiante'
            ORDER BY u.nombre_completo, n.materia
        `;
        res.json(rows);
    } catch (err) {
        console.error('Error todas-las-notas:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
