// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Importar routers
const authRoutes = require('./routes/auth');
const noticiasRoutes = require('./routes/noticias');
const usuariosRoutes = require('./routes/usuarios');
const notasRoutes = require('./routes/notas');

// --- 2. CONFIGURACIÓN INICIAL ---
const app = express();
// Usar el puerto de Render o 3000 para desarrollo local
const port = process.env.PORT || 3000;

// --- Conexión a la Base de Datos ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- 3. MIDDLEWARES ---
const allowedOrigins = [
    'https://proyecto-colegio.vercel.app',
    'http://localhost:3000', // Si usas un servidor local para el frontend
    'http://127.0.0.1:3000', // Alternativa para localhost
    'http://127.0.0.1:5500'  // Origen común para la extensión "Live Server" de VS Code
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir URLs de preview de Vercel (ej: proyecto-colegio-git-main-....vercel.app)
        const isVercelPreview = origin && /^https:\/\/proyecto-colegio-.*\.vercel\.app$/.test(origin);

        // Permitir peticiones sin 'origin' (como las de Postman), si el origen está en la lista,
        // o si es una URL de vista previa de Vercel.
        if (!origin || allowedOrigins.includes(origin) || isVercelPreview) {
            callback(null, true); // Permitir la petición
        } else {
            console.error(`CORS error: Origin ${origin} not allowed.`);
            callback(new Error('Not allowed by CORS')); // Bloquear la petición
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// --- 4. MIDDLEWARE DE AUTENTICACIÓN ---
function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
            if (err) return res.sendStatus(403);
            req.user = authData;
            next();
        });
    } else {
        res.sendStatus(403);
    }
}

// --- 5. RUTAS DE LA API ---
app.get('/api/noticias', async (req, res) => { try { const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC'); res.json(result.rows); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });
app.get('/api/usuarios', verifyToken, async (req, res) => { if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' }); try { const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC'); res.json(result.rows); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });
app.post('/api/usuarios', verifyToken, async (req, res) => { if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' }); const { email, password, nombre_completo, username, edad, rol } = req.body; if (!email || !password || !username) return res.status(400).json({ message: 'Email, contraseña y nombre de usuario son requeridos.' }); try { const salt = await bcrypt.genSalt(10); const password_hash = await bcrypt.hash(password, salt); const newUser = await pool.query('INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, rol', [email, password_hash, nombre_completo, username, edad, rol || 'estudiante']); res.status(201).json(newUser.rows[0]); } catch (err) { if (err.code === '23505') return res.status(400).json({ message: 'El email o nombre de usuario ya está registrado.' }); res.status(500).json({ message: "Error del servidor" }); } });
app.post('/api/noticias', verifyToken, async (req, res) => { if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' }); try { const { titulo, contenido } = req.body; const nuevaNoticia = await pool.query('INSERT INTO noticias (titulo, contenido) VALUES ($1, $2) RETURNING *', [titulo, contenido]); res.status(201).json(nuevaNoticia.rows[0]); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });
app.delete('/api/noticias/:id', verifyToken, async (req, res) => { if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' }); try { const { id } = req.params; await pool.query('DELETE FROM noticias WHERE id = $1', [id]); res.json({ message: 'Noticia eliminada' }); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });

// --- NUEVAS RUTAS PARA GESTIONAR USUARIOS (CRUD) ---

// OBTENER UN USUARIO POR ID (para poblar el form de edición)
app.get('/api/usuarios/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' });
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

// ACTUALIZAR UN USUARIO (PUT)
app.put('/api/usuarios/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' });
    const { id } = req.params;
    const { nombre_completo, username, email, rol, edad } = req.body;
    if (!nombre_completo || !username || !email || !rol) return res.status(400).json({ message: 'Todos los campos son requeridos.' });

    try {
        const result = await pool.query(
            'UPDATE usuarios SET nombre_completo = $1, username = $2, email = $3, rol = $4, edad = $5 WHERE id = $6 RETURNING id, nombre_completo, username, email, rol',
            [nombre_completo, username, email, rol, edad, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'El email o nombre de usuario ya existe.' });
        res.status(500).json({ message: "Error del servidor" });
    }
});

// ELIMINAR UN USUARIO (DELETE)
app.delete('/api/usuarios/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' });
    try {
        const { id } = req.params;
        const deleteResult = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        if (deleteResult.rowCount === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.status(204).send(); // 204 No Content es una respuesta estándar para un DELETE exitoso
    } catch (err) {
        res.status(500).json({ message: "Error del servidor" });
    }
});

app.post('/api/login', async (req, res) => { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ message: 'El email y la contraseña son requeridos.' }); try { const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]); if (userResult.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' }); const user = userResult.rows[0]; const isMatch = await bcrypt.compare(password, user.password_hash); if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' }); const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '1h' }); res.json({ message: 'Login exitoso', token: token }); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });
app.get('/api/mis-notas', verifyToken, async (req, res) => { if (req.user.rol !== 'estudiante') return res.status(403).json({ message: 'Acceso denegado.' }); try { const estudianteId = req.user.id; const result = await pool.query('SELECT materia, parcial1, parcial2, examen_final, nota_final FROM notas WHERE estudiante_id = $1 ORDER BY materia', [estudianteId]); res.json(result.rows); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });
app.get('/api/todas-las-notas', verifyToken, async (req, res) => { if (req.user.rol !== 'admin') return res.status(403).json({ message: 'Acceso denegado.' }); try { const query = `SELECT u.nombre_completo, u.username, n.materia, n.nota_final FROM notas n JOIN usuarios u ON n.estudiante_id = u.id WHERE u.rol = 'estudiante' ORDER BY u.nombre_completo, n.materia;`; const result = await pool.query(query); res.json(result.rows); } catch (err) { res.status(500).json({ message: "Error del servidor" }); } });

// --- 6. SERVIR ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));

// --- 7. INICIAR EL SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
