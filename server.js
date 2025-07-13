// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- 2. CONFIGURACIÓN INICIAL ---
const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- 3. MIDDLEWARES ---

// --- NUEVA CONFIGURACIÓN DE CORS PARA PRODUCCIÓN ---
const corsOptions = {
    origin: 'https://proyecto-colegio.vercel.app', // Permite solo peticiones desde tu sitio en Vercel
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// --- FIN DE LA NUEVA CONFIGURACIÓN ---

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

// --- 5. RUTAS DE LA API (No cambian) ---
// ... (Aquí van todas tus rutas /api/noticias, /api/usuarios, /api/login, etc.)
// --- RUTAS DE NOTICIAS ---
app.get('/api/noticias', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor al obtener noticias" });
    }
});

app.post('/api/noticias', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    try {
        const { titulo, contenido } = req.body;
        const nuevaNoticia = await pool.query('INSERT INTO noticias (titulo, contenido) VALUES ($1, $2) RETURNING *', [titulo, contenido]);
        res.status(201).json(nuevaNoticia.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor al crear noticia" });
    }
});

app.delete('/api/noticias/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM noticias WHERE id = $1', [id]);
        res.json({ message: 'Noticia eliminada' });
    } catch (err) {
        res.status(500).json({ message: "Error del servidor al eliminar noticia" });
    }
});


// --- RUTAS DE USUARIOS ---
app.get('/api/usuarios', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    try {
        const result = await pool.query('SELECT id, email, nombre_completo, username, edad, rol FROM usuarios ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error del servidor al obtener usuarios" });
    }
});

app.post('/api/usuarios', verifyToken, async (req, res) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado.' });
    }
    const { email, password, nombre_completo, username, edad, rol } = req.body;
    if (!email || !password || !username) {
        return res.status(400).json({ message: 'Email, contraseña y nombre de usuario son requeridos.' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            'INSERT INTO usuarios (email, password_hash, nombre_completo, username, edad, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, rol',
            [email, password_hash, nombre_completo, username, edad, rol || 'estudiante']
        );
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'El email o nombre de usuario ya está registrado.' });
        res.status(500).json({ message: "Error del servidor al crear usuario" });
    }
});

// RUTA DE LOGIN (Pública)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'El email y la contraseña son requeridos.' });
    try {
        const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (userResult.rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas' });
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login exitoso', token: token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error del servidor durante el login" });
    }
});


// --- 6. SERVIR ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname)));

// --- 7. INICIAR EL SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
