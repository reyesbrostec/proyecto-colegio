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
router.get('/todas-las-notas', verifyToken, isDocente, async (req, res) => {
    try {
        const query = `SELECT n.id, u.nombre_completo, u.username, n.materia, n.parcial1, n.parcial2, n.examen_final, n.nota_final FROM notas n JOIN usuarios u ON n.estudiante_id = u.id WHERE u.rol = 'estudiante' ORDER BY u.nombre_completo, n.materia;`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener todas las notas:', err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// PUT para actualizar una nota (solo docentes y admin)
router.put('/:id', verifyToken, isDocente, async (req, res) => {
    try {
        const { id } = req.params;
        const { parcial1, parcial2, examen_final } = req.body;

        // Validar que las notas son números
        if (isNaN(parcial1) || isNaN(parcial2) || isNaN(examen_final)) {
            return res.status(400).json({ message: 'Las calificaciones deben ser valores numéricos.' });
        }

        const p1 = parseFloat(parcial1);
        const p2 = parseFloat(parcial2);
        const ef = parseFloat(examen_final);
        const nota_final = ((p1 + p2 + ef) / 3).toFixed(2);

        const result = await pool.query('UPDATE notas SET parcial1 = $1, parcial2 = $2, examen_final = $3, nota_final = $4 WHERE id = $5 RETURNING *', [p1, p2, ef, nota_final, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error al actualizar la nota ${req.params.id}:`, err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// PUT para actualizar una nota (solo docentes y admin)
router.put('/:id', verifyToken, isDocente, async (req, res) => {
    try {
        const { id } = req.params;
        const { parcial1, parcial2, examen_final } = req.body;

        // Validar que las notas son números
        if (isNaN(parcial1) || isNaN(parcial2) || isNaN(examen_final)) {
            return res.status(400).json({ message: 'Las calificaciones deben ser valores numéricos.' });
        }

        const p1 = parseFloat(parcial1);
        const p2 = parseFloat(parcial2);
        const ef = parseFloat(examen_final);
        const nota_final = ((p1 + p2 + ef) / 3).toFixed(2);

        const result = await pool.query('UPDATE notas SET parcial1 = $1, parcial2 = $2, examen_final = $3, nota_final = $4 WHERE id = $5 RETURNING *', [p1, p2, ef, nota_final, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error al actualizar la nota ${req.params.id}:`, err);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

module.exports = router;