import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, Settings, FileText, FolderOpen
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function AdminLayout() {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Repositorio PDFs', path: '/admin/certificados', icon: FileText },
    { name: 'Gestión de Documentos', path: '/admin/gestion', icon: FolderOpen },
    { name: 'Gestión de Usuarios', path: '/admin/configuracion', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar (Premium dark glassmorphism) */}
      <aside className="w-64 bg-slate-900/95 backdrop-blur-xl text-slate-300 flex flex-col border-r border-slate-800 shadow-2xl relative z-20">
        <div className="h-20 flex items-center justify-center px-6 border-b border-slate-800/60">
          <img src="/logo.png" alt="OilMetal" className="h-20 w-auto object-contain" />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/60">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-bold shadow-inner">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.nombre || 'Administrador'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full gap-2 px-4 py-2.5 text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors border border-red-400/20"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shadow-sm relative z-20">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {location.pathname.includes('/certificados') ? 'Repositorio de PDFs'
                : location.pathname.includes('/gestion') ? 'Gestión de Documentos'
                : 'Gestión de Usuarios'}
            </h2>
            <p className="text-sm text-slate-500">
              {location.pathname.includes('/certificados')
                ? 'Sube y administra los archivos PDF del sistema.'
                : location.pathname.includes('/gestion')
                ? 'Administra las carpetas y documentos por Orden de Compra.'
                : 'Administra los usuarios y roles del sistema.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-hidden p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
