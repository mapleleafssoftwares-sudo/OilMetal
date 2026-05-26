import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, FolderOpen, Search, X, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

interface Certificado {
  id: string;
  nombre: string;
  archivo_url: string;
  colada?: string;
  bucket?: string;
  created_at: string;
}

const SECCIONES = [
  { key: 'certificados', label: 'Certificaciones',   color: 'purple'  },
  { key: 'ordenes',      label: 'Ordenes de Compra', color: 'blue'    },
  { key: 'remitos',      label: 'Remitos y Pedidos', color: 'emerald' },
] as const;

type SeccionKey = typeof SECCIONES[number]['key'];

const accentClasses: Record<string, { tab: string; btn: string; icon: string; empty: string }> = {
  purple:  { tab: 'bg-white text-purple-700 shadow-sm', btn: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20', icon: 'text-purple-600 bg-purple-50', empty: 'text-purple-300' },
  blue:    { tab: 'bg-white text-blue-700 shadow-sm',   btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',       icon: 'text-blue-600 bg-blue-50',     empty: 'text-blue-300'   },
  emerald: { tab: 'bg-white text-emerald-700 shadow-sm',btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',icon: 'text-emerald-600 bg-emerald-50',empty: 'text-emerald-300'},
};

const ROL_TO_SECCIONES: Partial<Record<string, SeccionKey[]>> = {
  vendedor: ['ordenes'],
  deposito: ['remitos'],
  calidad:  ['certificados'],
};

export default function CertificadosPage() {
  const { user } = useAuthStore();
  const seccionesVisibles = SECCIONES.filter(s => {
    const allowed = ROL_TO_SECCIONES[user?.rol ?? ''];
    return !allowed || allowed.includes(s.key);
  });
  const [activeSection, setActiveSection] = useState<SeccionKey>(seccionesVisibles[0]?.key ?? 'certificados');
  const [items, setItems] = useState<Certificado[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const seccion = SECCIONES.find(s => s.key === activeSection)!;
  const ac = accentClasses[seccion.color];
  const filteredItems = items.filter(item => 
    item.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/certificados/by-bucket/list', { params: { seccion: seccion.key } });
      setItems(res.data);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [activeSection]);

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmas eliminar este archivo?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/certificados/${seccion.key}/${id}`);
      setItems(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const existingNames = new Set(items.map(i => i.nombre.trim().toLowerCase()));
  const isDuplicate = (f: File) => existingNames.has(f.name.replace(/\.pdf$/i, '').trim().toLowerCase());
  const duplicateFiles = uploadFiles.filter(isDuplicate);
  const hasDuplicates = duplicateFiles.length > 0;

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadFiles([]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0 || hasDuplicates) return;
    setUploading(true);
    const fd = new FormData();
    uploadFiles.forEach(f => fd.append('files', f));
    fd.append('seccion', seccion.key);
    try {
      const res = await api.post('/certificados/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const errores: string[] = res.data?.errores ?? [];
      if (errores.length > 0) alert('Algunos archivos fallaron:\n' + errores.join('\n'));
      closeUploadModal();
      fetchItems();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative">

      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        {/* Sub-tabs: scroll horizontal en móvil */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none flex-shrink-0">
          {seccionesVisibles.map(s => {
            const a = accentClasses[s.color];
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive ? a.tab : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className={`flex items-center justify-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-md transition-all hover:-translate-y-0.5 sm:ml-auto ${ac.btn}`}
        >
          <Upload className="h-4 w-4" /> Subir Archivo
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400">Cargando...</p>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar archivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <FolderOpen className={`h-14 w-14 ${ac.empty}`} />
              <p className="text-slate-400 text-sm">{searchQuery ? 'No hay archivos que coincidan con tu búsqueda.' : 'No hay archivos en esta seccion.'}</p>
            </div>
          ) : (
            <ul className="space-y-2 overflow-y-auto">
              {filteredItems.map(item => (
                <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${ac.icon}`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.nombre}</p>
                    {item.colada && <p className="text-xs text-slate-500 truncate">Colada: {item.colada}</p>}
                    <p className="text-xs text-slate-400">Cargado: {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={item.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                    >
                      Ver
                    </a>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={!!deletingId}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {deletingId === item.id
                        ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin inline-block" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeUploadModal} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Subir archivo</h3>
            <p className="text-sm text-slate-500 mb-6">Seccion: <span className="font-semibold">{seccion.label}</span></p>
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 transition-colors active:bg-slate-50"
                onClick={() => fileRef.current?.click()}
              >
                {uploadFiles.length > 0 ? (
                  <ul className="text-left space-y-1 max-h-36 overflow-y-auto">
                    {uploadFiles.map((f, i) => {
                      const dup = isDuplicate(f);
                      return (
                        <li key={i} className={`text-sm truncate flex items-center gap-2 ${dup ? 'text-rose-600 font-medium' : 'text-slate-700'}`}>
                          {dup
                            ? <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-500" />
                            : <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                          {f.name}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Toca para seleccionar uno o más archivos PDF</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={e => setUploadFiles(Array.from(e.target.files ?? []))}
                />
              </div>
              {hasDuplicates && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 leading-snug">
                    {duplicateFiles.length === 1
                      ? `"${duplicateFiles[0].name.replace(/\.pdf$/i, '')}" ya existe en esta sección. Eliminá el archivo duplicado para continuar.`
                      : `${duplicateFiles.length} archivos ya existen en esta sección: ${duplicateFiles.map(f => f.name.replace(/\.pdf$/i, '')).join(', ')}. Eliminá los duplicados para continuar.`
                    }
                  </p>
                </div>
              )}
              {!hasDuplicates && uploadFiles.length > 1 && (
                <p className="text-xs text-slate-500 text-center">{uploadFiles.length} archivos seleccionados</p>
              )}
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeUploadModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={uploadFiles.length === 0 || uploading || hasDuplicates}
                  className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${ac.btn}`}>
                  {uploading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Subiendo...</>
                    : uploadFiles.length > 1 ? `Subir ${uploadFiles.length} archivos` : 'Confirmar'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
