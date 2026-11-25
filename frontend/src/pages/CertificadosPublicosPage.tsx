import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileText, Loader2, Search, X } from 'lucide-react';
import { publicApi } from '../services/api';

interface CertificadoPublico {
  id: string;
  nombre: string;
  colada?: string | null;
  archivo_url: string;
  created_at: string;
}

const PAGE_SIZE = 20;

// Solo se permiten enlaces https (defensa ante datos inesperados, p. ej. "javascript:")
const isSafeUrl = (url: string) => /^https:\/\//i.test(url);

const downloadUrl = (c: CertificadoPublico) => {
  const sep = c.archivo_url.includes('?') ? '&' : '?';
  return `${c.archivo_url}${sep}download=${encodeURIComponent(`${c.nombre}.pdf`)}`;
};

export default function CertificadosPublicosPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CertificadoPublico[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(input.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    publicApi
      .get('/publico/certificados', {
        params: { q: query || undefined, page, page_size: PAGE_SIZE },
        signal: controller.signal,
      })
      .then((res) => {
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        setTotal(Number(res.data?.total) || 0);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotal(0);
        setError(
          err?.response?.status === 429
            ? 'Demasiadas consultas seguidas. Esperá unos segundos e intentá de nuevo.'
            : 'No se pudo cargar el listado de certificados.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
              <img src="/logo.png" alt="OilMetal" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Certificados de materiales y piezas</h1>
              <p className="text-xs text-slate-400">Consulta pública de certificados</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={input}
            maxLength={80}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar por nombre o colada..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all shadow-sm"
          />
          {input && (
            <button
              onClick={() => setInput('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 && !error ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            {query ? 'No se encontraron certificados para tu búsqueda.' : 'No hay certificados disponibles.'}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {total} certificado{total === 1 ? '' : 's'}
            </p>
            <ul className="space-y-2">
              {items.filter((c) => isSafeUrl(c.archivo_url)).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.nombre}</p>
                      {c.colada && <p className="text-xs text-slate-500 truncate">Colada: {c.colada}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={c.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Ver
                    </a>
                    <a
                      href={downloadUrl(c)}
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-500">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
