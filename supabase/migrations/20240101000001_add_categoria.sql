-- Añadir columna de categoría a la tabla productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Otros';
