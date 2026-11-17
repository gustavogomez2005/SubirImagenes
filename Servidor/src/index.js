import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { unlink } from 'fs/promises';
import { pool } from './database/db.js';
import { upload, uploadDir } from '../uploadMiddleware.js';

const app = express();

app.use(cors());
app.use(express.json());

// Exponer exactamente la misma carpeta donde Multer guarda los archivos
app.use('/uploads', express.static(uploadDir));

// Helper para borrar el archivo físico usando su nombre de archivo
const eliminarArchivoFisico = async (rutaRelativa) => {
  if (!rutaRelativa) return;
  try {
    const nombreArchivo = path.basename(rutaRelativa);
    const rutaCompleta = path.join(uploadDir, nombreArchivo);
    await unlink(rutaCompleta);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al eliminar archivo físico:', err);
    }
  }
};

// 1. CREAR PRODUCTO (Subir imagen y guardar en MySQL)
app.post('/api/productos', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Debes seleccionar una imagen' });
    }

    if (!nombre || nombre.trim() === '') {
      await eliminarArchivoFisico(req.file.filename);
      return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
    }

    const imagenUrl = `/uploads/${req.file.filename}`;

    const [result] = await pool.query(
      'INSERT INTO imagenes (nombre_archivo, ruta) VALUES (?, ?)',
      [nombre.trim(), imagenUrl]
    );

    res.status(201).json({
      id: result.insertId,
      nombre: nombre.trim(),
      ruta: imagenUrl
    });
  } catch (error) {
    if (req.file) await eliminarArchivoFisico(req.file.filename);
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el producto' });
  }
});

// 2. OBTENER TODOS LOS PRODUCTOS
app.get('/api/productos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre_archivo AS nombre, ruta, fecha_subida FROM imagenes ORDER BY fecha_subida DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// 3. ACTUALIZAR PRODUCTO (Nombre y/o Imagen opcional)
app.put('/api/productos/:id', upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  try {
    // 1. Buscar el registro actual
    const [rows] = await pool.query('SELECT * FROM imagenes WHERE id = ?', [id]);
    if (rows.length === 0) {
      if (req.file) await eliminarArchivoFisico(req.file.filename);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const productoActual = rows[0];
    const nuevoNombre = nombre && nombre.trim() !== '' ? nombre.trim() : productoActual.nombre_archivo;
    const nuevaImagenUrl = req.file ? `/uploads/${req.file.filename}` : productoActual.ruta;

    // 2. Actualizar en MySQL primero
    await pool.query(
      'UPDATE imagenes SET nombre_archivo = ?, ruta = ? WHERE id = ?',
      [nuevoNombre, nuevaImagenUrl, id]
    );

    // 3. Si hubo imagen nueva y la BD actualizó bien, eliminamos la imagen anterior
    if (req.file) {
      await eliminarArchivoFisico(productoActual.ruta);
    }

    res.json({
      id: Number(id),
      nombre: nuevoNombre,
      ruta: nuevaImagenUrl
    });
  } catch (error) {
    if (req.file) await eliminarArchivoFisico(req.file.filename);
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// 4. ELIMINAR PRODUCTO
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT ruta FROM imagenes WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const { ruta } = rows[0];

    await pool.query('DELETE FROM imagenes WHERE id = ?', [id]);
    await eliminarArchivoFisico(ruta);

    res.json({ message: 'Producto e imagen eliminados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

// Middleware global para devolver errores de Multer en formato JSON
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'La imagen es demasiado pesada. Máximo 5MB.' });
    }
    return res.status(400).json({ error: `Error al subir archivo: ${err.message}` });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});