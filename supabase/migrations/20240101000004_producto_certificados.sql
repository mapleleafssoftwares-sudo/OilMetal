-- Tabla muchos-a-muchos: productos <-> certificados
CREATE TABLE IF NOT EXISTS public.producto_certificados (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id    UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    certificado_id UUID NOT NULL REFERENCES public.certificados(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(producto_id, certificado_id)
);

ALTER TABLE public.producto_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura publica de producto_certificados"
    ON public.producto_certificados FOR SELECT USING (true);

CREATE POLICY "Solo admin puede insertar producto_certificados"
    ON public.producto_certificados FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin puede eliminar producto_certificados"
    ON public.producto_certificados FOR DELETE USING (public.is_admin());

-- Migrar asignaciones existentes desde la FK certificado_id
INSERT INTO public.producto_certificados (producto_id, certificado_id)
SELECT id, certificado_id FROM public.productos WHERE certificado_id IS NOT NULL
ON CONFLICT DO NOTHING;
