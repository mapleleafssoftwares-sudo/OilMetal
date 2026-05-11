import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Download, LogIn, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { Producto } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export default function ConsultorPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDesc, setSearchDesc] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('Todas');
  const [certFilter, setCertFilter] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    api.get('/categorias').then(res => {
      setCategorias(res.data.map((c: { nombre: string }) => c.nombre));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        setLoading(true);
        const res = await api.get('/productos', { params: { search: searchTerm, categoria: categoriaFilter } });
        setProductos(res.data);
      } catch (error) {
        console.error('Error fetching productos:', error);
      } finally {
        setLoading(false);
      }
    };
    const timeoutId = setTimeout(fetchProductos, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoriaFilter]);

  // Certificados únicos presentes en los productos cargados
  const certNames = useMemo(() => {
    const names = new Set<string>();
    productos.forEach(p => p.certificados?.forEach(c => names.add(c.nombre)));
    return Array.from(names).sort();
  }, [productos]);

  // Filtros client-side: descripción y certificado
  const filteredProductos = useMemo(() => {
    let list = productos;
    if (searchDesc.trim()) {
      const q = searchDesc.trim().toLowerCase();
      list = list.filter(p => (p.descripcion || '').toLowerCase().includes(q));
    }
    if (certFilter) {
      list = list.filter(p => p.certificados?.some(c => c.nombre === certFilter));
    }
    return list;
  }, [productos, searchDesc, certFilter]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          {/* Logo + título */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Oil Metal" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Buscador de Certificados</h1>
              <p className="text-xs text-gray-400">Certificaciones Oil Metal</p>
            </div>
          </div>

          {/* Usuario + botón */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-600 hidden sm:block">
                Bienvenido, <span className="font-semibold text-gray-800">{user.nombre || user.email}</span>
              </span>
            )}
            {user ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Acceder
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Búsqueda por código */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar por código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Búsqueda por descripción */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar por descripción..."
              value={searchDesc}
              onChange={(e) => setSearchDesc(e.target.value)}
            />
          </div>

          {/* Filtro categoría */}
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Todas">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Filtro certificado */}
          <select
            value={certFilter}
            onChange={(e) => setCertFilter(e.target.value)}
            className="block w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los certificados</option>
            {certNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Contador */}
        <p className="text-xs text-gray-400 mb-3 ml-1">
          {filteredProductos.length} resultado{filteredProductos.length !== 1 ? 's' : ''}
          {(searchDesc || certFilter) ? ' (filtros aplicados)' : ''}
        </p>

        {/* Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Partida / Lote</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Certificado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Cargando productos...</td></tr>
                ) : filteredProductos.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No se encontraron productos.</td></tr>
                ) : (
                  filteredProductos.map((producto) => (
                    <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{producto.nombre}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">{producto.descripcion || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-medium text-xs">
                          {producto.categoria || 'Otros'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{producto.partida_lote || '-'}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium">
                        {producto.certificados && producto.certificados.length > 0 ? (
                          <div className="flex flex-col items-center gap-1.5">
                            {producto.certificados.map(cert => (
                              cert.archivo_url ? (
                                <a
                                  key={cert.id}
                                  href={cert.archivo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors max-w-[180px]"
                                  title={cert.nombre}
                                >
                                  <Download className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                  <span className="truncate">{cert.nombre}</span>
                                </a>
                              ) : null
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-400">
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            No disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
