import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Folder, FileText, ExternalLink, LogOut, ChevronRight, Building2, Search, X, Download } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

interface Orden { id: string; numero_orden: string; empresa_id: string; empresa?: { id: string; nombre: string }; created_at: string; }
interface Documento { id: string; nombre: string; archivo_url: string; __tipo: string; __link_id: string; __link_created_at?: string; __observacion?: string; }

const TIPO_LABEL: Record<string, string> = {
  certificado: 'Certificaciones',
  orden_compra: 'Ordenes de Compra',
  remito: 'Remitos y Pedidos',
};
const TIPO_COLOR: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  certificado: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-500' },
  orden_compra: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   icon: 'text-blue-500' },
  remito:       { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' },
};

export default function ConsultorPage() {
  const [ordenes, setOrdenes]       = useState<Orden[]>([]);
  const [searchOrdenes, setSearchOrdenes] = useState('');
  const [searchDocs, setSearchDocs] = useState('');
  const [loading, setLoading]       = useState(true);
  const [openOrden, setOpenOrden]   = useState<Orden | null>(null);
  const [docs, setDocs]             = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const fetchOrdenes = async () => {
      try {
        setLoading(true);
        const res = await api.get('/empresas/ordenes');
        setOrdenes(Array.isArray(res.data) ? res.data : []);
      } catch { setOrdenes([]); }
      finally { setLoading(false); }
    };
    fetchOrdenes();
  }, []);

  const openFolder = async (orden: Orden) => {
    setOpenOrden(orden);
    setLoadingDocs(true);
    try {
      const res = await api.get(`/empresas/ordenes/${orden.id}/documentos`);
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch { setDocs([]); }
    finally { setLoadingDocs(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleExportZip = async () => {
    try {
      setExportingZip(true);
      const res = await api.get('/empresas/repositorio.zip', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'repositorio.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error?.response?.data?.detail || 'No se pudo exportar el repositorio');
    } finally {
      setExportingZip(false);
    }
  };
  const docsByTipo = (tipo: string) => docs.filter(d => d.__tipo === tipo);
  const filteredOrdenes = ordenes.filter(o => 
    o.numero_orden.toLowerCase().includes(searchOrdenes.toLowerCase()) ||
    o.empresa?.nombre.toLowerCase().includes(searchOrdenes.toLowerCase())
  );
  const filteredDocs = (tipo: string) => docsByTipo(tipo).filter(d =>
    d.nombre.toLowerCase().includes(searchDocs.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 shadow-lg safe-area-pt">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="OilMetal" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Portal de Documentos</h1>
              {user?.empresa_id && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <p className="text-xs text-slate-400">{user.nombre || user.email}</p>
                </div>
              )}
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">

        {/* ── Vista detalle de carpeta ── */}
        {openOrden ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setOpenOrden(null)}
                className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors">
                <Folder className="h-4 w-4" /> Mis carpetas
              </button>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-800">{openOrden.numero_orden}</span>
              {openOrden.empresa && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{openOrden.empresa.nombre}</span>
              )}
            </div>

            {/* Buscador de documentos dentro de carpeta */}
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
              <p className="text-center text-slate-400 py-16">Cargando documentos...</p>
            ) : docsByTipo('certificado').length === 0 && docsByTipo('orden_compra').length === 0 && docsByTipo('remito').length === 0 ? (
              <p className="text-center text-slate-400 py-16">Sin documentos en esta carpeta.</p>
            ) : filteredDocs('certificado').length === 0 && filteredDocs('orden_compra').length === 0 && filteredDocs('remito').length === 0 ? (
              <p className="text-center text-slate-400 py-8">No hay documentos que coincidan con tu búsqueda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {(['certificado', 'orden_compra', 'remito'] as const).map(tipo => {
                  const c = TIPO_COLOR[tipo];
                  const items = filteredDocs(tipo);
                  return (
                    <div key={tipo} className={`border rounded-2xl p-5 ${c.border} ${c.bg}`}>
                      <h3 className={`font-bold text-sm mb-4 ${c.text}`}>{TIPO_LABEL[tipo]}</h3>
                      {items.length === 0 ? (
                        <p className={`text-xs ${c.text} opacity-60`}>Sin documentos en esta sección.</p>
                      ) : (
                        <ul className="space-y-2">
                          {items.map(doc => (
                            <li key={doc.__link_id} className="flex flex-col gap-2 bg-white rounded-xl px-4 py-3 border border-white shadow-sm">
                              <div className="flex items-center gap-3">
                                <FileText className={`h-4 w-4 flex-shrink-0 ${c.icon}`} />
                                <span className="flex-1 text-sm text-slate-800 font-medium truncate">{doc.nombre}</span>
                                {doc.archivo_url ? (
                                  <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold transition-colors">
                                    <ExternalLink className="h-3 w-3" /> Ver PDF
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">Sin archivo</span>
                                )}
                              </div>
                              <div className="ml-7 flex flex-col gap-1">
                                <p className="text-xs text-slate-400">Última revisión: {doc.__link_created_at ? new Date(doc.__link_created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</p>
                                {doc.__observacion && (
                                  <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 leading-relaxed">
                                    <span className="font-semibold text-amber-700">Obs: </span>{doc.__observacion}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header de la sección */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <FolderOpen className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900">Mis Carpetas</h2>
                <p className="text-xs text-slate-500">Documentos asignados a tu empresa</p>
              </div>
              <button
                type="button"
                onClick={handleExportZip}
                disabled={exportingZip || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> {exportingZip ? 'Generando ZIP...' : 'Descargar ZIP'}
              </button>
            </div>

            {loading ? (
              <p className="text-center text-slate-400 py-16">Cargando carpetas...</p>
            ) : !user?.empresa_id ? (
              <div className="text-center py-20">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                <p className="font-semibold text-slate-500">Tu cuenta no tiene una empresa asignada.</p>
                <p className="text-sm text-slate-400 mt-1">Contactá con el administrador del sistema.</p>
              </div>
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
                  <div className="text-center py-20">
                    <Folder className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                    <p className="font-semibold text-slate-500">No hay carpetas disponibles.</p>
                    <p className="text-sm text-slate-400 mt-1">El administrador aún no creó carpetas para tu empresa.</p>
                  </div>
                ) : filteredOrdenes.length === 0 ? (
                  <div className="text-center py-20">
                    <Folder className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                    <p className="font-semibold text-slate-500">No hay carpetas que coincidan con tu búsqueda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrdenes.map(orden => (
                    <button key={orden.id} onClick={() => openFolder(orden)}
                      className="group text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all">
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
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(orden.created_at).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-400 transition-colors mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
