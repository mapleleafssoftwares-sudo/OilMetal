import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Plus, X, Check, FileText, Link as LinkIcon } from 'lucide-react';
import { api } from '../services/api';
import { Producto, Certificado } from '../types';

interface Categoria {
  id: string;
  nombre: string;
}

export default function MapeoPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Búsquedas
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchDesc, setSearchDesc] = useState('');

  // Filtros
  const [categoriaFilter, setCategoriaFilter] = useState('Todas');
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

  // Modal Agregar Producto
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLote, setNewLote] = useState('');
  const [newCategoria, setNewCategoria] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Certificados del Producto
  const [certModal, setCertModal] = useState<{ productoId: string; productoNombre: string } | null>(null);
  const [certSearch, setCertSearch] = useState('');
  const [addingCert, setAddingCert] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, certRes, catRes] = await Promise.all([
        api.get('/productos', { params: { search: searchCodigo, categoria: categoriaFilter } }),
        api.get('/certificados'),
        api.get('/categorias'),
      ]);
      setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCertificados(Array.isArray(certRes.data) ? certRes.data : []);
      setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setProductos([]);
      setCertificados([]);
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [searchCodigo, categoriaFilter]);

  const addCertificado = async (productoId: string, certId: string) => {
    setAddingCert(true);
    try {
      await api.post(`/productos/${productoId}/certificados/${certId}`);
      const cert = certificados.find(c => c.id === certId);
      if (cert) {
        setProductos(prev => prev.map(p =>
          p.id === productoId ? { ...p, certificados: [...p.certificados, cert] } : p
        ));
      }
    } catch {
      alert('Error al asignar certificado');
    } finally {
      setAddingCert(false);
    }
  };

  const removeCertificado = async (productoId: string, certId: string) => {
    try {
      await api.delete(`/productos/${productoId}/certificados/${certId}`);
      setProductos(prev => prev.map(p =>
        p.id === productoId ? { ...p, certificados: p.certificados.filter(c => c.id !== certId) } : p
      ));
    } catch {
      alert('Error al quitar certificado');
    }
  };

  const assignCategoria = async (productoId: string, categoria: string) => {
    try {
      await api.put(`/productos/${productoId}/categoria`, null, { params: { categoria } });
      setProductos(prev => prev.map(p => p.id === productoId ? { ...p, categoria } : p));
    } catch {
      alert('Error al asignar categoría');
    }
  };

  const handleAddProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;
    setSaving(true);
    try {
      await api.post('/productos', {
        nombre: newNombre.trim(),
        descripcion: newDesc.trim() || null,
        partida_lote: newLote.trim() || null,
        categoria: newCategoria || 'Otros',
      });
      setShowAddModal(false);
      setNewNombre(''); setNewDesc(''); setNewLote(''); setNewCategoria('');
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al crear producto');
    } finally {
      setSaving(false);
    }
  };

  // Filtro de descripción en cliente (no requiere llamada al backend)
  const filteredProductos = useMemo(() => {
    let list = productos;
    if (searchDesc.trim()) {
      const q = searchDesc.trim().toUpperCase();
      list = list.filter(p => (p.descripcion || '').toUpperCase().includes(q));
    }
    if (showOnlyUnmapped) list = list.filter(p => (p.certificados ?? []).length === 0);
    return list;
  }, [productos, searchDesc, showOnlyUnmapped]);

  // Datos para el modal de certificados
  const currentProducto = certModal ? productos.find(p => p.id === certModal.productoId) : null;
  const assignedCertIds = currentProducto ? (currentProducto.certificados ?? []).map(c => c.id) : [];
  const availableCerts = certificados.filter(c =>
    !assignedCertIds.includes(c.id) &&
    c.nombre.toLowerCase().includes(certSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50 space-y-3">

        {/* Fila 1: Buscadores + botón Agregar */}
        <div className="flex items-center gap-3">
          {/* Buscador código — izquierda */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código..."
              value={searchCodigo}
              onChange={e => setSearchCodigo(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Buscador descripción */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descripción..."
              value={searchDesc}
              onChange={e => setSearchDesc(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Botón Agregar — derecha */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Agregar Producto
          </button>
        </div>

        {/* Fila 2: Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowOnlyUnmapped(!showOnlyUnmapped)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              showOnlyUnmapped
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {showOnlyUnmapped ? 'Sin certificado asignado ✕' : 'Sin certificado asignado'}
          </button>

          <select
            value={categoriaFilter}
            onChange={e => setCategoriaFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
          >
            <option value="Todas">Todas las Categorías</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
            ))}
          </select>

          {/* Contador de resultados */}
          <span className="text-xs text-slate-400 ml-1">
            {filteredProductos.length} resultado{filteredProductos.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Tabla ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10 outline outline-1 outline-slate-200">
            <tr className="text-slate-500 font-semibold text-xs uppercase tracking-wide">
              <th className="px-5 py-3.5">Código</th>
              <th className="px-5 py-3.5">Descripción</th>
              <th className="px-5 py-3.5 w-48">Categoría</th>
              <th className="px-5 py-3.5">Partida / Lote</th>
              <th className="px-5 py-3.5 w-64">Certificado Asignado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400">Cargando inventario...</td></tr>
            ) : filteredProductos.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400">No se encontraron productos.</td></tr>
            ) : filteredProductos.map(producto => (
              <tr key={producto.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-5 py-3 font-bold text-slate-800 whitespace-nowrap">{producto.nombre}</td>
                <td className="px-5 py-3 text-slate-600 max-w-[240px] truncate" title={producto.descripcion}>
                  {producto.descripcion || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  <select
                    value={producto.categoria || 'Otros'}
                    onChange={e => assignCategoria(producto.id, e.target.value)}
                    className="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 cursor-pointer transition-all appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.4rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.2em 1.2em',
                      paddingRight: '2rem'
                    }}
                  >
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                  {producto.partida_lote || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => { setCertModal({ productoId: producto.id, productoNombre: producto.nombre }); setCertSearch(''); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border whitespace-nowrap ${
                      (producto.certificados ?? []).length > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-rose-50/50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    {(producto.certificados ?? []).length > 0
                      ? `Ver certificados (${(producto.certificados ?? []).length})`
                      : 'Sin certificado'
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Agregar Producto ──────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Agregar Producto</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Ingresa los datos del nuevo ítem del inventario</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddProducto} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Código <span className="text-rose-500">*</span></label>
                  <input autoFocus type="text" value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Ej: AC0200BCI1R305" required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                  <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción del producto"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Partida / Lote</label>
                  <input type="text" value={newLote} onChange={e => setNewLote(e.target.value)} placeholder="Número de partida o lote"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Categoría</label>
                  <select value={newCategoria} onChange={e => setNewCategoria(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={!newNombre.trim() || saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm">
                    {saving
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Check className="h-4 w-4" />}
                    {saving ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Certificados del Producto ─────────────────── */}
      {certModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCertModal(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl">
            <div className="p-6">

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">Certificados Asignados</h3>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs" title={certModal.productoNombre}>
                    {certModal.productoNombre}
                  </p>
                </div>
                <button onClick={() => setCertModal(null)} className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Lista de certificados asignados */}
              <div className="mb-5 space-y-2 max-h-52 overflow-y-auto pr-1">
                {currentProducto?.certificados.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-6">Sin certificados asignados</p>
                ) : currentProducto?.certificados.map(cert => (
                  <div key={cert.id} className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-800 truncate" title={cert.nombre}>
                      {cert.nombre}
                    </span>
                    {cert.archivo_url && (
                      <a href={cert.archivo_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        title="Ver PDF">
                        <LinkIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => removeCertificado(certModal.productoId, cert.id)}
                      className="flex-shrink-0 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Quitar certificado"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Agregar certificado */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Agregar certificado</p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={certSearch}
                    onChange={e => setCertSearch(e.target.value)}
                    placeholder="Buscar certificado..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {availableCerts.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">
                      {certSearch ? 'Sin resultados' : 'Todos los certificados ya están asignados'}
                    </p>
                  ) : availableCerts.map(cert => (
                    <button
                      key={cert.id}
                      onClick={() => addCertificado(certModal.productoId, cert.id)}
                      disabled={addingCert}
                      className="w-full flex items-center gap-2 p-2.5 text-left bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-700 truncate">{cert.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
