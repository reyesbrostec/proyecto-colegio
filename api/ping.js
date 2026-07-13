// api/ping.js — GET /api/ping (test endpoint)
module.exports = async function handler(req, res) {
    res.json({ pong: true, time: new Date().toISOString() });
};
