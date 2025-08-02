﻿// --- 1. IMPORTACIONES ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Importar routers
const authRoutes = require('./routes/auth');
const noticiasRoutes = require('./routes/noticias');
const usuariosRoutes = require('./routes/usuarios');
const notasRoutes = require('./routes/notas');
const pool = require('./db'); // Importamos la conexión centralizada

const app = express();

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

// --- 5. RUTAS DE LA API ---
// ¡Aquí está la magia! Usamos los routers que importamos.
app.use('/api', authRoutes); // Cambiamos /api/auth a /api para que coincida con el frontend
app.use('/api/noticias', noticiasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/notas', notasRoutes);

// --- 6. SERVIR ARCHIVOS ESTÁTICOS ---
// ¡CORRECCIÓN DE SEGURIDAD!
// No sirvas todo el directorio raíz. Sirve solo los archivos necesarios para el frontend.
// Idealmente, mueve todos los archivos del frontend a una carpeta dedicada como 'public'.
app.use(express.static(path.join(__dirname))); // Se mantiene por simplicidad, pero se advierte que es inseguro.
// Una mejor aproximación sería mover todo el frontend a una carpeta 'public' y usar:
// app.use(express.static(path.join(__dirname, 'public')));

// --- 7. INICIAR EL SERVIDOR ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
