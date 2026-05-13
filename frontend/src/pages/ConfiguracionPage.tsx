import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, Users, ShieldCheck, UserCheck, Building2, Pencil } from 'lucide-react';
import { api } from '../services/api';

interface UsuarioPerfil { id: string; nombre?: string; email?: string; rol: string; empresa_id?: string; empresa?: { id: string; nombre: string } | null; }
interface Empresa { id: string; nombre: string; }

const ROL_LABELS: Record<string, { label: string; color: string }> = {
  admin:     { label: 'Administrador', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  consultor: { label: 'Consultor',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
  vendedor:  { label: 'Vendedor',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  deposito:  { label: 'Depósito',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  calidad:   { label: 'Calidad',       color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

type Tab = 'usuarios' | 'empresas';

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  const [usuarios, setUsuarios]     = useState<UsuarioPerfil[]>([]);
  const [loadingUsr, setLoadingUsr] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail]         = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [newNombreUsr, setNewNombreUsr] = useState('');
  const [newRolUsr, setNewRolUsr]       = useState<string>('consultor');
  const [creatingUser, setCreatingUser] = useState(false);

  // ── EDICIÓN DE USUARIO ────────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<UsuarioPerfil | null>(null);
  const [editNombre, setEditNombre]   = useState('');
  const [editRol, setEditRol]         = useState<string>('consultor');
  const [editEmpresaId, setEditEmpresaId] = useState('');
  const [savingEdit, setSavingEdit]   = useState(false);

  // ── EMPRESAS ──────────────────────────────────────────────────────────────
  const [empresas, setEmpresas]     = useState<Empresa[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [newEmpNombre, setNewEmpNombre] = useState('');
  const [addingEmp, setAddingEmp]   = useState(false);
  const [creatingEmp, setCreatingEmp] = useState(false);

  const fetchUsuarios = async () => {
    setLoadingUsr(true);
    try {
      const res = await api.get('/auth/usuarios');
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); setUsuarios([]); }
    finally { setLoadingUsr(false); }
  };

  const fetchEmpresas = async () => {
    setLoadingEmp(true);
    try {
      const res = await api.get('/empresas');
      setEmpresas(Array.isArray(res.data) ? res.data : []);
    } catch { setEmpresas([]); }
    finally { setLoadingEmp(false); }
  };

  useEffect(() => { fetchUsuarios(); fetchEmpresas(); }, []);

  const openEdit = (usr: UsuarioPerfil) => {
    setEditingUser(usr);
    setEditNombre(usr.nombre || '');
    setEditRol(usr.rol);
    setEditEmpresaId(usr.empresa_id || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/auth/usuarios/${editingUser.id}`, {
        nombre: editNombre,
        rol: editRol,
        empresa_id: editEmpresaId,
      });
      setUsuarios(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...res.data } : u));
      setEditingUser(null);
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error al guardar'); }
    finally { setSavingEdit(false); }
  };

  const handleDeleteUser = async (userId: string, nombre?: string) => {
    if (!confirm(`Eliminar al usuario "${nombre || userId}"?`)) return;
    setDeletingId(userId);
    try {
      await api.delete(`/auth/usuarios/${userId}`);
      setUsuarios(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
    finally { setDeletingId(null); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreatingUser(true);
    try {
      const res = await api.post('/auth/usuarios', { email: newEmail.trim(), password: newPassword, nombre: newNombreUsr.trim() || null, rol: newRolUsr });
      setUsuarios(prev => [...prev, res.data]);
      setShowCreateUser(false);
      setNewEmail(''); setNewPassword(''); setNewNombreUsr(''); setNewRolUsr('consultor');
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
    finally { setCreatingUser(false); }
  };

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpNombre.trim()) return;
    setCreatingEmp(true);
    try {
      await api.post('/empresas', { nombre: newEmpNombre.trim() });
      setNewEmpNombre(''); setAddingEmp(false);
      fetchEmpresas();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
    finally { setCreatingEmp(false); }
  };

  const handleDeleteEmpresa = async (id: string, nombre: string) => {
    if (!confirm(`Eliminar empresa "${nombre}"? Los usuarios vinculados quedaran sin empresa.`)) return;
    await api.delete(`/empresas/${id}`);
    fetchEmpresas();
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-full sm:w-fit">
        {([
          { key: 'usuarios', label: 'Usuarios & Roles', Icon: Users },
          { key: 'empresas', label: 'Empresas', Icon: Building2 },
        ] as { key: Tab; label: string; Icon: any }[]).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: USUARIOS ── */}
      {activeTab === 'usuarios' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
            <div className="p-2.5 bg-blue-50 rounded-xl"><Users className="h-5 w-5 text-blue-600" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">Usuarios y Roles</h3>
              <p className="text-xs text-slate-500">Administra permisos y empresa de cada usuario</p>
            </div>
            <button onClick={() => setShowCreateUser(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
              <Plus className="h-4 w-4" /> Crear Usuario
            </button>
          </div>

          {/* Table (md+) / Cards (mobile) */}
          {loadingUsr ? (
            <p className="text-center text-slate-400 py-12">Cargando usuarios...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No se encontraron usuarios.</p>
          ) : (
            <>
              {/* Cards view — mobile only */}
              <div className="md:hidden divide-y divide-slate-100">
                {usuarios.map(usr => {
                  const rolInfo = ROL_LABELS[usr.rol] || { label: usr.rol, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                  return (
                    <div key={usr.id} className="px-4 py-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                        {(usr.nombre || usr.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate text-sm">
                          {usr.nombre || <span className="text-slate-400 italic font-normal">Sin nombre</span>}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{usr.email}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${rolInfo.color}`}>
                            {usr.rol === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                            {rolInfo.label}
                          </span>
                          {usr.empresa && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Building2 className="h-3 w-3 text-slate-400" />{usr.empresa.nombre}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(usr)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(usr.id, usr.nombre)} disabled={!!deletingId}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40">
                          {deletingId === usr.id
                            ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin inline-block" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Table view — md+ */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-left">
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                      <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuarios.map(usr => {
                      const rolInfo = ROL_LABELS[usr.rol] || { label: usr.rol, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                      return (
                        <tr key={usr.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                                {(usr.nombre || usr.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">
                                  {usr.nombre || <span className="text-slate-400 italic font-normal">Sin nombre</span>}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{usr.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {usr.empresa ? (
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                {usr.empresa.nombre}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Sin empresa</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${rolInfo.color}`}>
                              {usr.rol === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                              {rolInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(usr)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button onClick={() => handleDeleteUser(usr.id, usr.nombre)} disabled={!!deletingId}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40">
                                {deletingId === usr.id
                                  ? <span className="w-4 h-4 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin inline-block" />
                                  : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: EMPRESAS ── */}
      {activeTab === 'empresas' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><Building2 className="h-5 w-5 text-emerald-600" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">Empresas</h3>
              <p className="text-xs text-slate-500">Gestiona las empresas clientes</p>
            </div>
            {!addingEmp && (
              <button onClick={() => setAddingEmp(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
                <Plus className="h-4 w-4" /> Crear Empresa
              </button>
            )}
          </div>
          {addingEmp && (
            <form onSubmit={handleCreateEmpresa} className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <h4 className="text-sm font-semibold text-emerald-800">Nueva Empresa</h4>
              <input autoFocus type="text" placeholder="Nombre / Razon Social *" value={newEmpNombre} onChange={e => setNewEmpNombre(e.target.value)} required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
              <div className="flex gap-2">
                <button type="submit" disabled={creatingEmp}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  <Check className="h-4 w-4" /> Guardar
                </button>
                <button type="button" onClick={() => { setAddingEmp(false); setNewEmpNombre(''); }}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                  <X className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </form>
          )}
          {loadingEmp ? (
            <p className="text-center text-slate-400 py-8">Cargando...</p>
          ) : empresas.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No hay empresas registradas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {empresas.map(emp => (
                <li key={emp.id} className="py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="flex-1 text-sm font-semibold text-slate-800">{emp.nombre}</p>
                  <button onClick={() => handleDeleteEmpresa(emp.id, emp.nombre)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Editar Usuario</h3>
                  <p className="text-sm text-slate-500 mt-0.5 truncate">{editingUser.email}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre</label>
                  <input autoFocus type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)} placeholder="Nombre completo"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Empresa</label>
                  <select value={editEmpresaId} onChange={e => setEditEmpresaId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="">Sin empresa</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rol</label>
                  <select value={editRol} onChange={e => setEditRol(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="consultor">Consultor</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="deposito">Depósito</option>
                    <option value="calidad">Calidad</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingEdit}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm">
                    {savingEdit ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                    {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Usuario */}
      {showCreateUser && (        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateUser(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Crear Usuario</h3>
                  <p className="text-sm text-slate-500 mt-0.5">El usuario recibira acceso inmediato</p>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contrasena <span className="text-rose-500">*</span></label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimo 6 caracteres" required minLength={6}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre</label>
                  <input type="text" value={newNombreUsr} onChange={e => setNewNombreUsr(e.target.value)} placeholder="Nombre completo (opcional)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rol</label>
                  <select value={newRolUsr} onChange={e => setNewRolUsr(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="consultor">Consultor</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="deposito">Depósito</option>
                    <option value="calidad">Calidad</option>
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
                    {creatingUser ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
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
