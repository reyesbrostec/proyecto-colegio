require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const setupQueries = `
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

  INSERT INTO noticias (titulo, contenido) VALUES 
  ('El Colegio Gana Competencia de Robótica', 'El equipo de robótica ''Los Constructores'' obtuvo el primer lugar en la competencia nacional...'),
  ('Inscripciones Abiertas para el Próximo Año Escolar', 'A partir del 1 de agosto se abren las inscripciones para el ciclo 2026-2027...'),
  ('Exitosa Jornada Deportiva Familiar', 'Con gran participación de padres y alumnos, se llevó a cabo la jornada deportiva anual...');
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
    console.log('✅ ¡Tablas y datos iniciales creados exitosamente!');
    
    const adminEmail = 'rybr0ss@colegio.com';
    const adminPassword = 'reyesbrostec';
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(adminPassword, salt);

    await client.query(
        `INSERT INTO usuarios (email, password_hash, nombre_completo, username, rol) 
         VALUES ($1, $2, $3, $4, 'admin') 
         ON CONFLICT (email) 
         DO UPDATE SET password_hash = $2, nombre_completo = $3, rol = 'admin';`,
        [adminEmail, password_hash, 'Administrador Principal', 'admin_user']
    );
    console.log(`✅ ¡Usuario administrador "${adminEmail}" creado/actualizado exitosamente!`);

  } catch (err) {
    console.error('❌ Error durante la preparación de la base de datos:', err);
  } finally {
    client.release();
    pool.end();
    console.log('Script finalizado. Conexión cerrada.');
  }
}

setupDatabase();
