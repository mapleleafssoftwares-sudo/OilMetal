-- =========================================================
-- Migración: Nuevas tablas de documentos + limpieza
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Eliminar tablas que ya no se usan
DROP TABLE IF EXISTS producto_certificados CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;

-- 2. Crear tabla ordenes_de_compra (idéntica a certificados)
CREATE TABLE IF NOT EXISTS ordenes_de_compra (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre       TEXT NOT NULL,
    colada       TEXT,
    archivo_url  TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear tabla remitos (idéntica a certificados)
CREATE TABLE IF NOT EXISTS remitos (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre       TEXT NOT NULL,
    colada       TEXT,
    archivo_url  TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar RLS en las nuevas tablas
ALTER TABLE ordenes_de_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas para ordenes_de_compra
CREATE POLICY "Lectura publica de ordenes_de_compra"
ON ordenes_de_compra FOR SELECT USING (true);

CREATE POLICY "Solo admin puede insertar ordenes_de_compra"
ON ordenes_de_compra FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin puede eliminar ordenes_de_compra"
ON ordenes_de_compra FOR DELETE USING (public.is_admin());

-- 6. Políticas para remitos
CREATE POLICY "Lectura publica de remitos"
ON remitos FOR SELECT USING (true);

CREATE POLICY "Solo admin puede insertar remitos"
ON remitos FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin puede eliminar remitos"
ON remitos FOR DELETE USING (public.is_admin());

-- 7. (Opcional) Limpiar columna bucket de certificados si ya no se necesita
-- ALTER TABLE certificados DROP COLUMN IF EXISTS bucket;
-- Dejamos comentado por si hay datos existentes que dependen de ella.
