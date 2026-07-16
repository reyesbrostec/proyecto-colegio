// api/notas.js — Todas las operaciones de notas unificadas
// GET  /api/notas?mis=1        → mis notas (estudiante)
// GET  /api/notas?id=X         → una nota (secretaria/admin/docente)
// GET  /api/notas              → todas con JOIN (secretaria/admin/docente)
// POST /api/notas              → crear/actualizar (secretaria/admin)
// PUT  /api/notas?id=X         → actualizar nota (secretaria/admin)
// DELETE /api/notas            → eliminar por body.id (secretaria/admin)
const { pool } = require('./_lib/db');
const { requireSecretaria, requireEstudiante } = require('./_lib/auth');
const { applyRateLimit } = require('./_lib/rateLimit');

module.exports = async function handler(req, res) {
    // ── Rate limit: 60 req/min por IP ──
    if (!applyRateLimit(req, res, 60, 60)) return;
    const { id, mis } = req.query;

    // ── GET /api/notas?mis=1 ──
    if (req.method === 'GET' && mis !== undefined) {
        const user = requireEstudiante(req, res);
        if (!user) return;
        try {
            const result = await pool.query(
                'SELECT materia, parcial1, parcial2, examen_final, nota_final FROM notas WHERE estudiante_id = $1 ORDER BY materia', [user.id]);
            res.json(result.rows);
        } catch (err) { console.error('Error mis-notas:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── GET /api/notas?id=X ──
    if (req.method === 'GET' && id) {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const result = await pool.query('SELECT * FROM notas WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Nota no encontrada.' });
            res.json(result.rows[0]);
        } catch (err) { console.error('Error GET nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── GET /api/notas ──
    if (req.method === 'GET') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        try {
            const result = await pool.query(`
                SELECT n.id, n.estudiante_id, u.nombre_completo, u.username, n.materia,
                       n.parcial1, n.parcial2, n.examen_final, n.nota_final,
                       n.editado_por, n.fecha_edicion
                FROM notas n JOIN usuarios u ON n.estudiante_id = u.id
                WHERE u.rol = 'estudiante'
                ORDER BY u.nombre_completo, n.materia`);
            res.json(result.rows);
        } catch (err) { console.error('Error GET notas:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── PUT /api/notas?id=X ──
    if (req.method === 'PUT' && id) {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { parcial1, parcial2, examen_final } = req.body || {};
        if (isNaN(parcial1) || isNaN(parcial2) || isNaN(examen_final))
            return res.status(400).json({ message: 'Las calificaciones deben ser valores numéricos.' });
        const p1 = parseFloat(parcial1), p2 = parseFloat(parcial2), ef = parseFloat(examen_final);
        var fuera = [p1, p2, ef].filter(function(v){ return v < 0 || v > 10; });
        if (fuera.length > 0) return res.status(400).json({ message: 'Las calificaciones deben estar entre 0 y 10.' });
        const nf = ((p1 + p2 + ef) / 3).toFixed(2);
        try {
            const result = await pool.query(
                'UPDATE notas SET parcial1=$1, parcial2=$2, examen_final=$3, nota_final=$4, editado_por=$5, fecha_edicion=NOW() WHERE id=$6 RETURNING *',
                [p1, p2, ef, nf, user.email, id]);
            if (result.rows.length === 0) return res.status(404).json({ message: 'Nota no encontrada.' });
            res.json(result.rows[0]);
        } catch (err) { console.error('Error PUT nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── POST /api/notas ──
    if (req.method === 'POST') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { estudiante_id, materia, parcial1, parcial2, examen_final } = req.body || {};
        if (!estudiante_id || !materia) return res.status(400).json({ message: 'ID de estudiante y materia requeridos.' });
        const p1 = parseFloat(parcial1) || 0, p2 = parseFloat(parcial2) || 0, ef = parseFloat(examen_final) || 0;
        var fuera = [p1, p2, ef].filter(function(v){ return v < 0 || v > 10; });
        if (fuera.length > 0) return res.status(400).json({ message: 'Las calificaciones deben estar entre 0 y 10.' });
        const nf = ((p1 + p2 + ef) / 3).toFixed(2);
        try {
            const result = await pool.query(
                `INSERT INTO notas (estudiante_id, materia, parcial1, parcial2, examen_final, nota_final, editado_por, fecha_edicion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
                 ON CONFLICT (estudiante_id, materia) DO UPDATE
                 SET parcial1=$3, parcial2=$4, examen_final=$5, nota_final=$6, editado_por=$7, fecha_edicion=NOW()
                 RETURNING *`,
                [estudiante_id, materia, p1, p2, ef, nf, user.email]);
            res.status(201).json(result.rows[0]);
        } catch (err) { console.error('Error POST nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    // ── DELETE /api/notas ──
    if (req.method === 'DELETE') {
        const user = requireSecretaria(req, res);
        if (!user) return;
        const { id: bodyId } = req.body || {};
        if (!bodyId) return res.status(400).json({ message: 'ID requerido.' });
        try { await pool.query('DELETE FROM notas WHERE id = $1', [bodyId]); res.status(204).send(''); }
        catch (err) { console.error('Error DELETE nota:', err); res.status(500).json({ message: 'Error del servidor' }); }
        return;
    }

    res.status(405).json({ message: 'Método no permitido' });
};
