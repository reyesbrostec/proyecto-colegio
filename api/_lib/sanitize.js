// api/_lib/sanitize.js — Sanitización de entradas para prevenir XSS y inyección

/**
 * Escapa HTML para prevenir XSS cuando se renderiza contenido
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Limpia string: remueve tags HTML/Script y trunca a longitud máxima
 */
function cleanStr(val, maxLen) {
    if (typeof val !== 'string') return '';
    return val
        .replace(/<[^>]*>/g, '')           // remueve tags HTML
        .replace(/javascript:/gi, '')       // remueve javascript: URIs
        .replace(/on\w+\s*=/gi, '')         // remueve event handlers inline
        .substring(0, maxLen || 500)
        .trim();
}

/**
 * Valida que un string solo contenga caracteres seguros (alfanuméricos + básicos)
 */
function isSafeString(str, maxLen) {
    if (typeof str !== 'string') return false;
    if (str.length > (maxLen || 200)) return false;
    return !/<[^>]*>/.test(str) && !/javascript:/i.test(str);
}

/**
 * Valida email con restricciones estrictas
 */
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@<>]{1,150}@[^\s@<>]{1,100}\.[^\s@<>]{1,50}$/.test(email);
}

/**
 * Sanitiza un objeto completo, limpiando todas sus propiedades string
 */
function sanitizeObject(obj, fields, maxLen) {
    if (!obj || typeof obj !== 'object') return obj;
    var cleaned = {};
    var len = maxLen || 500;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            cleaned[key] = (fields && fields.indexOf(key) === -1)
                ? obj[key]
                : cleanStr(obj[key], len);
        }
    }
    return cleaned;
}

module.exports = { escapeHtml, cleanStr, isSafeString, isValidEmail, sanitizeObject };
