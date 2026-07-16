// api/_lib/rateLimit.js — Rate limiting compartido para Vercel serverless
// Simple in-memory per-IP rate limiter. Serverless functions comparten
// estado en warm instances, pero no entre cold starts. Para producción
// de alto tráfico, migrar a Vercel KV o Upstash Redis.

var rateMap = {};       // IP → { count, resetAt }

// Limpieza periódica de entradas expiradas (cada 5 minutos)
var CLEANUP_INTERVAL = 300000;
if (typeof setInterval !== 'undefined') {
    setInterval(function () {
        var now = Math.floor(Date.now() / 1000);
        var cleaned = 0;
        for (var ip in rateMap) {
            if (rateMap[ip].resetAt < now) { delete rateMap[ip]; cleaned++; }
        }
        if (cleaned > 100) console.log('[rateLimit] Purged ' + cleaned + ' expired entries');
    }, CLEANUP_INTERVAL);
}

/**
 * Verifica rate limit por IP. Retorna true si está permitido, false si excedió.
 * @param {string} ip - Dirección IP del cliente
 * @param {number} maxReqs - Máximo de peticiones en la ventana (default: 50)
 * @param {number} windowSecs - Ventana en segundos (default: 60)
 * @returns {boolean}
 */
function checkRateLimit(ip, maxReqs, windowSecs) {
    var max = maxReqs || 50;
    var window = windowSecs || 60;
    var now = Math.floor(Date.now() / 1000);
    var entry = rateMap[ip];
    if (!entry || now > entry.resetAt) {
        rateMap[ip] = { count: 1, resetAt: now + window };
        return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
}

/**
 * Helper para extraer IP del request de Vercel
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Middleware-style wrapper: aplica rate limit y responde 429 si excede
 * @returns {string|null} IP si permitido, null si bloqueado (ya respondió 429)
 */
function applyRateLimit(req, res, maxReqs, windowSecs) {
    var ip = getClientIP(req);
    if (!checkRateLimit(ip, maxReqs, windowSecs)) {
        res.status(429).json({ message: 'Demasiadas peticiones. Intente de nuevo en unos segundos.' });
        return null;
    }
    return ip;
}

module.exports = { checkRateLimit, getClientIP, applyRateLimit };
