// server.js (REEMPLAZAR COMPLETO)
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Build connection string:
// Prefer DATABASE_URL (Render). If no DATABASE_URL, build from env vars for docker-compose.
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const host = process.env.DB_HOST || 'postgres-db';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.POSTGRES_USER || process.env.DB_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres';
  const database = process.env.POSTGRES_DB || process.env.DB_NAME || 'crud_db';
  connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  console.log('Using constructed connection string for Postgres:', connectionString);
} else {
  console.log('Using DATABASE_URL from env');
}

const pool = new Pool({ connectionString });

// Retry helper: intenta conectarse varias veces antes de fallar
async function waitForDb(maxAttempts = 20, delayMs = 1500) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      await pool.query('SELECT 1');
      console.log('Conexión a la BD exitosa (intento', attempt + ')');
      return;
    } catch (err) {
      console.log(`BD no disponible (intento ${attempt}/${maxAttempts}). Error: ${err.code || err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a la base de datos después de varios intentos');
}

// Rutas CRUD
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { nombre, correo } = req.body;
    const result = await pool.query(
      'INSERT INTO users (nombre, correo) VALUES ($1, $2) RETURNING *',
      [nombre, correo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo } = req.body;
    const result = await pool.query(
      'UPDATE users SET nombre=$1, correo=$2 WHERE id=$3 RETURNING *',
      [nombre, correo, id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicialización: esperar BD, crear tabla y arrancar servidor
(async () => {
  try {
    console.log('Esperando conexión a la base de datos...');
    await waitForDb(30, 2000); // intenta 30 veces, 2s entre intentos (hasta ~60s)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nombre TEXT,
        correo TEXT
      )
    `);
    console.log('Tabla users lista');

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('Fallo al inicializar la aplicación:', err);
    process.exit(1);
  }
})();
