-- =========================================================
-- Migración: Agregar campo observacion a gestion_documentos
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- Campo opcional de texto libre por documento vinculado
ALTER TABLE gestion_documentos ADD COLUMN IF NOT EXISTS observacion TEXT;

-- Política para que admin pueda actualizar (observacion)
CREATE POLICY "Admin actualiza gestion_documentos"
ON gestion_documentos FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
