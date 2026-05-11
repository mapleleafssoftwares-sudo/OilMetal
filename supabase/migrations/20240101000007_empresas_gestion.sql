-- =========================================================
-- Migración: Empresas + Gestión de Documentos por OC
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Tabla de empresas
CREATE TABLE IF NOT EXISTS empresas (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre     TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de órdenes de gestión (las "carpetas")
--    Cada carpeta tiene un número de OC y pertenece a una empresa
CREATE TABLE IF NOT EXISTS gestion_ordenes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_orden TEXT NOT NULL UNIQUE,
    empresa_id   UUID REFERENCES empresas(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de links: asocia documentos (de cualquiera de las 3 tablas) a una carpeta
CREATE TABLE IF NOT EXISTS gestion_documentos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id    UUID NOT NULL REFERENCES gestion_ordenes(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL CHECK (tipo IN ('certificado', 'orden_compra', 'remito')),
    documento_id UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (orden_id, tipo, documento_id)
);

-- 4. Agregar empresa_id a perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

-- 5. RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_documentos ENABLE ROW LEVEL SECURITY;

-- empresas: todos los autenticados leen, solo admin escribe
CREATE POLICY "Lectura publica empresas" ON empresas FOR SELECT USING (true);
CREATE POLICY "Admin inserta empresas"   ON empresas FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin elimina empresas"   ON empresas FOR DELETE USING (public.is_admin());

-- gestion_ordenes: todos los autenticados leen, solo admin escribe
CREATE POLICY "Lectura publica gestion_ordenes" ON gestion_ordenes FOR SELECT USING (true);
CREATE POLICY "Admin inserta gestion_ordenes"   ON gestion_ordenes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin elimina gestion_ordenes"   ON gestion_ordenes FOR DELETE USING (public.is_admin());

-- gestion_documentos: todos los autenticados leen, solo admin escribe
CREATE POLICY "Lectura publica gestion_documentos" ON gestion_documentos FOR SELECT USING (true);
CREATE POLICY "Admin inserta gestion_documentos"   ON gestion_documentos FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin elimina gestion_documentos"   ON gestion_documentos FOR DELETE USING (public.is_admin());
