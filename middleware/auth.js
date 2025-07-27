const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ message: 'Token no proporcionado o con formato incorrecto.' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido o expirado.' });
        }
        req.user = decoded; // Añade la información del usuario (id, rol, email) a la petición
        next();
    });
}

function isAdmin(req, res, next) {
    if (req.user && req.user.rol === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }
}

function isDocente(req, res, next) {
    if (req.user && (req.user.rol === 'docente' || req.user.rol === 'admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Se requiere rol de docente o administrador.' });
    }
}

function isEstudiante(req, res, next) {
    if (req.user && req.user.rol === 'estudiante') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Se requiere rol de estudiante.' });
    }
}

module.exports = {
    verifyToken,
    isAdmin,
    isDocente,
    isEstudiante
};