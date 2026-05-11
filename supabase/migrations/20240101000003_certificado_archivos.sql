-- Migración: Múltiples PDFs por certificado
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla de archivos vinculados a certificados
CREATE TABLE IF NOT EXISTS public.certificado_archivos (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificado_id UUID NOT NULL REFERENCES public.certificados(id) ON DELETE CASCADE,
    nombre         TEXT NOT NULL,
    archivo_url    TEXT NOT NULL,
    storage_path   TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.certificado_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de archivos de certificados"
ON public.certificado_archivos FOR SELECT USING (true);

CREATE POLICY "Solo admin puede insertar archivos de certificados"
ON public.certificado_archivos FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin puede eliminar archivos de certificados"
ON public.certificado_archivos FOR DELETE USING (public.is_admin());

-- 3. Migrar archivos existentes a la nueva tabla
INSERT INTO public.certificado_archivos (certificado_id, nombre, archivo_url, storage_path, created_at)
SELECT id, nombre, archivo_url, storage_path, created_at
FROM public.certificados
WHERE archivo_url IS NOT NULL AND archivo_url != '';

-- 4. Hacer opcionales las columnas de archivo en la tabla principal
--    (ya no son la fuente de verdad, los archivos viven en certificado_archivos)
ALTER TABLE public.certificados ALTER COLUMN archivo_url DROP NOT NULL;
ALTER TABLE public.certificados ALTER COLUMN storage_path DROP NOT NULL;
