const { Pool } = require('pg');

console.log('Probando conexión con URL externa...');

// Esta es la URL completa y correcta para conectar desde tu computadora
const urlExterna = "postgresql://colegio_db_qeg2_user:xIu35JMNX84tEwX9gl7347kMEsynOW1l@dpg-d1pbe7ruibrs73djnukg-a.oregon-postgres.render.com/colegio_db_qeg2";

const pool = new Pool({
    connectionString: urlExterna,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('ERROR AL INTENTAR CONECTAR:', err.stack);
        return;
    }
    console.log('¡CONEXIÓN EXITOSA A LA BASE DE DATOS!');
    client.release();
});