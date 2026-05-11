import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import LoginPage from './pages/LoginPage';
import ConsultorPage from './pages/ConsultorPage';
import AdminLayout from './layouts/AdminLayout';
import CertificadosPage from './pages/CertificadosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import GestionDocumentosPage from './pages/GestionDocumentosPage';

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user } = useAuthStore();
  
  if (!user) return <Navigate to="/login" />;
  if (requireAdmin && user.rol !== 'admin') return <Navigate to="/" />;
  
  return <>{children}</>;
};

// Root route: redirect admins to /admin, consultors stay at /
const RootRoute = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol === 'admin') return <Navigate to="/admin" replace />;
  return <ConsultorPage />;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Public/Consultor route — admins are redirected to /admin */}
        <Route path="/" element={<RootRoute />} />
        
        {/* Admin routes nested in Layout */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          <Route index element={<Navigate to="/admin/certificados" replace />} />
          <Route path="certificados" element={<CertificadosPage />} />
          <Route path="gestion" element={<GestionDocumentosPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;