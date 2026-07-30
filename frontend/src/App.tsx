import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, INTERNAL_ROLES } from './store/useAuthStore';
import LoginPage from './pages/LoginPage';
import ConsultorPage from './pages/ConsultorPage';
import AdminLayout from './layouts/AdminLayout';
import CertificadosPage from './pages/CertificadosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import GestionDocumentosPage from './pages/GestionDocumentosPage';
import InstructivoPage from './pages/InstructivoPage';
import NoConformidadesPage from './pages/NoConformidadesPage';
import NoConformidadDetailPage from './pages/NoConformidadDetailPage';

// Protected Route Component
const ProtectedRoute = ({ children, requireInternal = false }: { children: React.ReactNode, requireInternal?: boolean }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" />;
  if (requireInternal && !INTERNAL_ROLES.includes(user.rol)) return <Navigate to="/" />;
  return <>{children}</>;
};

// Root route: redirect internal users to /admin, consultors see ConsultorPage
const RootRoute = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (INTERNAL_ROLES.includes(user.rol)) return <Navigate to="/admin" replace />;
  return <ConsultorPage />;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Consultor route */}
        <Route path="/" element={<RootRoute />} />

        {/* Internal routes nested in Layout */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireInternal={true}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/certificados" replace />} />
          <Route path="certificados" element={<CertificadosPage />} />
          <Route path="gestion" element={<GestionDocumentosPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="instructivo" element={<InstructivoPage />} />
          <Route
            path="no-conformidades"
            element={
              <ProtectedRoute requireInternal={true}>
                <NoConformidadesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="no-conformidades/:id"
            element={
              <ProtectedRoute requireInternal={true}>
                <NoConformidadDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
