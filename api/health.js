// api/health.js — GET /api/health
const { pool } = require('./_lib/db');

module.exports = async function handler(req, res) {
    try {
        const result = await pool.query('SELECT NOW() as ahora, current_database() as db');
        res.json({ status: 'ok', db: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message, code: err.code });
    }
};
