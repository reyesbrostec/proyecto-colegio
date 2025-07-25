const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
            if (err) {
                return res.status(403).json({ message: 'Token inválido o expirado.' }); // Forbidden
            }
            req.user = authData;
            next();
        });
    } else {
        res.status(401).json({ message: 'Acceso denegado. Se requiere token.' }); // Unauthorized
    }
}

function isAdmin(req, res, next) {
    if (req.user && req.user.rol === 'admin') {
        return next();
    }
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
}

function isEstudiante(req, res, next) {
    if (req.user && req.user.rol === 'estudiante') {
        return next();
    }
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de estudiante.' });
}

function isDocente(req, res, next) {
    // Un admin también puede hacer lo que hace un docente
    if (req.user && (req.user.rol === 'docente' || req.user.rol === 'admin')) {
        return next();
    }
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de docente.' });
}

function isDocente(req, res, next) {
    // Un admin también puede hacer lo que hace un docente
    if (req.user && (req.user.rol === 'docente' || req.user.rol === 'admin')) {
        return next();
    }
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de docente.' });
}

module.exports = { verifyToken, isAdmin, isEstudiante, isDocente };