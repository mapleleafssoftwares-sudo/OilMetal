-- =========================================================
-- Migración: Persistencia de campo observacion en gestion_documentos
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Agregar la columna si no existe
ALTER TABLE gestion_documentos ADD COLUMN IF NOT EXISTS observacion TEXT;

-- 2. Eliminar política de UPDATE preexistente si fue creada antes (evitar errores de duplicado)
DROP POLICY IF EXISTS "Admin actualiza gestion_documentos" ON gestion_documentos;

-- 3. Política de UPDATE: cualquier usuario interno autenticado puede actualizar observaciones
--    (el backend valida con get_current_admin, pero el cliente admin de Supabase
--     usa service_role que bypasea RLS de todas formas)
CREATE POLICY "Admin actualiza gestion_documentos"
ON gestion_documentos FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Verificar que la columna existe y tiene el tipo correcto
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gestion_documentos'
  AND column_name = 'observacion';
