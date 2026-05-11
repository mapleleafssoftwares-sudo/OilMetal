import { useState, useEffect } from 'react';
import { UploadCloud, Trash2, Link as LinkIcon, FileText } from 'lucide-react';
import { api } from '../services/api';
import { Certificado } from '../types';

export default function CertificadosPage() {
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading, setLoading] = useState(true);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNombre, setUploadNombre] = useState('');
  const [uploadColada, setUploadColada] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchCertificados = async () => {
    try {
      setLoading(true);
      const res = await api.get('/certificados');
      setCertificados(res.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCertificados(); }, []);

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadNombre('');
    setUploadColada('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('nombre', uploadNombre || uploadFile.name);
    if (uploadColada) formData.append('colada', uploadColada);
    try {
      await api.post('/certificados/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      closeUploadModal();
      fetchCertificados();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error al subir PDF');
    } finally {
      setUploading(false);
    }
  };

  const deleteCertificado = async (id: string) => {
    if (!confirm('¿Eliminar este certificado? Los productos vinculados perderán esta asignación.')) return;
    try {
      await api.delete(`/certificados/${id}`);
      fetchCertificados();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar');
    }
  };

  return (
    <div className="h-full flex flex-col relative">

      {/* Top action bar */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 hover:bg-blue-700 transition-all duration-300"
        >
          <UploadCloud className="h-5 w-5" />
          Nuevo Certificado
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
            <h3 className="font-semibold text-slate-800">Certificados Almacenados</h3>
            <span className="ml-2 bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {certificados.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
          {loading ? (
            <div className="col-span-full p-8 text-center text-slate-400">Cargando certificados...</div>
          ) : certificados.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-400">No hay certificados. Crea uno nuevo.</div>
          ) : certificados.map(cert => (
            <div key={cert.id} className="group flex flex-col p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">

              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate" title={cert.nombre}>
                    {cert.nombre}
                  </p>
                  {cert.colada && (
                    <span className="inline-block mt-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      Colada: {cert.colada}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteCertificado(cert.id)}
                  className="flex-shrink-0 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar certificado"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Archivo PDF */}
              <div className="flex-1">
                {cert.archivo_url ? (
                  <div className="flex items-center gap-1.5 p-2 bg-rose-50/60 border border-rose-100 rounded-xl">
                    <FileText className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                    <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate" title={cert.nombre}>
                      {cert.nombre}
                    </span>
                    <a
                      href={cert.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      title="Ver archivo"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic px-1">Sin archivo</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Nuevo Certificado */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeUploadModal}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                <UploadCloud className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Nuevo Certificado</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">Sube un archivo PDF para crear un nuevo certificado.</p>

              <form onSubmit={handleUpload} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nombre del Certificado <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadNombre}
                    onChange={(e) => setUploadNombre(e.target.value)}
                    required
                    placeholder="Ej: Certificado de Calidad Lote A"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Número de Colada</label>
                  <input
                    type="text"
                    value={uploadColada}
                    onChange={(e) => setUploadColada(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Archivo PDF <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer border border-slate-200 rounded-xl p-1"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={closeUploadModal}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={!uploadFile || uploading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {uploading
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Subiendo...</>
                      : 'Confirmar'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
