-- =========================================================
-- Migración: Arreglar políticas RLS para nuevos roles
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================================

-- 1. Función helper: usuario interno (admin, vendedor, deposito, calidad)
CREATE OR REPLACE FUNCTION public.is_internal() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'deposito', 'calidad')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- =========================================================
-- 2. certificados → admin o calidad pueden escribir
-- =========================================================
DROP POLICY IF EXISTS "Solo admin puede insertar certificados"  ON certificados;
DROP POLICY IF EXISTS "Solo admin puede actualizar certificados" ON certificados;
DROP POLICY IF EXISTS "Solo admin puede eliminar certificados"  ON certificados;

CREATE POLICY "Admin o calidad inserta certificados"
ON certificados FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'calidad')));

CREATE POLICY "Admin o calidad actualiza certificados"
ON certificados FOR UPDATE
USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'calidad')));

CREATE POLICY "Admin o calidad elimina certificados"
ON certificados FOR DELETE
USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'calidad')));

-- =========================================================
-- 3. ordenes_de_compra → admin o vendedor pueden escribir
-- =========================================================
DROP POLICY IF EXISTS "Solo admin puede insertar ordenes_de_compra" ON ordenes_de_compra;
DROP POLICY IF EXISTS "Solo admin puede eliminar ordenes_de_compra"  ON ordenes_de_compra;

CREATE POLICY "Admin o vendedor inserta ordenes_de_compra"
ON ordenes_de_compra FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor')));

CREATE POLICY "Admin o vendedor elimina ordenes_de_compra"
ON ordenes_de_compra FOR DELETE
USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor')));

-- =========================================================
-- 4. remitos → admin o deposito pueden escribir
-- =========================================================
DROP POLICY IF EXISTS "Solo admin puede insertar remitos" ON remitos;
DROP POLICY IF EXISTS "Solo admin puede eliminar remitos"  ON remitos;

CREATE POLICY "Admin o deposito inserta remitos"
ON remitos FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'deposito')));

CREATE POLICY "Admin o deposito elimina remitos"
ON remitos FOR DELETE
USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'deposito')));

-- =========================================================
-- 5. gestion_ordenes → admin o vendedor pueden insertar
-- =========================================================
DROP POLICY IF EXISTS "Admin inserta gestion_ordenes"  ON gestion_ordenes;
DROP POLICY IF EXISTS "Admin elimina gestion_ordenes"  ON gestion_ordenes;

CREATE POLICY "Admin o vendedor inserta gestion_ordenes"
ON gestion_ordenes FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor')));

CREATE POLICY "Admin elimina gestion_ordenes"
ON gestion_ordenes FOR DELETE
USING (public.is_admin());

-- =========================================================
-- 6. gestion_documentos → todos los internos pueden vincular/desvincular
-- =========================================================
DROP POLICY IF EXISTS "Admin inserta gestion_documentos"  ON gestion_documentos;
DROP POLICY IF EXISTS "Admin elimina gestion_documentos"  ON gestion_documentos;

CREATE POLICY "Internos insertan gestion_documentos"
ON gestion_documentos FOR INSERT
WITH CHECK (public.is_internal());

CREATE POLICY "Internos eliminan gestion_documentos"
ON gestion_documentos FOR DELETE
USING (public.is_internal());

-- =========================================================
-- 7. Storage: políticas para subir archivos por bucket
--    (aplica si el bucket no es público o tiene RLS habilitado)
-- =========================================================

-- Certificados bucket
DROP POLICY IF EXISTS "Internal upload certificados bucket" ON storage.objects;
CREATE POLICY "Internal upload certificados bucket"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'certificados' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'calidad'))
);

DROP POLICY IF EXISTS "Internal delete certificados bucket" ON storage.objects;
CREATE POLICY "Internal delete certificados bucket"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'certificados' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'calidad'))
);

-- Ordenes de Compra bucket
DROP POLICY IF EXISTS "Internal upload ordenes bucket" ON storage.objects;
CREATE POLICY "Internal upload ordenes bucket"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'Ordenes de Compra' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor'))
);

DROP POLICY IF EXISTS "Internal delete ordenes bucket" ON storage.objects;
CREATE POLICY "Internal delete ordenes bucket"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'Ordenes de Compra' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'vendedor'))
);

-- Remitos bucket
DROP POLICY IF EXISTS "Internal upload remitos bucket" ON storage.objects;
CREATE POLICY "Internal upload remitos bucket"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'Remitos' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'deposito'))
);

DROP POLICY IF EXISTS "Internal delete remitos bucket" ON storage.objects;
CREATE POLICY "Internal delete remitos bucket"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'Remitos' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'deposito'))
);
