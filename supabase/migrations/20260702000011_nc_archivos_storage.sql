-- =========================================================
-- Agrega metadata de storage para adjuntos de NC
-- =========================================================

ALTER TABLE nc_archivos ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE nc_archivos ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'no-conformidades';
