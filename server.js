require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Configuración de la base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middlewares
app.use(cors());
app.use(express.json());
// Middleware para verificar el Token
function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        req.token = bearerToken;
        next(); // Pasa al siguiente middleware o ruta
    } else {
        res.sendStatus(403); // Prohibido
    }
}

// --- RUTA PARA OBTENER NOTICIAS ---
// --- RUTAS DE NOTICIAS ---

// OBTENER todas las noticias (ruta pública)
app.get('/api/noticias', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM noticias ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error del servidor");
    }
});

// CREAR una nueva noticia (ruta protegida)
app.post('/api/noticias', verifyToken, async (req, res) => {
    jwt.verify(req.token, process.env.JWT_SECRET, async (err, authData) => {
        if (err) {
            return res.sendStatus(403); // Token no válido
        }

        try {
            const { titulo, contenido } = req.body;
            const nuevaNoticia = await pool.query(
                'INSERT INTO noticias (titulo, contenido) VALUES ($1, $2) RETURNING *',
                [titulo, contenido]
            );
            res.status(201).json(nuevaNoticia.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).send("Error del servidor");
        }
    });
});

// ELIMINAR una noticia (ruta protegida)
app.delete('/api/noticias/:id', verifyToken, async (req, res) => {
    jwt.verify(req.token, process.env.JWT_SECRET, async (err, authData) => {
        if (err) {
            return res.sendStatus(403);
        }

        try {
            const { id } = req.params;
            await pool.query('DELETE FROM noticias WHERE id = $1', [id]);
            res.json({ message: 'Noticia eliminada' });
        } catch (err) {
            console.error(err.message);
            res.status(500).send("Error del servidor");
        }
    });
});

// --- RUTA PARA REGISTRAR USUARIOS ---
app.post('/api/register', async (req, res) => {
    const { email, password, nombre } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'El email y la contraseña son requeridos.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO usuarios (email, password_hash, nombre) VALUES ($1, $2, $3) RETURNING id, email, rol',
            [email, password_hash, nombre]
        );

        res.status(201).json(newUser.rows[0]);

    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: 'El email ya está registrado.' });
        }
        console.error(err);
        res.status(500).send("Error en el servidor");
    }
});

// --- RUTA PARA INICIAR SESIÓN ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'El email y la contraseña son requeridos.' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // Creamos el token usando la clave secreta del archivo .env
        const token = jwt.sign(
            { id: user.id, email: user.email, rol: user.rol },
            process.env.JWT_SECRET, // <-- Usando la clave segura
            { expiresIn: '1h' }
        );

        res.json({ message: 'Login exitoso', token: token });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error en el servidor");
    }
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});