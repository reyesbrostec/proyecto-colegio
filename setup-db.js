﻿require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const setupQueries = `
  DROP TABLE IF EXISTS notas;
  DROP TABLE IF EXISTS noticias;
  DROP TABLE IF EXISTS usuarios;

  CREATE TABLE noticias (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      contenido TEXT,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE usuarios (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nombre_completo VARCHAR(255),
      username VARCHAR(100) UNIQUE,
      edad INT,
      rol VARCHAR(50) DEFAULT 'estudiante' NOT NULL,
      creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE notas (
    id SERIAL PRIMARY KEY,
    estudiante_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    materia VARCHAR(100) NOT NULL,
    parcial1 NUMERIC(4, 2),
    parcial2 NUMERIC(4, 2),
    examen_final NUMERIC(4, 2),
    nota_final NUMERIC(4, 2),
    editado_por VARCHAR(255),
    fecha_edicion TIMESTAMP WITH TIME ZONE
  );
`;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function setupDatabase() {
    console.log('Ejecutando script de preparación...');
    const client = await pool.connect();
    try {
        await client.query(setupQueries);
        console.log('✅ ¡Tablas base creadas exitosamente!');

        // --- Crear Usuario Administrador ---
        const adminEmail = 'rybr0ss@colegio.com';
        const adminPassword = 'reyesbrostec';
        let salt = await bcrypt.genSalt(10);
        let password_hash = await bcrypt.hash(adminPassword, salt);
        await client.query(
            `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol) VALUES ($1, $2, $3, 'admin_user', 'admin')`,
            [adminEmail, password_hash, 'Administrador Principal']
        );
        console.log('✅ ¡Usuario administrador creado!');

        // --- Crear Usuario Docente ---
        const docenteEmail = 'docente@colegio.com';
        const docentePassword = 'profesor123';
        salt = await bcrypt.genSalt(10);
        password_hash = await bcrypt.hash(docentePassword, salt);
        await client.query(
            `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol) VALUES ($1, $2, $3, 'profe_ejemplo', 'docente')`,
            [docenteEmail, password_hash, 'Profesor Ejemplo',]
        );
        console.log('✅ ¡Usuario docente creado!');

        // --- Crear Estudiantes y Notas Simuladas ---
        const estudiantes = [];
        for (let i = 1; i <= 15; i++) {
            const cedula = `172000000${i}`;
            const estudiante = {
                email: `${cedula}@colegio.com`,
                password: cedula,
                nombre_completo: `Estudiante Apellido ${i}`,
                username: `estudiante${i}`,
                rol: 'estudiante'
            };
            salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(estudiante.password, salt);

            const res = await client.query(
                `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [estudiante.email, password_hash, estudiante.nombre_completo, estudiante.username, estudiante.rol]
            );
            const estudianteId = res.rows[0].id;

            // Crear notas para cada estudiante
            const materias = ['Matemáticas', 'Lenguaje', 'Ciencias Naturales', 'Estudios Sociales', 'Inglés'];
            for (const materia of materias) {
                const p1 = (Math.random() * 5 + 5).toFixed(2); // Nota entre 5 y 10
                const p2 = (Math.random() * 5 + 5).toFixed(2);
                const ef = (Math.random() * 5 + 5).toFixed(2);
                const nf = ((parseFloat(p1) + parseFloat(p2) + parseFloat(ef)) / 3).toFixed(2);
                await client.query(
                    `INSERT INTO notas (estudiante_id, materia, parcial1, parcial2, examen_final, nota_final) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [estudianteId, materia, p1, p2, ef, nf]
                );
            }
        }
        console.log(`✅ ¡${15} estudiantes y sus notas simuladas han sido creados!`);

    } catch (err) {
        console.error('❌ Error durante la preparación de la base de datos:', err);
    } finally {
        client.release();
        pool.end();
        console.log('Script finalizado.');
    }
}

setupDatabase();
