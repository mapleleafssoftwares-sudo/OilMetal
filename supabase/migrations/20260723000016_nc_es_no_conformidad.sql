-- =========================================================
-- No Conformidades: distinguir Reclamo vs No Conformidad
-- Permite marcar si el caso es efectivamente una No Conformidad
-- o simplemente un Reclamo en seguimiento.
-- =========================================================

ALTER TABLE no_conformidades
  ADD COLUMN IF NOT EXISTS es_no_conformidad BOOLEAN NOT NULL DEFAULT TRUE;
