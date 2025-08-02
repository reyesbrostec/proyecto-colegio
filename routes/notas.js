const express = require('express');
const pool = require('../db');
const { verifyToken, isAdmin, isEstudiante, isDocente } = require('../middleware/auth');

const router = express.Router();

// GET mis notas (solo estudiante)
router.get('/mis-notas', verifyToken, isEstudiante, async (req, res) => {
    try {
        const estudianteId = req.user.id;
        const result = await pool.query('SELECT materia, parcial1, parcial2, examen_final, nota_final FROM notas WHERE estudiante_id = $1 ORDER BY materia', [estudianteId]);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error al obtener notas para el usuario ${req.user.id}:`, err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// GET todas las notas (solo admin y docentes)
router.get('/todas-las-notas', [verifyToken, (req, res, next) => {
    // Middleware personalizado para permitir acceso a admin O docente
    if (req.user.rol === 'admin' || req.user.rol === 'docente') {
        return next();
    }
    return res.status(403).json({ message: 'Acceso no autorizado para este rol.' });
}], async (req, res) => {
    try {
        const query = `SELECT n.id, u.nombre_completo, u.username, n.materia, n.parcial1, n.parcial2, n.examen_final, n.nota_final, n.editado_por, n.fecha_edicion FROM notas n JOIN usuarios u ON n.estudiante_id = u.id WHERE u.rol = 'estudiante' ORDER BY u.nombre_completo, n.materia;`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener todas las notas:', err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.put('/:id', [verifyToken, (req, res, next) => {
    // Middleware personalizado para permitir acceso a admin O docente
    if (req.user.rol === 'admin' || req.user.rol === 'docente') {
        return next();
    }
    return res.status(403).json({ message: 'Acceso no autorizado para este rol.' });
}], async (req, res) => {
    try {
        const { id } = req.params;
        const { parcial1, parcial2, examen_final } = req.body;
        const editorInfo = req.user.email; // Obtenemos el email del usuario que edita desde el token

        // Validar que las notas son números
        if (isNaN(parcial1) || isNaN(parcial2) || isNaN(examen_final)) {
            return res.status(400).json({ message: 'Las calificaciones deben ser valores numéricos.' });
        }

        const p1 = parseFloat(parcial1);
        const p2 = parseFloat(parcial2);
        const ef = parseFloat(examen_final);
        const nota_final = ((p1 + p2 + ef) / 3).toFixed(2);

        const result = await pool.query(
            'UPDATE notas SET parcial1 = $1, parcial2 = $2, examen_final = $3, nota_final = $4, editado_por = $5, fecha_edicion = NOW() WHERE id = $6 RETURNING *',
            [p1, p2, ef, nota_final, editorInfo, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error al actualizar la nota ${req.params.id}:`, err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

module.exports = router;