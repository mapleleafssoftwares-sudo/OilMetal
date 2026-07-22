-- =========================================================
-- Vinculación: No Conformidades <-> Gestor de Documentos
-- Agrega la FK orden_id a la tabla no_conformidades
-- que referencia a gestion_ordenes (carpetas del gestor).
-- =========================================================

ALTER TABLE no_conformidades
  ADD COLUMN IF NOT EXISTS orden_id UUID REFERENCES gestion_ordenes(id) ON DELETE SET NULL;

-- Índice para consultas de filtrado por carpeta
CREATE INDEX IF NOT EXISTS idx_no_conformidades_orden_id
  ON no_conformidades (orden_id);
