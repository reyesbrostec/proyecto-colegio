const express = require('express');
const pool = require('../db');
const multer = require('multer');
const { verifyToken, isAdmin, isSecretaria, isDocente } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

const puedeGestionar = (req, res, next) => {
    if (req.user && (req.user.rol === 'admin' || req.user.rol === 'secretaria')) {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado. Admin o secretaria requerido.' });
};

/** Calcula nota final según fórmula configurable */
function calcularNotaFinal(notasTrimestres, examen, config) {
    const { nota_max, ponderacion_trim, ponderacion_examen } = config;
    const promTrim = notasTrimestres.reduce((a, b) => a + b, 0) / Math.max(notasTrimestres.length, 1);
    const p90 = promTrim * parseFloat(ponderacion_trim);
    const p10 = examen * parseFloat(ponderacion_examen);
    return Math.min(parseFloat((p90 + p10).toFixed(2)), parseFloat(nota_max));
}

/** Cualitativa según nota */
function cualitativa(nota) {
    if (nota >= 9.5) return 'Domina los aprendizajes';
    if (nota >= 7) return 'Alcanza los aprendizajes';
    if (nota >= 5) return 'Está próximo a alcanzar los aprendizajes';
    return 'No alcanza los aprendizajes';
}

// ═══════════════════════════════════════════
// CONFIGURACIÓN DE CALIFICACIONES
// ═══════════════════════════════════════════

// GET /api/calificaciones/config?curso_id=&grado_id=
router.get('/config', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { curso_id, grado_id } = req.query;
        let query = `
            SELECT cc.*, c.nombre as curso_nombre, g.nombre as grado_nombre
            FROM config_calificaciones cc
            JOIN cursos c ON cc.curso_id = c.id
            JOIN grados g ON cc.grado_id = g.id
            WHERE 1=1
        `;
        const params = [];
        if (curso_id) { params.push(curso_id); query += ` AND cc.curso_id = $${params.length}`; }
        if (grado_id) { params.push(grado_id); query += ` AND cc.grado_id = $${params.length}`; }
        query += ' ORDER BY g.orden ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET config:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/config  (crear o actualizar)
router.post('/config', verifyToken, isAdmin, async (req, res) => {
    try {
        const { curso_id, grado_id, num_trimestres, ponderacion_trim, ponderacion_examen, nota_max, nota_min_aprob } = req.body;
        if (!curso_id || !grado_id) return res.status(400).json({ message: 'curso_id y grado_id son requeridos' });

        const result = await pool.query(`
            INSERT INTO config_calificaciones (curso_id, grado_id, num_trimestres, ponderacion_trim, ponderacion_examen, nota_max, nota_min_aprob)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (curso_id, grado_id)
            DO UPDATE SET num_trimestres=$3, ponderacion_trim=$4, ponderacion_examen=$5, nota_max=$6, nota_min_aprob=$7
            RETURNING *`,
            [curso_id, grado_id, num_trimestres || 3, ponderacion_trim || 0.9, ponderacion_examen || 0.1, nota_max || 10, nota_min_aprob || 7]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error POST config:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ═══════════════════════════════════════════
// CURSOS & GRADOS & ASIGNATURAS
// ═══════════════════════════════════════════

// GET /api/calificaciones/cursos
router.get('/cursos', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cursos ORDER BY nombre DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/cursos
router.post('/cursos', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { nombre, activo } = req.body;
        if (!nombre) return res.status(400).json({ message: 'nombre requerido' });
        const r = await pool.query(
            'INSERT INTO cursos (nombre, activo) VALUES ($1,$2) ON CONFLICT (nombre) DO UPDATE SET activo=$2 RETURNING *',
            [nombre, activo !== false]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// GET /api/calificaciones/grados
router.get('/grados', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM grados ORDER BY orden ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/grados
router.post('/grados', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { nombre, clave, orden } = req.body;
        if (!nombre || !clave) return res.status(400).json({ message: 'nombre y clave requeridos' });
        const r = await pool.query(
            'INSERT INTO grados (nombre, clave, orden) VALUES ($1,$2,$3) ON CONFLICT (clave) DO UPDATE SET nombre=$1, orden=$3 RETURNING *',
            [nombre, clave, orden || 0]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// GET /api/calificaciones/asignaturas?grado_id=
router.get('/asignaturas', verifyToken, async (req, res) => {
    try {
        const { grado_id } = req.query;
        if (grado_id) {
            const r = await pool.query(`
                SELECT a.* FROM asignaturas a
                JOIN asignatura_grado ag ON a.id = ag.asignatura_id
                WHERE ag.grado_id = $1 ORDER BY a.nombre`, [grado_id]);
            return res.json(r.rows);
        }
        const result = await pool.query('SELECT * FROM asignaturas ORDER BY nombre');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/asignaturas
router.post('/asignaturas', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { abr, nombre, alias, grado_id } = req.body;
        if (!abr || !nombre) return res.status(400).json({ message: 'abr y nombre requeridos' });
        const r = await pool.query(
            `INSERT INTO asignaturas (abr, nombre, alias) VALUES ($1,$2,$3)
             ON CONFLICT (abr) DO UPDATE SET nombre=$2, alias=$3 RETURNING *`,
            [abr.toUpperCase(), nombre, JSON.stringify(alias || [])]
        );
        if (grado_id) {
            await pool.query(
                'INSERT INTO asignatura_grado (grado_id, asignatura_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [grado_id, r.rows[0].id]
            );
        }
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/asignaturas/vincular  (vincular asignatura a grado)
router.post('/asignaturas/vincular', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { grado_id, asignatura_id } = req.body;
        if (!grado_id || !asignatura_id) return res.status(400).json({ message: 'grado_id y asignatura_id requeridos' });
        await pool.query(
            'INSERT INTO asignatura_grado (grado_id, asignatura_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [grado_id, asignatura_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ═══════════════════════════════════════════
// ESTUDIANTES EN CURSO
// ═══════════════════════════════════════════

// GET /api/calificaciones/estudiantes?grado_id=&curso_id=
router.get('/estudiantes', verifyToken, async (req, res) => {
    try {
        const { grado_id, curso_id } = req.query;
        let query = `
            SELECT ec.id, ec.numero_matricula, ec.numero_lista,
                   u.id as usuario_id, u.nombre_completo, u.email, u.username
            FROM estudiantes_curso ec
            JOIN usuarios u ON ec.estudiante_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (grado_id) { params.push(grado_id); query += ` AND ec.grado_id = $${params.length}`; }
        if (curso_id) { params.push(curso_id); query += ` AND ec.curso_id = $${params.length}`; }
        query += ' ORDER BY ec.numero_lista ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET estudiantes:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/estudiantes  (inscribir un estudiante)
router.post('/estudiantes', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { estudiante_id, grado_id, curso_id, numero_matricula, numero_lista } = req.body;
        if (!estudiante_id || !grado_id || !curso_id) {
            return res.status(400).json({ message: 'estudiante_id, grado_id y curso_id requeridos' });
        }
        const r = await pool.query(`
            INSERT INTO estudiantes_curso (estudiante_id, grado_id, curso_id, numero_matricula, numero_lista)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (estudiante_id, grado_id, curso_id) DO UPDATE SET numero_matricula=$4, numero_lista=$5
            RETURNING *`,
            [estudiante_id, grado_id, curso_id, numero_matricula || '', numero_lista || 0]
        );
        res.json(r.rows[0]);
    } catch (err) {
        console.error('Error POST estudiante:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/estudiantes/upload-excel
router.post('/estudiantes/upload-excel', verifyToken, puedeGestionar, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Archivo Excel requerido' });

        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

        // Buscar hoja "NOMINA" (como en el Excel de referencia)
        const sheetName = workbook.SheetNames.find(s => s.toUpperCase() === 'NOMINA') || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const { grado_id, curso_id } = req.body;
        if (!grado_id || !curso_id) return res.status(400).json({ message: 'grado_id y curso_id requeridos en el body' });

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('uepam477', 12);
        let importados = 0;
        const errores = [];

        // Asumimos que la nómina tiene columnas: N°, CÉDULA, APELLIDOS Y NOMBRES
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 3) continue;
            // Saltar encabezados
            const firstCell = String(row[0] || '').trim().toUpperCase();
            if (firstCell === 'N°' || firstCell === 'Nº' || firstCell === 'NO.' || firstCell === 'NUMERO') continue;
            if (isNaN(parseInt(row[0]))) continue; // no es un número de lista

            const numeroLista = parseInt(row[0]);
            const cedula = String(row[1] || '').trim();
            const nombreCompleto = String(row[2] || '').trim();

            if (!cedula || !nombreCompleto) continue;

            try {
                // Crear o actualizar usuario
                const userRes = await pool.query(
                    `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol)
                     VALUES ($1,$2,$3,$4,'estudiante')
                     ON CONFLICT (email) DO UPDATE SET nombre_completo = $3
                     RETURNING id`,
                    [`e${cedula}@colegio.com`, passwordHash, nombreCompleto, cedula]
                );
                const userId = userRes.rows[0].id;

                // Inscribir
                await pool.query(`
                    INSERT INTO estudiantes_curso (estudiante_id, grado_id, curso_id, numero_matricula, numero_lista)
                    VALUES ($1,$2,$3,$4,$5)
                    ON CONFLICT (estudiante_id, grado_id, curso_id) DO UPDATE SET numero_lista=$5`,
                    [userId, grado_id, curso_id, cedula, numeroLista]
                );
                importados++;
            } catch (e) {
                errores.push(`Fila ${i + 1}: ${e.message}`);
            }
        }

        res.json({ importados, errores, total: data.length });
    } catch (err) {
        console.error('Error upload Excel:', err);
        res.status(500).json({ message: 'Error al procesar el archivo Excel' });
    }
});

// ═══════════════════════════════════════════
// ASIGNACIONES DOCENTE ↔ MATERIA
// ═══════════════════════════════════════════

// GET /api/calificaciones/asignaciones?docente_id=&grado_id=&curso_id=
router.get('/asignaciones', verifyToken, async (req, res) => {
    try {
        const { docente_id, grado_id, curso_id } = req.query;
        let query = `
            SELECT da.*, u.nombre_completo as docente_nombre, a.nombre as asignatura_nombre,
                   g.nombre as grado_nombre, c.nombre as curso_nombre
            FROM docente_asignacion da
            JOIN usuarios u ON da.docente_id = u.id
            JOIN asignaturas a ON da.asignatura_id = a.id
            JOIN grados g ON da.grado_id = g.id
            JOIN cursos c ON da.curso_id = c.id
            WHERE 1=1
        `;
        const params = [];
        if (docente_id) { params.push(docente_id); query += ` AND da.docente_id = $${params.length}`; }
        if (grado_id) { params.push(grado_id); query += ` AND da.grado_id = $${params.length}`; }
        if (curso_id) { params.push(curso_id); query += ` AND da.curso_id = $${params.length}`; }
        query += ' ORDER BY g.orden, a.nombre';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET asignaciones:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/asignaciones
router.post('/asignaciones', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { docente_id, asignatura_id, grado_id, curso_id } = req.body;
        if (!docente_id || !asignatura_id || !grado_id || !curso_id) {
            return res.status(400).json({ message: 'Todos los campos son requeridos' });
        }
        const r = await pool.query(`
            INSERT INTO docente_asignacion (docente_id, asignatura_id, grado_id, curso_id)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (docente_id, asignatura_id, grado_id, curso_id) DO NOTHING
            RETURNING *`,
            [docente_id, asignatura_id, grado_id, curso_id]
        );
        if (r.rows.length === 0) return res.status(409).json({ message: 'Esta asignación ya existe' });
        res.json(r.rows[0]);
    } catch (err) {
        console.error('Error POST asignacion:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// DELETE /api/calificaciones/asignaciones/:id
router.delete('/asignaciones/:id', verifyToken, puedeGestionar, async (req, res) => {
    try {
        await pool.query('DELETE FROM docente_asignacion WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ═══════════════════════════════════════════
// MIS MATERIAS (vista del docente)
// ═══════════════════════════════════════════

// GET /api/calificaciones/mis-materias
router.get('/mis-materias', verifyToken, async (req, res) => {
    try {
        // Si es admin/secretaria, mostrar todas las materias
        if (req.user.rol === 'admin' || req.user.rol === 'secretaria') {
            const result = await pool.query(`
                SELECT ag.id, a.nombre as asignatura_nombre, a.abr, a.id as asignatura_id,
                       g.nombre as grado_nombre, g.id as grado_id, g.clave as grado_clave,
                       c.nombre as curso_nombre, c.id as curso_id,
                       (SELECT COUNT(*) FROM estudiantes_curso ec WHERE ec.grado_id = g.id AND ec.curso_id = c.id) as total_estudiantes
                FROM asignatura_grado ag
                JOIN asignaturas a ON ag.asignatura_id = a.id
                JOIN grados g ON ag.grado_id = g.id
                CROSS JOIN (SELECT id, nombre FROM cursos WHERE activo = true) c
                ORDER BY c.nombre DESC, g.orden, a.nombre
            `);
            return res.json(result.rows);
        }
        const result = await pool.query(`
            SELECT da.*, a.nombre as asignatura_nombre, a.abr,
                   g.nombre as grado_nombre, g.clave as grado_clave,
                   c.nombre as curso_nombre,
                   (SELECT COUNT(*) FROM estudiantes_curso ec WHERE ec.grado_id = da.grado_id AND ec.curso_id = da.curso_id) as total_estudiantes
            FROM docente_asignacion da
            JOIN asignaturas a ON da.asignatura_id = a.id
            JOIN grados g ON da.grado_id = g.id
            JOIN cursos c ON da.curso_id = c.id
            WHERE da.docente_id = $1
            ORDER BY c.nombre DESC, g.orden, a.nombre`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error mis-materias:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ═══════════════════════════════════════════
// CALIFICACIONES (ingreso de notas)
// ═══════════════════════════════════════════

// GET /api/calificaciones/notas?asignatura_id=&grado_id=&curso_id=&trimestre=
router.get('/notas', verifyToken, async (req, res) => {
    try {
        const { asignatura_id, grado_id, curso_id, trimestre, estudiante_curso_id } = req.query;
        // Si es docente, solo ve sus materias
        if (req.user.rol === 'docente') {
            const tiene = await pool.query(
                'SELECT id FROM docente_asignacion WHERE docente_id=$1 AND asignatura_id=$2 AND grado_id=$3 AND curso_id=$4',
                [req.user.id, asignatura_id, grado_id, curso_id]
            );
            if (tiene.rows.length === 0 && req.user.rol !== 'admin' && req.user.rol !== 'secretaria') {
                return res.status(403).json({ message: 'No tienes esta materia asignada' });
            }
        }

        let query = `
            SELECT cal.*, u.nombre_completo as estudiante_nombre, ec.numero_lista, ec.numero_matricula,
                   a.nombre as asignatura_nombre, g.nombre as grado_nombre
            FROM calificaciones cal
            JOIN estudiantes_curso ec ON cal.estudiante_curso_id = ec.id
            JOIN usuarios u ON ec.estudiante_id = u.id
            JOIN asignaturas a ON cal.asignatura_id = a.id
            JOIN grados g ON ec.grado_id = g.id
            WHERE 1=1
        `;
        const params = [];
        if (asignatura_id) { params.push(asignatura_id); query += ` AND cal.asignatura_id = $${params.length}`; }
        if (grado_id) { params.push(grado_id); query += ` AND ec.grado_id = $${params.length}`; }
        if (curso_id) { params.push(curso_id); query += ` AND ec.curso_id = $${params.length}`; }
        if (trimestre) { params.push(trimestre); query += ` AND cal.trimestre = $${params.length}`; }
        if (estudiante_curso_id) { params.push(estudiante_curso_id); query += ` AND cal.estudiante_curso_id = $${params.length}`; }
        query += ' ORDER BY ec.numero_lista, cal.trimestre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error GET notas:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// POST /api/calificaciones/notas  (guardar notas — batch)
router.post('/notas', verifyToken, async (req, res) => {
    try {
        // Solo docentes, admin y secretaria pueden guardar notas
        if (!['docente', 'admin', 'secretaria'].includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        const { asignatura_id, grado_id, curso_id, trimestre, notas } = req.body;
        if (!asignatura_id || !grado_id || !curso_id || !trimestre || !notas) {
            return res.status(400).json({ message: 'asignatura_id, grado_id, curso_id, trimestre y notas[] requeridos' });
        }

        // Verificar que el docente tiene esta materia asignada (admin/secretaria pueden todo)
        if (req.user.rol === 'docente') {
            const tiene = await pool.query(
                'SELECT id FROM docente_asignacion WHERE docente_id=$1 AND asignatura_id=$2 AND grado_id=$3 AND curso_id=$4',
                [req.user.id, asignatura_id, grado_id, curso_id]
            );
            if (tiene.rows.length === 0) {
                return res.status(403).json({ message: 'No tienes esta materia asignada' });
            }
        }

        // Obtener configuración de fórmula
        const configRes = await pool.query(
            'SELECT * FROM config_calificaciones WHERE curso_id=$1 AND grado_id=$2',
            [curso_id, grado_id]
        );
        const config = configRes.rows[0] || { nota_max: 10, ponderacion_trim: 0.9, ponderacion_examen: 0.1, nota_min_aprob: 7 };
        const numTrimestres = config.num_trimestres || 3;

        // Obtener todos los estudiantes del curso para el cálculo
        const estudiantesRes = await pool.query(
            'SELECT id, estudiante_id FROM estudiantes_curso WHERE grado_id=$1 AND curso_id=$2 ORDER BY numero_lista',
            [grado_id, curso_id]
        );

        let guardados = 0;
        const resumen = [];

        for (const n of notas) {
            const { estudiante_curso_id, nota_parcial, examen, supletorio, comportamiento } = n;
            if (!estudiante_curso_id) continue;

            // Calcular promedio ponderado y nota final
            const examenNota = parseFloat(examen) || 0;
            const promedioPond = calcularNotaFinal([parseFloat(nota_parcial) || 0], examenNota, config);
            const supletorioNota = supletorio ? parseFloat(supletorio) : null;
            const notaFinal = supletorioNota ? Math.max(promedioPond, supletorioNota) : promedioPond;

            await pool.query(`
                INSERT INTO calificaciones (estudiante_curso_id, asignatura_id, trimestre, nota_parcial, examen, supletorio, promedio_ponderado, nota_final, cualitativa, comportamiento, subido_por, fecha_subida)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
                ON CONFLICT (estudiante_curso_id, asignatura_id, trimestre)
                DO UPDATE SET nota_parcial=$4, examen=$5, supletorio=$6, promedio_ponderado=$7, nota_final=$8, cualitativa=$9, comportamiento=$10, subido_por=$11, fecha_subida=NOW()`,
                [estudiante_curso_id, asignatura_id, trimestre,
                 parseFloat(nota_parcial) || 0, examenNota, supletorioNota,
                 promedioPond, notaFinal, cualitativa(notaFinal),
                 comportamiento || null, req.user.id]
            );
            guardados++;
        }

        // Construir resumen para el docente
        const notasGuardadas = await pool.query(`
            SELECT cal.nota_final FROM calificaciones cal
            WHERE cal.asignatura_id=$1 AND cal.trimestre=$2
            AND cal.estudiante_curso_id IN (SELECT id FROM estudiantes_curso WHERE grado_id=$3 AND curso_id=$4)`,
            [asignatura_id, trimestre, grado_id, curso_id]
        );
        const notasArr = notasGuardadas.rows.map(r => parseFloat(r.nota_final));
        const promedioCurso = notasArr.length > 0 ? (notasArr.reduce((a, b) => a + b, 0) / notasArr.length).toFixed(2) : 0;
        const aprobados = notasArr.filter(n => n >= parseFloat(config.nota_min_aprob)).length;
        const reprobados = notasArr.length - aprobados;

        // Obtener nombres para el resumen
        const asigRes = await pool.query('SELECT nombre FROM asignaturas WHERE id=$1', [asignatura_id]);
        const gradoRes = await pool.query('SELECT nombre FROM grados WHERE id=$1', [grado_id]);

        res.json({
            success: true,
            guardados,
            total_estudiantes: estudiantesRes.rows.length,
            resumen: {
                asignatura: asigRes.rows[0]?.nombre,
                grado: gradoRes.rows[0]?.nombre,
                trimestre,
                promedio_curso: parseFloat(promedioCurso),
                aprobados,
                reprobados,
                fecha: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Error POST notas:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// GET /api/calificaciones/resumen/:estudiante_curso_id  — boletín individual
router.get('/resumen/:estudiante_curso_id', verifyToken, async (req, res) => {
    try {
        const { estudiante_curso_id } = req.params;

        // Estudiante
        const estRes = await pool.query(`
            SELECT ec.*, u.nombre_completo, u.username as cedula,
                   g.nombre as grado_nombre, c.nombre as curso_nombre
            FROM estudiantes_curso ec
            JOIN usuarios u ON ec.estudiante_id = u.id
            JOIN grados g ON ec.grado_id = g.id
            JOIN cursos c ON ec.curso_id = c.id
            WHERE ec.id = $1`, [estudiante_curso_id]);
        if (estRes.rows.length === 0) return res.status(404).json({ message: 'Estudiante no encontrado' });
        const estudiante = estRes.rows[0];

        // Notas por trimestre por asignatura
        const notasRes = await pool.query(`
            SELECT cal.trimestre, cal.nota_parcial, cal.examen, cal.supletorio,
                   cal.promedio_ponderado, cal.nota_final, cal.cualitativa, cal.comportamiento,
                   a.nombre as asignatura_nombre, a.abr
            FROM calificaciones cal
            JOIN asignaturas a ON cal.asignatura_id = a.id
            WHERE cal.estudiante_curso_id = $1
            ORDER BY a.nombre, cal.trimestre`, [estudiante_curso_id]);

        // Agrupar por asignatura
        const materias = {};
        for (const n of notasRes.rows) {
            if (!materias[n.asignatura_nombre]) {
                materias[n.asignatura_nombre] = { abr: n.abr, trimestres: [], promedio_anual: 0 };
            }
            materias[n.asignatura_nombre].trimestres.push(n);
        }

        // Calcular promedio anual por materia y general
        let sumaGeneral = 0;
        let countMaterias = 0;
        for (const key of Object.keys(materias)) {
            const notasFinales = materias[key].trimestres.map(t => parseFloat(t.nota_final) || 0);
            const prom = notasFinales.length > 0 ? notasFinales.reduce((a, b) => a + b, 0) / notasFinales.length : 0;
            materias[key].promedio_anual = parseFloat(prom.toFixed(2));
            sumaGeneral += materias[key].promedio_anual;
            countMaterias++;
        }
        const promedioGeneral = countMaterias > 0 ? parseFloat((sumaGeneral / countMaterias).toFixed(3)) : 0;

        res.json({
            estudiante,
            materias,
            promedio_general: promedioGeneral,
            cualitativa_general: cualitativa(promedioGeneral)
        });
    } catch (err) {
        console.error('Error GET resumen:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// GET /api/calificaciones/sabana?grado_id=&curso_id=  — datos para generar Excel
router.get('/sabana', verifyToken, puedeGestionar, async (req, res) => {
    try {
        const { grado_id, curso_id } = req.query;
        if (!grado_id || !curso_id) return res.status(400).json({ message: 'grado_id y curso_id requeridos' });

        // Estudiantes
        const estRes = await pool.query(`
            SELECT ec.id, ec.numero_lista, ec.numero_matricula, u.nombre_completo
            FROM estudiantes_curso ec
            JOIN usuarios u ON ec.estudiante_id = u.id
            WHERE ec.grado_id=$1 AND ec.curso_id=$2 ORDER BY ec.numero_lista`, [grado_id, curso_id]);

        // Asignaturas del grado
        const asigRes = await pool.query(`
            SELECT a.* FROM asignaturas a
            JOIN asignatura_grado ag ON a.id = ag.asignatura_id
            WHERE ag.grado_id=$1 ORDER BY a.nombre`, [grado_id]);

        // Config
        const configRes = await pool.query(
            'SELECT * FROM config_calificaciones WHERE curso_id=$1 AND grado_id=$2',
            [curso_id, grado_id]
        );
        const config = configRes.rows[0] || { num_trimestres: 3, ponderacion_trim: 0.9, ponderacion_examen: 0.1, nota_max: 10, nota_min_aprob: 7 };

        // Notas
        const notasRes = await pool.query(`
            SELECT cal.*, a.nombre as asig_nombre
            FROM calificaciones cal
            JOIN asignaturas a ON cal.asignatura_id = a.id
            WHERE cal.estudiante_curso_id IN (SELECT id FROM estudiantes_curso WHERE grado_id=$1 AND curso_id=$2)
            ORDER BY cal.estudiante_curso_id, a.nombre, cal.trimestre`,
            [grado_id, curso_id]
        );

        // Organizar por estudiante → asignatura → trimestre
        const sabana = estRes.rows.map(est => {
            const fila = {
                estudiante_curso_id: est.id,
                numero_lista: est.numero_lista,
                nombre: est.nombre_completo,
                matricula: est.numero_matricula,
                materias: {}
            };
            for (const asig of asigRes.rows) {
                fila.materias[asig.abr] = { nombre: asig.nombre, T1: null, T2: null, T3: null, examen: null, supletorio: null, ponderado: null, nota_final: null, cualitativa: null };
            }
            // Llenar notas
            const misNotas = notasRes.rows.filter(n => n.estudiante_curso_id === est.id);
            for (const n of misNotas) {
                const abr = asigRes.rows.find(a => a.nombre === n.asig_nombre)?.abr;
                if (abr && fila.materias[abr]) {
                    fila.materias[abr][`T${n.trimestre}`] = n.nota_parcial;
                    if (n.trimestre === 3 || n.examen > 0) {
                        fila.materias[abr].examen = n.examen;
                        fila.materias[abr].supletorio = n.supletorio;
                        fila.materias[abr].ponderado = n.promedio_ponderado;
                        fila.materias[abr].nota_final = n.nota_final;
                        fila.materias[abr].cualitativa = n.cualitativa;
                    }
                }
            }
            // Calcular comportamiento (del último registro)
            const compNota = notasRes.rows.filter(n => n.estudiante_curso_id === est.id && n.comportamiento);
            fila.comportamiento = compNota.length > 0 ? compNota[compNota.length - 1].comportamiento : null;

            // Promedio general
            const todasNotas = notasRes.rows.filter(n => n.estudiante_curso_id === est.id).map(n => parseFloat(n.nota_final) || 0);
            fila.promedio_general = todasNotas.length > 0 ? parseFloat((todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length).toFixed(3)) : 0;
            fila.estado = fila.promedio_general >= parseFloat(config.nota_min_aprob) ? 'APROBADO' : 'REPROBADO';

            return fila;
        });

        res.json({
            config,
            asignaturas: asigRes.rows,
            sabana,
            grado: (await pool.query('SELECT nombre FROM grados WHERE id=$1', [grado_id])).rows[0]?.nombre,
            curso: (await pool.query('SELECT nombre FROM cursos WHERE id=$1', [curso_id])).rows[0]?.nombre
        });
    } catch (err) {
        console.error('Error GET sabana:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

// ═══════════════════════════════════════════
// ESTADÍSTICAS (para dashboard admin)
// ═══════════════════════════════════════════

// GET /api/calificaciones/estadisticas
router.get('/estadisticas', verifyToken, async (req, res) => {
    try {
        if (!['admin','secretaria'].includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        const [totalCal, totalEst, totalMat, totalAsig, totalCursos] = await Promise.all([
            pool.query('SELECT COUNT(*) as cnt FROM calificaciones'),
            pool.query('SELECT COUNT(*) as cnt FROM estudiantes_curso'),
            pool.query('SELECT COUNT(DISTINCT asignatura_id) as cnt FROM calificaciones'),
            pool.query('SELECT COUNT(*) as cnt FROM docente_asignacion'),
            pool.query('SELECT COUNT(*) as cnt FROM cursos WHERE activo=true')
        ]);
        res.json({
            total_calificaciones: parseInt(totalCal.rows[0].cnt),
            total_estudiantes: parseInt(totalEst.rows[0].cnt),
            total_materias: parseInt(totalMat.rows[0].cnt),
            total_asignaciones: parseInt(totalAsig.rows[0].cnt),
            total_cursos: parseInt(totalCursos.rows[0].cnt)
        });
    } catch (err) {
        console.error('Error estadisticas:', err);
        res.status(500).json({ message: 'Error del servidor' });
    }
});

module.exports = router;
