// Importar librerías necesarias
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ---------- Configuración de la base de datos ----------

// Soportar dos modos:
// 1) LOCAL (Docker): usa DB_HOST / DB_NAME / DB_USER / DB_PASSWORD
// 2) PRODUCCIÓN (Render): usa DATABASE_URL

let pool;

if (process.env.DATABASE_URL) {
  // Modo Render (usa Internal URL de PostgreSQL)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
  });
  console.log('Usando DATABASE_URL para la conexión a PostgreSQL');
} else {
  // Modo local (Docker Compose)
  pool = new Pool({
    host: process.env.DB_HOST || 'postgres-db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'crud_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });
  console.log('Usando variables locales para la conexión a PostgreSQL');
}

// Crear tabla si no existe (al iniciar)
pool
  .query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      correo TEXT
    )
  `)
  .then(() => console.log('Tabla users lista'))
  .catch((err) => console.error('Error creando tabla users:', err.message));

// ---------- Rutas CRUD ----------

// GET /api/users - Obtener todos los usuarios
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id - Obtener un usuario específico
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en GET /api/users/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Crear nuevo usuario
app.post('/api/users', async (req, res) => {
  try {
    const { nombre, correo } = req.body;

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'nombre y correo son requeridos' });
    }

    const result = await pool.query(
      'INSERT INTO users (nombre, correo) VALUES ($1, $2) RETURNING *',
      [nombre, correo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error en POST /api/users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id - Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo } = req.body;

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'nombre y correo son requeridos' });
    }

    const result = await pool.query(
      'UPDATE users SET nombre = $1, correo = $2 WHERE id = $3 RETURNING *',
      [nombre, correo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error en PUT /api/users/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id - Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // rowCount indica cuántas filas se afectaron
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    console.error('Error en DELETE /api/users/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Iniciar servidor ----------

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
