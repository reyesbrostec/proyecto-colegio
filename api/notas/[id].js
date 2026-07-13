// api/notas/[id].js — GET + PUT /api/notas/:id (secretaria/admin/docente)
const { sql } = require('../_lib/db');
const { requireSecretaria } = require('../_lib/auth');

module.exports = async function handler(req, res) {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'ID requerido' });

    // ── GET: obtener una nota ──
    if (req.method === 'GET') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const { rows } = await sql`SELECT * FROM notas WHERE id = ${id}`;
            if (rows.length === 0) return res.status(404).json({ message: 'Nota no encontrada.' });
            res.json(rows[0]);
        } catch (err) { console.error('Error GET nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── PUT: actualizar nota ──
    if (req.method === 'PUT') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { parcial1, parcial2, examen_final } = req.body || {};
        if (isNaN(parcial1) || isNaN(parcial2) || isNaN(examen_final)) {
            return res.status(400).json({ message: 'Las calificaciones deben ser valores numéricos.' });
        }

        const p1 = parseFloat(parcial1);
        const p2 = parseFloat(parcial2);
        const ef = parseFloat(examen_final);
        const nota_final = ((p1 + p2 + ef) / 3).toFixed(2);

        try {
            const { rows } = await sql`
                UPDATE notas
                SET parcial1 = ${p1}, parcial2 = ${p2}, examen_final = ${ef},
                    nota_final = ${nota_final}, editado_por = ${user.email}, fecha_edicion = NOW()
                WHERE id = ${id}
                RETURNING *
            `;
            if (rows.length === 0) return res.status(404).json({ message: 'Nota no encontrada.' });
            res.json(rows[0]);
        } catch (err) { console.error('Error PUT nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
