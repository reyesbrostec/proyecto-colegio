// api/_lib/auth.js — Helpers de autenticación para Vercel serverless
const jwt = require('jsonwebtoken');

function verifyToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try { return jwt.verify(token, process.env.JWT_SECRET); }
    catch (err) { return null; }
}

function requireAuth(req, res) {
    const user = verifyToken(req);
    if (!user) { res.status(403).json({ message: 'Token inválido o expirado.' }); return null; }
    return user;
}

function requireAdmin(req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;
    if (user.rol !== 'admin') { res.status(403).json({ message: 'Se requiere rol de administrador.' }); return null; }
    return user;
}

function requireDocente(req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;
    if (user.rol !== 'docente' && user.rol !== 'admin') { res.status(403).json({ message: 'Se requiere rol de docente o admin.' }); return null; }
    return user;
}

function requireEstudiante(req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;
    if (user.rol !== 'estudiante') { res.status(403).json({ message: 'Se requiere rol de estudiante.' }); return null; }
    return user;
}

module.exports = { verifyToken, requireAuth, requireAdmin, requireDocente, requireEstudiante };
