-- Agregar columna bucket a certificados para soportar múltiples buckets de storage
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'certificados';
