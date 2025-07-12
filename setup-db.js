require('dotenv').config();
const { Pool } = require('pg');

const setupQueries = `
  DROP TABLE IF EXISTS noticias;

  CREATE TABLE noticias (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      contenido TEXT
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

console.log('Ejecutando script de preparación...');
pool.query(setupQueries)
    .then(() => {
        console.log('✅ ¡Base de datos preparada exitosamente!');
        pool.end();
    })
    .catch(err => {
        console.error('❌ Error durante la preparación de la base de datos:', err);
        pool.end();
    });