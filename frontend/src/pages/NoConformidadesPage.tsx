import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Plus, Search, X, LibraryBig, Pencil, Trash2, Check } from 'lucide-react';
import {
  createCargo,
  createNoConformidad,
  createRequisitoPuntual,
  createSectorTipo,
  deleteCargo,
  deleteRequisitoPuntual,
  deleteSectorTipo,
  getCargos,
  getNoConformidades,
  getRequisitosPuntuales,
  getSectoresTipo,
  updateCargo,
  updateRequisitoPuntual,
  updateSectorTipo,
} from '../services/noConformidades';
import type { NoConformidadListItem, SectorTipo } from '../types/noConformidades';
import type { Cargo, RequisitoPuntual } from '../types/noConformidades';
import { useAuthStore } from '../store/useAuthStore';

type Tab = 'casos' | 'catalogos';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  // Fechas "solo día" (YYYY-MM-DD) se parsean en horario local para evitar
  // el corrimiento de un día que provoca `new Date(value)` al interpretarlas como UTC.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function NoConformidadesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.rol === 'admin';

  const [tab, setTab] = useState<Tab>('casos');

  const [items, setItems] = useState<NoConformidadListItem[]>([]);
  const [sectores, setSectores] = useState<SectorTipo[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [requisitosPuntuales, setRequisitosPuntuales] = useState<RequisitoPuntual[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterVendedor, setFilterVendedor] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSector, setFilterSector] = useState('');

  const [sectorTipoId, setSectorTipoId] = useState<number | ''>('');
  const [plazo, setPlazo] = useState('');

  const [newSectorNombre, setNewSectorNombre] = useState('');
  const [newCargoNombre, setNewCargoNombre] = useState('');
  const [newRequisitoNombre, setNewRequisitoNombre] = useState('');
  const [savingSector, setSavingSector] = useState(false);
  const [savingCargo, setSavingCargo] = useState(false);
  const [savingRequisito, setSavingRequisito] = useState(false);
  const [editingSectorId, setEditingSectorId] = useState<number | null>(null);
  const [editingSectorNombre, setEditingSectorNombre] = useState('');
  const [editingCargoId, setEditingCargoId] = useState<number | null>(null);
  const [editingCargoNombre, setEditingCargoNombre] = useState('');
  const [editingRequisitoId, setEditingRequisitoId] = useState<number | null>(null);
  const [editingRequisitoNombre, setEditingRequisitoNombre] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [ncData, sectoresData] = await Promise.all([
        getNoConformidades(),
        getSectoresTipo(true),
      ]);
      setItems(ncData);
      setSectores(sectoresData);
    } catch (error) {
      console.error(error);
      setItems([]);
      setSectores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    try {
      const [sectoresData, cargosData, requisitosData] = await Promise.all([
        getSectoresTipo(true),
        getCargos(true),
        getRequisitosPuntuales(true),
      ]);
      setSectores(sectoresData);
      setCargos(cargosData);
      setRequisitosPuntuales(requisitosData);
    } catch (error) {
      console.error(error);
      setSectores([]);
      setCargos([]);
      setRequisitosPuntuales([]);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  useEffect(() => {
    if (tab === 'catalogos') {
      loadCatalogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const clienteOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.empresa_nombre).filter((v): v is string => !!v))).sort(),
    [items],
  );
  const vendedorOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.created_by_nombre).filter((v): v is string => !!v))).sort(),
    [items],
  );
  const sectorOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.sector_tipo_nombre).filter((v): v is string => !!v))).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || (
        String(item.id).includes(q)
        || (item.sector_tipo_nombre || '').toLowerCase().includes(q)
        || item.estado.toLowerCase().includes(q)
        || (item.orden_numero || '').toLowerCase().includes(q)
        || (item.empresa_nombre || '').toLowerCase().includes(q)
        || (item.created_by_nombre || '').toLowerCase().includes(q)
      );
      const matchesCliente = !filterCliente || item.empresa_nombre === filterCliente;
      const matchesVendedor = !filterVendedor || item.created_by_nombre === filterVendedor;
      const matchesEstado = !filterEstado || item.estado === filterEstado;
      const matchesSector = !filterSector || item.sector_tipo_nombre === filterSector;
      return matchesSearch && matchesCliente && matchesVendedor && matchesEstado && matchesSector;
    });
  }, [items, search, filterCliente, filterVendedor, filterEstado, filterSector]);

  const hasActiveFilters = !!(filterCliente || filterVendedor || filterEstado || filterSector);
  const clearFilters = () => {
    setFilterCliente('');
    setFilterVendedor('');
    setFilterEstado('');
    setFilterSector('');
  };

  const resetCreateForm = () => {
    setSectorTipoId('');
    setPlazo('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorTipoId) return;
    setCreating(true);
    try {
      const created = await createNoConformidad({
        sector_tipo_id: Number(sectorTipoId),
        ...(plazo ? { plazo } : {}),
      });
      setShowCreate(false);
      resetCreateForm();
      navigate(`/admin/no-conformidades/${created.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo crear el Reclamo/No Conformidad');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorNombre.trim()) return;
    setSavingSector(true);
    try {
      await createSectorTipo(newSectorNombre.trim());
      setNewSectorNombre('');
      await loadCatalogs();
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo crear el Sector/Tipo');
    } finally {
      setSavingSector(false);
    }
  };

  const handleCreateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCargoNombre.trim()) return;
    setSavingCargo(true);
    try {
      await createCargo(newCargoNombre.trim());
      setNewCargoNombre('');
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo crear el Cargo');
    } finally {
      setSavingCargo(false);
    }
  };

  const handleSaveSectorEdit = async (id: number) => {
    if (!editingSectorNombre.trim()) return;
    setSavingSector(true);
    try {
      await updateSectorTipo(id, editingSectorNombre.trim());
      setEditingSectorId(null);
      setEditingSectorNombre('');
      await loadCatalogs();
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo actualizar el Sector/Tipo');
    } finally {
      setSavingSector(false);
    }
  };

  const handleSaveCargoEdit = async (id: number) => {
    if (!editingCargoNombre.trim()) return;
    setSavingCargo(true);
    try {
      await updateCargo(id, editingCargoNombre.trim());
      setEditingCargoId(null);
      setEditingCargoNombre('');
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo actualizar el Cargo');
    } finally {
      setSavingCargo(false);
    }
  };

  const handleDeleteSector = async (id: number, nombre: string) => {
    if (!confirm(`Dar de baja Sector/Tipo "${nombre}"?`)) return;
    try {
      await deleteSectorTipo(id);
      await loadCatalogs();
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo dar de baja el Sector/Tipo');
    }
  };

  const handleDeleteCargo = async (id: number, nombre: string) => {
    if (!confirm(`Dar de baja Cargo "${nombre}"?`)) return;
    try {
      await deleteCargo(id);
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo dar de baja el Cargo');
    }
  };

  const handleCreateRequisito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequisitoNombre.trim()) return;
    setSavingRequisito(true);
    try {
      await createRequisitoPuntual(newRequisitoNombre.trim());
      setNewRequisitoNombre('');
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo crear el Requisito Puntual');
    } finally {
      setSavingRequisito(false);
    }
  };

  const handleSaveRequisitoEdit = async (id: number) => {
    if (!editingRequisitoNombre.trim()) return;
    setSavingRequisito(true);
    try {
      await updateRequisitoPuntual(id, editingRequisitoNombre.trim());
      setEditingRequisitoId(null);
      setEditingRequisitoNombre('');
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo actualizar el Requisito Puntual');
    } finally {
      setSavingRequisito(false);
    }
  };

  const handleDeleteRequisito = async (id: number, nombre: string) => {
    if (!confirm(`Dar de baja Requisito Puntual "${nombre}"?`)) return;
    try {
      await deleteRequisitoPuntual(id);
      await loadCatalogs();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo dar de baja el Requisito Puntual');
    }
  };

  return (
    <section className="space-y-6 w-full">
      {isAdmin && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-fit">
          <button
            onClick={() => setTab('casos')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'casos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Casos
          </button>
          <button
            onClick={() => setTab('catalogos')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 ${tab === 'catalogos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LibraryBig className="h-4 w-4" /> Catálogos
          </button>
        </div>
      )}

      {tab === 'catalogos' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold text-slate-900 mb-3">Sector/Tipo</h4>
            <form onSubmit={handleCreateSector} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSectorNombre}
                onChange={(e) => setNewSectorNombre(e.target.value)}
                placeholder="Nuevo Sector/Tipo"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={savingSector}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                Agregar
              </button>
            </form>

            {loadingCatalogs ? (
              <p className="text-sm text-slate-400">Cargando...</p>
            ) : sectores.length === 0 ? (
              <p className="text-sm text-slate-400">Sin registros.</p>
            ) : (
              <ul className="space-y-2">
                {sectores.map((sector) => (
                  <li key={sector.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100">
                    {editingSectorId === sector.id ? (
                      <>
                        <input
                          type="text"
                          value={editingSectorNombre}
                          onChange={(e) => setEditingSectorNombre(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveSectorEdit(sector.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectorId(null);
                            setEditingSectorNombre('');
                          }}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{sector.nombre}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSectorId(sector.id);
                            setEditingSectorNombre(sector.nombre);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSector(sector.id, sector.nombre)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold text-slate-900 mb-3">Cargos</h4>
            <form onSubmit={handleCreateCargo} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCargoNombre}
                onChange={(e) => setNewCargoNombre(e.target.value)}
                placeholder="Nuevo Cargo"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={savingCargo}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                Agregar
              </button>
            </form>

            {loadingCatalogs ? (
              <p className="text-sm text-slate-400">Cargando...</p>
            ) : cargos.length === 0 ? (
              <p className="text-sm text-slate-400">Sin registros.</p>
            ) : (
              <ul className="space-y-2">
                {cargos.map((cargo) => (
                  <li key={cargo.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100">
                    {editingCargoId === cargo.id ? (
                      <>
                        <input
                          type="text"
                          value={editingCargoNombre}
                          onChange={(e) => setEditingCargoNombre(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCargoEdit(cargo.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCargoId(null);
                            setEditingCargoNombre('');
                          }}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{cargo.nombre}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCargoId(cargo.id);
                            setEditingCargoNombre(cargo.nombre);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCargo(cargo.id, cargo.nombre)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="font-semibold text-slate-900 mb-3">Requisitos Puntuales</h4>
            <form onSubmit={handleCreateRequisito} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newRequisitoNombre}
                onChange={(e) => setNewRequisitoNombre(e.target.value)}
                placeholder="Nuevo Requisito Puntual"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={savingRequisito}
                className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                Agregar
              </button>
            </form>

            {loadingCatalogs ? (
              <p className="text-sm text-slate-400">Cargando...</p>
            ) : requisitosPuntuales.length === 0 ? (
              <p className="text-sm text-slate-400">Sin registros.</p>
            ) : (
              <ul className="space-y-2">
                {requisitosPuntuales.map((requisito) => (
                  <li key={requisito.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100">
                    {editingRequisitoId === requisito.id ? (
                      <>
                        <input
                          type="text"
                          value={editingRequisitoNombre}
                          onChange={(e) => setEditingRequisitoNombre(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRequisitoEdit(requisito.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRequisitoId(null);
                            setEditingRequisitoNombre('');
                          }}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-700">{requisito.nombre}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRequisitoId(requisito.id);
                            setEditingRequisitoNombre(requisito.nombre);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequisito(requisito.id, requisito.nombre)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}

      {tab === 'casos' && (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Seguimiento de Casos
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Listado general con apertura de casos y seguimiento inicial.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Nro, sector o estado..."
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            value={filterCliente}
            onChange={(e) => setFilterCliente(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Cliente: todos</option>
            {clienteOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterVendedor}
            onChange={(e) => setFilterVendedor(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Vendedor: todos</option>
            {vendedorOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Estado: todos</option>
            <option value="En proceso">En proceso</option>
            <option value="Resuelto">Resuelto</option>
          </select>
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">Sector: todos</option>
            {sectorOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>
      )}

      {tab === 'casos' && (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 py-12">Cargando Seguimientos de casos...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No hay registros de Seguimientos de casos.</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-slate-400 py-12">Sin resultados para "{search}".</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left">
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nro</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Apertura</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sector/Tipo</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">NC</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plazo de Cierre</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Carpeta Doc.</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">#{item.id}</td>
                      <td className="px-6 py-4 text-slate-700">{formatDate(item.fecha_apertura)}</td>
                      <td className="px-6 py-4 text-slate-700">{item.empresa_nombre || '—'}</td>
                      <td className="px-6 py-4 text-slate-700">{item.created_by_nombre || '—'}</td>
                      <td className="px-6 py-4 text-slate-700">{item.sector_tipo_nombre || '—'}</td>
                      <td className="px-6 py-4 text-slate-700">{item.es_no_conformidad ? 'SI' : 'NO'}</td>
                      <td className="px-6 py-4 text-slate-700">{formatDate(item.plazo)}</td>
                      <td className="px-6 py-4 text-slate-700">{item.orden_numero || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${item.estado === 'Resuelto' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/no-conformidades/${item.id}`)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <div key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">NC #{item.id}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.sector_tipo_nombre || 'Sin sector'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${item.estado === 'Resuelto' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {item.estado}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <p className="text-slate-500">Cliente</p>
                    <p className="text-slate-700 text-right">{item.empresa_nombre || '—'}</p>
                    <p className="text-slate-500">Vendedor</p>
                    <p className="text-slate-700 text-right">{item.created_by_nombre || '—'}</p>
                    <p className="text-slate-500">No Conformidad</p>
                    <p className="text-slate-700 text-right">{item.es_no_conformidad ? 'SI' : 'NO'}</p>
                    <p className="text-slate-500">Apertura</p>
                    <p className="text-slate-700 text-right">{formatDate(item.fecha_apertura)}</p>
                    <p className="text-slate-500">Plazo</p>
                    <p className="text-slate-700 text-right">{formatDate(item.plazo)}</p>
                    {item.orden_numero && (
                      <>
                        <p className="text-slate-500">Carpeta</p>
                        <p className="text-slate-700 text-right">{item.orden_numero}</p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/no-conformidades/${item.id}`)}
                    className="mt-3 w-full px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                  >
                    Ver detalle
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h4 className="text-lg font-bold text-slate-900">Nuevo Reclamo / No Conformidad</h4>
              <p className="text-sm text-slate-500 mt-1">Se crea en estado En proceso. Al cerrar el caso queda como Resuelto.</p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sector/Tipo</label>
                <select
                  required
                  value={sectorTipoId}
                  onChange={(e) => setSectorTipoId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {sectores.map((sector) => (
                    <option key={sector.id} value={sector.id}>{sector.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Plazo de Cierre (opcional)</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={plazo}
                    onChange={(e) => setPlazo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear caso'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
