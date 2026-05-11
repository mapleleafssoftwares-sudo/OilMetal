import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, FolderOpen } from 'lucide-react';
import { api } from '../services/api';

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
  { key: 'remitos',      label: 'Remitos',           color: 'emerald' },
] as const;

type SeccionKey = typeof SECCIONES[number]['key'];

const accentClasses: Record<string, { tab: string; btn: string; icon: string; empty: string }> = {
  purple:  { tab: 'bg-white text-purple-700 shadow-sm', btn: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20', icon: 'text-purple-600 bg-purple-50', empty: 'text-purple-300' },
  blue:    { tab: 'bg-white text-blue-700 shadow-sm',   btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',       icon: 'text-blue-600 bg-blue-50',     empty: 'text-blue-300'   },
  emerald: { tab: 'bg-white text-emerald-700 shadow-sm',btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',icon: 'text-emerald-600 bg-emerald-50',empty: 'text-emerald-300'},
};

export default function CertificadosPage() {
  const [activeSection, setActiveSection] = useState<SeccionKey>('certificados');
  const [items, setItems] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const seccion = SECCIONES.find(s => s.key === activeSection)!;
  const ac = accentClasses[seccion.color];

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

  const closeUploadModal = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadDesc('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    if (!uploadDesc.trim()) {
      alert('Por favor ingresa un nombre para el archivo');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('seccion', seccion.key);
    fd.append('nombre', uploadDesc.trim());
    try {
      await api.post('/certificados/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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
      <div className="flex items-center justify-between mb-4">
        {/* Sub-tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {SECCIONES.map(s => {
            const a = accentClasses[s.color];
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-md transition-all hover:-translate-y-0.5 ${ac.btn}`}
        >
          <Upload className="h-4 w-4" /> Subir Archivo
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400">Cargando...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <FolderOpen className={`h-14 w-14 ${ac.empty}`} />
          <p className="text-slate-400 text-sm">No hay archivos en esta seccion.</p>
        </div>
      ) : (
        <ul className="space-y-2 overflow-y-auto">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
              <div className={`p-2 rounded-lg ${ac.icon}`}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{item.nombre}</p>
                {item.colada && <p className="text-xs text-slate-500 truncate">Colada: {item.colada}</p>}
                <p className="text-xs text-slate-400">Cargado: {new Date(item.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={item.archivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
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

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeUploadModal} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Subir archivo</h3>
            <p className="text-sm text-slate-500 mb-6">Seccion: <span className="font-semibold">{seccion.label}</span></p>
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploadFile ? (
                  <p className="text-sm font-semibold text-slate-700 truncate">{uploadFile.name}</p>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Haz clic para seleccionar un archivo PDF</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del archivo *</label>
                <input type="text" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Ej: Certificado ISO 2024"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeUploadModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!uploadFile || !uploadDesc.trim() || uploading}
                  className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${ac.btn}`}>
                  {uploading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Subiendo...</>
                    : 'Confirmar'
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
