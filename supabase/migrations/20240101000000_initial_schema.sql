-- Migración Inicial - Esquema de Base de Datos
-- Este script se puede ejecutar en el panel de SQL Editor de Supabase.

-- Habilitar extensión para UUIDs (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. Tablas y Relaciones
-- =========================================================

-- Tabla de Certificados
CREATE TABLE certificados (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      TEXT NOT NULL,
    colada      TEXT,
    archivo_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Productos
CREATE TABLE productos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    partida_lote    TEXT,
    observaciones   TEXT,
    certificado_id  UUID REFERENCES certificados(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Perfiles (Extiende Auth de Supabase)
CREATE TABLE perfiles (
    id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol     TEXT NOT NULL CHECK (rol IN ('admin', 'consultor')),
    nombre  TEXT
);

-- =========================================================
-- 2. Políticas de Seguridad (Row Level Security - RLS)
-- =========================================================

-- Habilitar RLS en las tablas
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Funciones auxiliares para verificar roles
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_consultor() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'consultor'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas para 'certificados'
-- Lectura: Todos los autenticados (admin y consultores) pueden leer certificados. En este caso el plan dice que es público?
-- El plan dice "los usuarios consultores no necesitan login para ver PDFs". La API de certificados la listan como "Consultor (Público)" o "Admin". 
-- Ajustaremos a que la lectura sea pública y la escritura solo admin.
CREATE POLICY "Lectura pública de certificados" 
ON certificados FOR SELECT USING (true);

CREATE POLICY "Solo admin puede insertar certificados" 
ON certificados FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin puede actualizar certificados" 
ON certificados FOR UPDATE USING (public.is_admin());

CREATE POLICY "Solo admin puede eliminar certificados" 
ON certificados FOR DELETE USING (public.is_admin());

-- Políticas para 'productos'
CREATE POLICY "Lectura pública de productos" 
ON productos FOR SELECT USING (true);

CREATE POLICY "Solo admin puede modificar productos" 
ON productos FOR ALL USING (public.is_admin());

-- Políticas para 'perfiles'
CREATE POLICY "Usuarios pueden ver su propio perfil" 
ON perfiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins pueden ver todos los perfiles" 
ON perfiles FOR SELECT USING (public.is_admin());

-- =========================================================
-- 3. Storage Bucket
-- =========================================================
-- Nota: La creación del bucket en SQL se hace insertando en storage.buckets.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('certificados', 'certificados', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para el bucket 'certificados'
CREATE POLICY "Lectura pública del bucket certificados" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'certificados');

CREATE POLICY "Solo admin puede subir archivos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'certificados' AND public.is_admin());

CREATE POLICY "Solo admin puede eliminar archivos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'certificados' AND public.is_admin());
