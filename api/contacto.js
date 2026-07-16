/* api/contacto.js — Contact form handler with security
   - Turnstile CAPTCHA verification (privacy-friendly, no user friction)
   - Honeypot field detection (silent bot rejection)
   - Input sanitization & validation (server-side enforcement)
   - Rate limiting by IP (prevents abuse)
   - Stores contact messages in PostgreSQL for admin review
   ========================================================================== */

var pool; try { pool = require('./_lib/db.js').pool; } catch (e) { pool = null; }

// ── Rate limiting (simple in-memory, per-IP) ──
var rateMap = {};       // IP → { count, resetAt }
var RATE_LIMIT = 5;     // max submissions
var RATE_WINDOW = 900;  // 15 min in seconds

function checkRateLimit(ip) {
    var now = Math.floor(Date.now() / 1000);
    var entry = rateMap[ip];
    if (!entry || now > entry.resetAt) {
        rateMap[ip] = { count: 1, resetAt: now + RATE_WINDOW };
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

// ── Input sanitizers ──
function safeStr(val, maxLen) {
    if (typeof val !== 'string') return '';
    return val.replace(/[<>]/g, '').substring(0, maxLen || 500).trim();
}

function validEmail(email) {
    return /^[^\s@<>]{1,150}@[^\s@<>]{1,100}\.[^\s@<>]{1,50}$/.test(email);
}

// ── Turnstile verification ──
async function verifyTurnstile(token, secretKey) {
    if (!secretKey || !token) return false; // rechazar si no hay token/config
    try {
        var https = require('https');
        var resp = await new Promise(function (resolve, reject) {
            var body = 'secret=' + encodeURIComponent(secretKey) + '&response=' + encodeURIComponent(token);
            var req = https.request({
                hostname: 'challenges.cloudflare.com',
                path: '/turnstile/v0/siteverify',
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
            }, function (res) {
                var data = '';
                res.on('data', function (chunk) { data += chunk; });
                res.on('end', function () {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve({ success: false }); }
                });
            });
            req.on('error', function () { resolve({ success: false }); });
            req.write(body);
            req.end();
        });
        return resp.success === true;
    } catch (e) {
        return false;
    }
}

// ── Get client IP ──
function getIP(req) {
    return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

// ── Main handler ──
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    var ip = getIP(req);

    // Rate limit check
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Demasiadas solicitudes. Intente de nuevo en 15 minutos.' });
    }

    var body = req.body || {};

    // ── Honeypot check ──
    if (body.website && body.website.trim() !== '') {
        // Bot detected — silently succeed to not tip off the bot
        console.log('[SECURITY] Honeypot triggered by IP:', ip);
        return res.status(200).json({ success: true, message: 'Mensaje enviado con éxito.' });
    }

    // ── Turnstile verification ──
    var turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
    var turnstileToken = body.turnstileToken || '';
    if (turnstileSecret && turnstileToken) {
        var verified = await verifyTurnstile(turnstileToken, turnstileSecret);
        if (!verified) {
            return res.status(400).json({ error: 'Verificación de seguridad fallida. Recargue la página e intente de nuevo.' });
        }
    }

    // ── Extract & sanitize fields ──
    var nombre = safeStr(body.nombre || body.name, 100);
    var email = safeStr(body.email, 150);
    var telefono = safeStr(body.telefono || body.phone, 20);
    var asunto = safeStr(body.asunto || body.subject, 200);
    var mensaje = safeStr(body.mensaje || body.message, 2000);

    // ── Server-side validation ──
    var errors = [];
    if (!nombre || nombre.length < 3) errors.push({ field: 'name', message: 'Nombre debe tener al menos 3 caracteres.' });
    if (!email || !validEmail(email)) errors.push({ field: 'email', message: 'Correo electrónico inválido.' });
    if (!asunto || asunto.length < 3) errors.push({ field: 'subject', message: 'Asunto debe tener al menos 3 caracteres.' });
    if (!mensaje || mensaje.length < 10) errors.push({ field: 'message', message: 'Mensaje debe tener al menos 10 caracteres.' });

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Datos inválidos', errors: errors });
    }

    // ── Store in database ──
    try {
        if (pool) {
            await pool.query(
                `INSERT INTO contactos (nombre, email, telefono, asunto, mensaje, ip_origen, pagina)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [nombre, email, telefono, asunto, mensaje, ip, body.page || '']
            );
        }
    } catch (dbErr) {
        console.error('[CONTACTO] DB error:', dbErr.message);
        // Continue — don't fail the user if DB insert fails
    }

    console.log('[CONTACTO] New message from:', nombre, '<' + email + '> IP:', ip);

    return res.status(200).json({ success: true, message: '¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.' });
};
