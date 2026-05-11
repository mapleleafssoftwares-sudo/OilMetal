import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X, Tag, Users, ShieldCheck, UserCheck } from 'lucide-react';
import { api } from '../services/api';

interface Categoria { id: string; nombre: string; descripcion?: string; }
interface UsuarioPerfil { id: string; nombre?: string; email?: string; rol: string; }

type Tab = 'categorias' | 'usuarios';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ROL_LABELS: Record<string, { label: string; color: string }> = {
  admin:     { label: 'Administrador', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  consultor: { label: 'Consultor',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categorias');

  // ── CATEGORÍAS ──────────────────────────────────────────
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [newNombre, setNewNombre]   = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [adding, setAdding]         = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDesc, setEditDesc]     = useState('');

  const fetchCategorias = async () => {
    setLoadingCat(true);
    const res = await api.get('/categorias');
    setCategorias(res.data);
    setLoadingCat(false);
  };

  useEffect(() => { fetchCategorias(); }, []);

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;
    try {
      await api.post('/categorias', { nombre: newNombre.trim(), descripcion: newDesc.trim() || null });
      setNewNombre(''); setNewDesc(''); setAdding(false);
      fetchCategorias();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
  };

  const handleEditCat = async (id: string) => {
    try {
      await api.put(`/categorias/${id}`, { nombre: editNombre, descripcion: editDesc || null });
      setEditingId(null);
      fetchCategorias();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
  };

  const handleDeleteCat = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
    await api.delete(`/categorias/${id}`);
    fetchCategorias();
  };

  // ── USUARIOS ────────────────────────────────────────────
  const [usuarios, setUsuarios]       = useState<UsuarioPerfil[]>([]);
  const [loadingUsr, setLoadingUsr]   = useState(false);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Crear usuario
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNombreUsr, setNewNombreUsr] = useState('');
  const [newRolUsr, setNewRolUsr]   = useState<'admin' | 'consultor'>('consultor');
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchUsuarios = async () => {
    setLoadingUsr(true);
    try {
      const res = await api.get('/auth/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsr(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsuarios();
  }, [activeTab]);

  const handleChangeRol = async (userId: string, rol: string) => {
    setUpdatingId(userId);
    try {
      await api.put(`/auth/usuarios/${userId}/rol`, null, { params: { rol } });
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, rol } : u));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al cambiar rol');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, nombre?: string) => {
    if (!confirm(`¿Eliminar al usuario "${nombre || userId}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(userId);
    try {
      await api.delete(`/auth/usuarios/${userId}`);
      setUsuarios(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al eliminar usuario');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreatingUser(true);
    try {
      const res = await api.post('/auth/usuarios', {
        email: newEmail.trim(),
        password: newPassword,
        nombre: newNombreUsr.trim() || null,
        rol: newRolUsr,
      });
      setUsuarios(prev => [...prev, res.data]);
      setShowCreateUser(false);
      setNewEmail(''); setNewPassword(''); setNewNombreUsr(''); setNewRolUsr('consultor');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al crear usuario');
    } finally {
      setCreatingUser(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'categorias', label: 'Categorías', Icon: Tag },
          { key: 'usuarios',   label: 'Usuarios & Roles', Icon: Users },
        ] as { key: Tab; label: string; Icon: any }[]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: CATEGORÍAS ──────────────────────────────── */}
      {activeTab === 'categorias' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-50 rounded-xl">
                <Tag className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Gestión de Categorías</h3>
                <p className="text-xs text-slate-500">Crea y administra las categorías del inventario</p>
              </div>
            </div>
            {!adding && (
              <button onClick={() => setAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-violet-500/20 hover:bg-violet-700 hover:-translate-y-0.5 transition-all">
                <Plus className="h-4 w-4" /> Nueva Categoría
              </button>
            )}
          </div>

          {adding && (
            <form onSubmit={handleAddCat} className="mb-6 p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-violet-800">Nueva Categoría</h4>
              <input autoFocus type="text" placeholder="Nombre *" value={newNombre} onChange={e => setNewNombre(e.target.value)} required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
              <input type="text" placeholder="Descripción (opcional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
              <div className="flex gap-2">
                <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors">
                  <Check className="h-4 w-4" /> Guardar
                </button>
                <button type="button" onClick={() => { setAdding(false); setNewNombre(''); setNewDesc(''); }}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </form>
          )}

          {loadingCat ? (
            <p className="text-center text-slate-400 py-8">Cargando...</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {categorias.map(cat => (
                <li key={cat.id} className="py-4 flex items-center gap-3 group">
                  {editingId === cat.id ? (
                    <div className="flex-1 space-y-2">
                      <input autoFocus value={editNombre} onChange={e => setEditNombre(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descripción (opcional)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
                      <div className="flex gap-2">
                        <button onClick={() => handleEditCat(cat.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600">
                          <Check className="h-3.5 w-3.5" /> Guardar
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50">
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{cat.nombre}</p>
                        {cat.descripcion && <p className="text-xs text-slate-500 truncate">{cat.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(cat.id); setEditNombre(cat.nombre); setEditDesc(cat.descripcion || ''); }}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteCat(cat.id, cat.nombre)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── TAB: USUARIOS ────────────────────────────────── */}
      {activeTab === 'usuarios' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">Usuarios & Roles</h3>
              <p className="text-xs text-slate-500">Administra los permisos de acceso de cada usuario</p>
            </div>
            <button
              onClick={() => setShowCreateUser(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="h-4 w-4" /> Crear Usuario
            </button>
          </div>

          {loadingUsr ? (
            <p className="text-center text-slate-400 py-8">Cargando usuarios...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No se encontraron usuarios.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {usuarios.map(usr => {
                const rolInfo = ROL_LABELS[usr.rol] || { label: usr.rol, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                const isUpdating = updatingId === usr.id;
                return (
                  <li key={usr.id} className="py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                      {(usr.nombre || usr.email || '?').charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {usr.nombre || <span className="text-slate-400 italic">Sin nombre</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{usr.email || usr.id}</p>
                    </div>

                    {/* Rol badge + selector */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rolInfo.color}`}>
                        {usr.rol === 'admin' ? <ShieldCheck className="h-3 w-3 inline mr-1" /> : <UserCheck className="h-3 w-3 inline mr-1" />}
                        {rolInfo.label}
                      </span>

                      <select
                        value={usr.rol}
                        disabled={isUpdating}
                        onChange={e => handleChangeRol(usr.id, e.target.value)}
                        className="text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <option value="consultor">Consultor</option>
                        <option value="admin">Administrador</option>
                      </select>

                      {isUpdating && (
                        <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      )}

                      <button
                        onClick={() => handleDeleteUser(usr.id, usr.nombre)}
                        disabled={!!deletingId}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Eliminar usuario"
                      >
                        {deletingId === usr.id
                          ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin inline-block" />
                          : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Modal: Crear Usuario ──────────────────────────── */}
      {showCreateUser && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateUser(false)} />
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Crear Usuario</h3>
                <p className="text-sm text-slate-500 mt-0.5">El usuario recibirá acceso inmediato al sistema</p>
              </div>
              <button onClick={() => setShowCreateUser(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-rose-500">*</span></label>
                <input autoFocus type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@empresa.com" required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña <span className="text-rose-500">*</span></label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre</label>
                <input type="text" value={newNombreUsr} onChange={e => setNewNombreUsr(e.target.value)} placeholder="Nombre completo (opcional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rol</label>
                <select value={newRolUsr} onChange={e => setNewRolUsr(e.target.value as 'admin' | 'consultor')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                  <option value="consultor">Consultor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateUser(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={!newEmail.trim() || !newPassword.trim() || creatingUser}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm">
                  {creatingUser
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Check className="h-4 w-4" />}
                  {creatingUser ? 'Creando...' : 'Crear Usuario'}
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
