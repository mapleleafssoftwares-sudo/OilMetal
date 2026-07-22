-- =========================================================
-- No Conformidades: Fecha de Reclamo
-- Fecha en la que el cliente realizó el reclamo, distinta
-- de fecha_apertura (que se asigna automáticamente al crear
-- la no conformidad).
-- =========================================================

ALTER TABLE no_conformidades
  ADD COLUMN IF NOT EXISTS fecha_reclamo DATE;
