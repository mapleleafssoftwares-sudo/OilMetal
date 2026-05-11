import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const SLIDES = ['/deposito.png', '/valvulas.png', '/valvactuador.png', '/valvula.png'];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const timer = setInterval(() => setSlide(prev => (prev + 1) % SLIDES.length), 4500);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loginRes = await api.post('/auth/login', { email, password });
      const { access_token } = loginRes.data;
      useAuthStore.setState({ token: access_token });
      const meRes = await api.get('/auth/me');
      setAuth(meRes.data, access_token);
      if (meRes.data.rol === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Panel izquierdo: branding ───────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex-col items-center justify-center p-12 relative overflow-hidden">

        {/* Carousel de imágenes en el fondo */}
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === slide ? 1 : 0 }}
          >
            <img src={src} alt="" className="w-full h-full object-cover opacity-20" />
          </div>
        ))}

        {/* Overlay de gradiente para mantener legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/10 via-slate-900/10 to-slate-950/10" />

        {/* Logo y texto */}
        <div className="relative z-10 flex flex-col items-center gap-10">
          <img
            src="/logo.png"
            alt="OilMetal"
            className="w-53 h-53 object-contain drop-shadow-2xl"
          />

          <div className="text-center space-y-2">
            <p className="text-slate-400 text-sm tracking-widest uppercase font-medium">
              Sistema de Gestión
            </p>
            <p className="text-white/50 text-sm max-w-xs leading-relaxed">
              Control y trazabilidad de certificados de materiales
            </p>
          </div>
        </div>

        {/* Indicadores del carrusel */}
        <div className="absolute bottom-16 flex items-center gap-2 z-10">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`rounded-full transition-all duration-300 ${
                i === slide ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Pie del panel */}
        <p className="absolute bottom-6 text-slate-600 text-xs z-10">
          © {new Date().getFullYear()} OilMetal — Todos los derechos reservados
        </p>
      </div>

      {/* ── Panel derecho: formulario ───────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">

        {/* Logo pequeño visible solo en móvil */}
        <div className="lg:hidden mb-8">
          <img src="/logo.png" alt="OilMetal" className="w-24 h-24 object-contain mx-auto" />
        </div>

        <div className="w-full max-w-md">
          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Bienvenido
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Ingresá tus credenciales para acceder al portal
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 disabled:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</>
                : 'Ingresar al sistema'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
