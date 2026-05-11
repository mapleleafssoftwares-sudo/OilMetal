-- Ejecutar en Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_read_all" ON public.categorias
    FOR SELECT USING (true);

CREATE POLICY "categorias_all_service" ON public.categorias
    FOR ALL USING (true);

-- Insertar categorías iniciales
INSERT INTO public.categorias (nombre) VALUES
    ('Tubos y Cañerías'),
    ('Bridas'),
    ('Accesorios (Codo, Tee, Reducción)'),
    ('Válvulas'),
    ('Fijaciones y Bulonería'),
    ('Juntas y Sellados'),
    ('Instrumentación'),
    ('Repuestos de Válvulas'),
    ('Insumos Generales'),
    ('Otros')
ON CONFLICT (nombre) DO NOTHING;
