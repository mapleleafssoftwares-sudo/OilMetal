import { useState, useEffect } from 'react';
import { FolderOpen, Folder, Plus, Trash2, ChevronRight, FileText, X, Link, Building2, Search } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

interface Empresa { id: string; nombre: string; }
interface Orden { id: string; numero_orden: string; empresa_id: string; empresa?: { id: string; nombre: string }; created_at: string; }
interface Documento { id: string; nombre: string; archivo_url: string; __tipo: string; __link_id: string; __link_created_at?: string; }
interface RepoDoc { id: string; nombre: string; archivo_url: string; }

const TIPO_LABEL: Record<string, string> = {
  certificado: 'Certificaciones',
  orden_compra: 'Ordenes de Compra',
  remito: 'Remitos y Pedidos',
};
const TIPO_COLOR: Record<string, string> = {
  certificado: 'purple',
  orden_compra: 'blue',
  remito: 'emerald',
};
const TIPO_SECCION: Record<string, string> = {
  certificado: 'certificados',
  orden_compra: 'ordenes',
  remito: 'remitos',
};
const COLORS: Record<string, { bg: string; text: string; border: string; btn: string }> = {
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', btn: 'bg-purple-600 hover:bg-purple-700' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',btn: 'bg-emerald-600 hover:bg-emerald-700' },
};

const ROL_TO_TIPO: Partial<Record<string, string>> = {
  vendedor: 'orden_compra',
  deposito: 'remito',
  calidad:  'certificado',
};

export default function GestionDocumentosPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.rol === 'admin';
  const rolTipo = user ? (ROL_TO_TIPO[user.rol] ?? null) : null;
  const canEditTipo = (tipo: string) => isAdmin || rolTipo === tipo;
  const canCreateFolder = isAdmin || user?.rol === 'vendedor';
  const canDeleteFolder = isAdmin;
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [searchOrdenes, setSearchOrdenes] = useState('');
  const [searchDocs, setSearchDocs] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  // Carpeta abierta
  const [openOrden, setOpenOrden] = useState<Orden | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Modal nueva OC
  const [showNewOrden, setShowNewOrden] = useState(false);
  const [newNumero, setNewNumero] = useState('');   // sólo la parte numérica
  const [newEmpresaId, setNewEmpresaId] = useState('');
  const [creating, setCreating] = useState(false);

  // Modal vincular documento
  const [showLink, setShowLink] = useState(false);
  const [linkTipo, setLinkTipo] = useState<string>('certificado');
  const [repoDocs, setRepoDocs] = useState<RepoDoc[]>([]);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [linking, setLinking] = useState(false);
  const [searchRepo, setSearchRepo] = useState('');
  const [searchEmpresaOC, setSearchEmpresaOC] = useState('');
  const [showEmpresaList, setShowEmpresaList] = useState(false);

  const fetchOrdenes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/empresas/ordenes');
      setOrdenes(Array.isArray(res.data) ? res.data : []);
    } catch { setOrdenes([]); } finally { setLoading(false); }
  };

  const fetchEmpresas = async () => {
    try {
      const res = await api.get('/empresas');
      setEmpresas(Array.isArray(res.data) ? res.data : []);
    } catch { setEmpresas([]); }
  };

  useEffect(() => { fetchOrdenes(); fetchEmpresas(); }, []);

  const openFolder = async (orden: Orden) => {
    setOpenOrden(orden);
    setLoadingDocs(true);
    try {
      const res = await api.get(`/empresas/ordenes/${orden.id}/documentos`);
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch { setDocs([]); } finally { setLoadingDocs(false); }
  };

  const docsByTipo = (tipo: string) => docs.filter(d => d.__tipo === tipo);
  const filteredOrdenes = ordenes.filter(o =>
    o.numero_orden.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
    o.empresa?.nombre.toLowerCase().includes(searchOrdenes.toLowerCase())
  );
  const filteredDocs = (tipo: string) => docsByTipo(tipo).filter(d =>
    d.nombre.toLowerCase().includes(searchDocs.toLowerCase())
  );

  const handleCreateOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumero.trim() || !newEmpresaId) return;
    setCreating(true);
    const numeroCompleto = `OC-${newNumero.trim()}`;
    try {
      await api.post('/empresas/ordenes', { numero_orden: numeroCompleto, empresa_id: newEmpresaId });
      setShowNewOrden(false); setNewNumero(''); setNewEmpresaId(''); setSearchEmpresaOC(''); setShowEmpresaList(false);
      fetchOrdenes();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al crear orden');
    } finally { setCreating(false); }
  };

  const handleDeleteOrden = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Eliminar esta carpeta y desvincular todos sus documentos?')) return;
    await api.delete(`/empresas/ordenes/${id}`);
    if (openOrden?.id === id) setOpenOrden(null);
    fetchOrdenes();
  };

  const handleUnlink = async (linkId: string) => {
    if (!openOrden) return;
    if (!confirm('Desvincular este documento?')) return;
    await api.delete(`/empresas/ordenes/${openOrden.id}/documentos/${linkId}`);
    setDocs(prev => prev.filter(d => d.__link_id !== linkId));
  };

  const openLinkModal = async (tipo: string) => {
    setLinkTipo(tipo);
    setShowLink(true);
    setSearchRepo('');
    setLoadingRepo(true);
    try {
      const seccion = TIPO_SECCION[tipo];
      const res = await api.get('/certificados/by-bucket/list', { params: { seccion } });
      setRepoDocs(Array.isArray(res.data) ? res.data : []);
    } catch { setRepoDocs([]); } finally { setLoadingRepo(false); }
  };

  const handleLink = async (docId: string) => {
    if (!openOrden) return;
    setLinking(true);
    try {
      await api.post(`/empresas/ordenes/${openOrden.id}/documentos`, { tipo: linkTipo, documento_id: docId });
      setShowLink(false);
      const res = await api.get(`/empresas/ordenes/${openOrden.id}/documentos`);
      setDocs(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al vincular');
    } finally { setLinking(false); }
  };

  // ── Vista: Detalle de carpeta ───────────────────────────────────────────────
  if (openOrden) {
    return (
      <div className="h-full flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setOpenOrden(null)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors">
            <Folder className="h-4 w-4" /> Gestión de Documentos
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-800">{openOrden.numero_orden}</span>
          {openOrden.empresa && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{openOrden.empresa.nombre}</span>}
        </div>

        {/* Buscador de documentos */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar documento en esta carpeta..."
            value={searchDocs}
            onChange={(e) => setSearchDocs(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchDocs && (
            <button
              onClick={() => setSearchDocs('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loadingDocs ? (
          <p className="text-slate-400 text-center py-10">Cargando...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {(['certificado', 'orden_compra', 'remito'] as const).map(tipo => {
              const color = TIPO_COLOR[tipo];
              const c = COLORS[color];
              const items = filteredDocs(tipo);
              return (
                <div key={tipo} className={`border rounded-2xl p-5 ${c.border} ${c.bg}`}>
                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <h3 className={`font-bold text-sm ${c.text}`}>{TIPO_LABEL[tipo]}</h3>
                    {canEditTipo(tipo) && (
                    <button
                      onClick={() => openLinkModal(tipo)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm transition-all ${c.btn}`}
                    >
                      <Link className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Vincular documento</span><span className="sm:hidden">Vincular</span>
                    </button>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className={`text-xs ${c.text} opacity-60`}>Sin documentos vinculados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map(doc => (
                        <li key={doc.__link_id} className="flex flex-col gap-2 bg-white rounded-xl px-4 py-3 border border-white shadow-sm">
                          <div className="flex items-center gap-3">
                            <FileText className={`h-4 w-4 flex-shrink-0 ${c.text}`} />
                            <span className="flex-1 text-sm text-slate-800 font-medium truncate">{doc.nombre}</span>
                            <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition-colors">
                              Ver
                            </a>
                            {canEditTipo(tipo) && (
                            <button onClick={() => handleUnlink(doc.__link_id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 pl-7">Última revisión: {doc.__link_created_at ? new Date(doc.__link_created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Vincular documento */}
        {showLink && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowLink(false)} />
            <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Vincular documento</h3>
                <p className="text-sm text-slate-500 mt-0.5">Seccion: <span className="font-semibold">{TIPO_LABEL[linkTipo]}</span></p>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar documento..."
                    value={searchRepo}
                    onChange={e => setSearchRepo(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  {searchRepo && (
                    <button onClick={() => setSearchRepo('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {loadingRepo ? (
                  <p className="text-center text-slate-400 py-8">Cargando repositorio...</p>
                ) : repoDocs.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No hay documentos disponibles.</p>
                ) : (() => {
                  const filtered = repoDocs.filter(d => d.nombre.toLowerCase().includes(searchRepo.toLowerCase()));
                  return filtered.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">Sin resultados para "{searchRepo}".</p>
                  ) : (
                    <ul className="space-y-2">
                      {filtered.map(doc => {
                        const yaVinculado = docs.some(d => d.id === doc.id && d.__tipo === linkTipo);
                        return (
                          <li key={doc.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${yaVinculado ? 'opacity-40 border-slate-100 bg-slate-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'}`}
                            onClick={() => !yaVinculado && !linking && handleLink(doc.id)}>
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="flex-1 text-sm text-slate-800 font-medium truncate">{doc.nombre}</span>
                            {yaVinculado && <span className="text-xs text-slate-400">Ya vinculado</span>}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
              <div className="p-4 border-t border-slate-100">
                <button onClick={() => setShowLink(false)} className="w-full px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista: Directorio de carpetas ──────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-amber-50 rounded-xl flex-shrink-0">
            <FolderOpen className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 truncate">Gestión de Documentos</h2>
            <p className="text-xs text-slate-500">Carpetas por Orden de Compra</p>
          </div>
        </div>
        {canCreateFolder && (
        <button onClick={() => setShowNewOrden(true)}
          className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-500/20 hover:bg-amber-600 hover:-translate-y-0.5 transition-all">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva Orden de Compra</span><span className="sm:hidden">Nueva OC</span>
        </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-10">Cargando...</p>
      ) : (
        <>
          {/* Buscador de carpetas - siempre visible */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar carpeta por número o empresa..."
              value={searchOrdenes}
              onChange={(e) => setSearchOrdenes(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchOrdenes && (
              <button
                onClick={() => setSearchOrdenes('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Resultados */}
          {ordenes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Folder className="h-14 w-14 text-slate-200" />
              <p className="text-slate-400 text-sm">No hay carpetas. Crea una Orden de Compra.</p>
            </div>
          ) : filteredOrdenes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Folder className="h-14 w-14 text-slate-200" />
              <p className="text-slate-400 text-sm">No hay carpetas que coincidan con tu búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrdenes.map(orden => (
                <div key={orden.id} onClick={() => openFolder(orden)}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all active:bg-amber-50">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-8 w-8 text-amber-400 flex-shrink-0 mt-0.5 group-hover:text-amber-500 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{orden.numero_orden}</p>
                      {orden.empresa && (
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <p className="text-xs text-slate-500 truncate">{orden.empresa.nombre}</p>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{new Date(orden.created_at).toLocaleDateString('es-AR')}</p>
                    </div>
                    {canDeleteFolder && (
                    <button onClick={e => handleDeleteOrden(orden.id, e)}
                      className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal: Nueva OC */}
      {showNewOrden && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNewOrden(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nueva Orden de Compra</h3>
            <p className="text-sm text-slate-500 mb-6">Se creara una carpeta con 3 subcarpetas.</p>
            <form onSubmit={handleCreateOrden} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Numero de Orden <span className="text-rose-500">*</span></label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <span className="px-4 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 border-r border-slate-200 select-none">OC-</span>
                  <input
                    autoFocus
                    type="text"
                    value={newNumero}
                    onChange={e => setNewNumero(e.target.value.replace(/[^a-zA-Z0-9\-_/]/g, ''))}
                    placeholder="Ej: 1042 o AB-123/24"
                    required
                    className="flex-1 px-3 py-2.5 bg-transparent text-sm outline-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Se guardará como <span className="font-semibold text-slate-600">OC-{newNumero || '...'}</span></p>
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Empresa <span className="text-rose-500">*</span></label>
                <div className={`flex items-center bg-slate-50 border rounded-xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 ${newEmpresaId ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200'}`}>
                  <Search className="h-4 w-4 text-slate-400 ml-3 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar empresa..."
                    value={searchEmpresaOC}
                    onChange={e => { setSearchEmpresaOC(e.target.value); setNewEmpresaId(''); setShowEmpresaList(true); }}
                    onFocus={() => setShowEmpresaList(true)}
                    onBlur={() => setTimeout(() => setShowEmpresaList(false), 150)}
                    className="flex-1 px-3 py-2.5 bg-transparent text-sm outline-none"
                  />
                  {searchEmpresaOC && (
                    <button type="button" onMouseDown={() => { setSearchEmpresaOC(''); setNewEmpresaId(''); }} className="mr-3 text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showEmpresaList && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {empresas
                      .filter(e => e.nombre.toLowerCase().includes(searchEmpresaOC.toLowerCase()))
                      .map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onMouseDown={() => { setNewEmpresaId(e.id); setSearchEmpresaOC(e.nombre); setShowEmpresaList(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                        >
                          {e.nombre}
                        </button>
                      ))
                    }
                    {empresas.filter(e => e.nombre.toLowerCase().includes(searchEmpresaOC.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-sm text-slate-400">Sin resultados.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewOrden(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={!newNumero.trim() || !newEmpresaId || creating}
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:bg-amber-600 disabled:opacity-50 transition-all text-sm">
                  {creating ? 'Creando...' : 'Crear Carpeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
