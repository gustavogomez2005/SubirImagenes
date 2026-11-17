import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000';

export default function App() {
  const [nombre, setNombre] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [productos, setProductos] = useState([]);
  const [editandoId, setEditandoId] = useState(null); // null = modo crear, ID = modo editar
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    obtenerProductos();
  }, []);

  const obtenerProductos = async () => {
    const res = await fetch(`${API_URL}/api/productos`);
    const data = await res.json();
    setProductos(data);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivo(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setArchivo(null);
    setPreview(null);
    setEditandoId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cargar datos de la tarjeta en el formulario para editar
  const iniciarEdicion = (producto) => {
    setEditandoId(producto.id);
    setNombre(producto.nombre);
    setArchivo(null);
    setPreview(`${API_URL}${producto.imagen_url}`); // Mostramos la imagen actual
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre) return alert('El nombre es obligatorio');
    if (!editandoId && !archivo) return alert('Selecciona una imagen para el nuevo producto');

    const formData = new FormData();
    formData.append('nombre', nombre);
    if (archivo) {
      formData.append('imagen', archivo); // Solo se adjunta si el usuario eligió una nueva
    }

    const url = editandoId 
      ? `${API_URL}/api/productos/${editandoId}` 
      : `${API_URL}/api/productos`;
      
    const method = editandoId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: formData });

      if (res.ok) {
        limpiarFormulario();
        obtenerProductos();
      }
    } catch (error) {
      console.error('Error guardando:', error);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este producto y su imagen?')) return;

    try {
      const res = await fetch(`${API_URL}/api/productos/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (editandoId === id) limpiarFormulario();
        obtenerProductos();
      }
    } catch (error) {
      console.error('Error eliminando:', error);
    }
  };

  return (
    <div className="contenedor">
      <h2>{editandoId ? `Editando Producto #${editandoId}` : 'Subir Producto con Imagen'}</h2>

      <form onSubmit={handleSubmit} className="formulario">
        <input
          type="text"
          placeholder="Nombre del producto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          required={!editandoId} // Solo obligatorio al crear
        />

        {preview && (
          <div className="preview-box">
            <p>{archivo ? 'Nueva imagen:' : 'Imagen actual:'}</p>
            <img src={preview} alt="Vista previa" />
          </div>
        )}

        <div className="form-acciones">
          <button type="submit">
            {editandoId ? 'Actualizar Cambios' : 'Guardar Producto'}
          </button>
          
          {editandoId && (
            <button type="button" className="btn-cancelar" onClick={limpiarFormulario}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <hr />

      <h2>Galería desde MySQL</h2>
      <div className="galeria">
        {productos.map((prod) => (
          <div key={prod.id} className="tarjeta">
            <img src={`${API_URL}${prod.ruta}`} alt={prod.nombre_archivo} />
            <h3>{prod.nombre_archivo}</h3>
            <div className="tarjeta-acciones">
              <button className="btn-editar" onClick={() => iniciarEdicion(prod)}>
                Editar
              </button>
              <button className="btn-eliminar" onClick={() => handleEliminar(prod.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}