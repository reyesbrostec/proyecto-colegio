// api/notas/mis-notas.js — GET /api/notas/mis-notas (estudiante ve sus notas)
const { sql } = require('../_lib/db');
const { requireEstudiante } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Método no permitido' });

    const user = requireEstudiante(req, res);
    if (!user) return;

    try {
        const { rows } = await sql`
            SELECT materia, parcial1, parcial2, examen_final, nota_final
            FROM notas WHERE estudiante_id = ${user.id}
            ORDER BY materia
        `;
        res.json(rows);
    } catch (err) {
        console.error('Error mis-notas:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
