-- Migración: Agregar nuevos roles (vendedor, deposito, calidad)
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. Eliminar el constraint existente y reemplazarlo con uno que incluya los nuevos roles
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('admin', 'consultor', 'vendedor', 'deposito', 'calidad'));
