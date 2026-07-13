// api/notas.js — GET (secretaria/admin) + POST (secretaria/admin crea nota para estudiante)
const { pool } = require('./_lib/db');
const { requireSecretaria } = require('./_lib/auth');

module.exports = async function handler(req, res) {
    // ── GET: listar todas las notas ──
    if (req.method === 'GET') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        try {
            const result = await pool.query(`
                SELECT n.id, n.estudiante_id, u.nombre_completo, u.username, n.materia,
                       n.parcial1, n.parcial2, n.examen_final, n.nota_final,
                       n.editado_por, n.fecha_edicion
                FROM notas n
                JOIN usuarios u ON n.estudiante_id = u.id
                WHERE u.rol = 'estudiante'
                ORDER BY u.nombre_completo, n.materia
            `);
            res.json(result.rows);
        } catch (err) {
            console.error('Error GET notas:', err);
            res.status(500).json({ message: 'Error del servidor', detail: err.message });
        }
        return;
    }

    // ── POST: crear nota para un estudiante (secretaria o admin) ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { estudiante_id, materia, parcial1, parcial2, examen_final } = req.body || {};
        if (!estudiante_id || !materia) {
            return res.status(400).json({ message: 'ID de estudiante y materia requeridos.' });
        }

        const p1 = parseFloat(parcial1) || 0;
        const p2 = parseFloat(parcial2) || 0;
        const ef = parseFloat(examen_final) || 0;
        const nota_final = ((p1 + p2 + ef) / 3).toFixed(2);

        try {
            const result = await pool.query(
                `INSERT INTO notas (estudiante_id, materia, parcial1, parcial2, examen_final, nota_final, editado_por, fecha_edicion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
                 ON CONFLICT (estudiante_id, materia) DO UPDATE
                 SET parcial1 = $3, parcial2 = $4, examen_final = $5,
                     nota_final = $6, editado_por = $7, fecha_edicion = NOW()
                 RETURNING *`,
                [estudiante_id, materia, p1, p2, ef, nota_final, user.email]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error('Error POST nota:', err);
            res.status(500).json({ message: 'Error del servidor', detail: err.message });
        }
        return;
    }

    // ── DELETE: eliminar nota ──
    if (req.method === 'DELETE') {
        const user = requireSecretaria(req, res);
        if (!user) return;

        const { id } = req.body || {};
        if (!id) return res.status(400).json({ message: 'ID requerido.' });

        try {
            await pool.query('DELETE FROM notas WHERE id = $1', [id]);
            res.status(204).send('');
        } catch (err) {
            console.error('Error DELETE nota:', err);
            res.status(500).json({ message: 'Error del servidor', detail: err.message });
        }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
