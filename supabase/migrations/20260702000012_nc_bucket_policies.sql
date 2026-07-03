-- =========================================================
-- Bucket y politicas para adjuntos de No Conformidades
-- =========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('no-conformidades', 'no-conformidades', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Internos suben adjuntos NC" ON storage.objects;
CREATE POLICY "Internos suben adjuntos NC"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'no-conformidades'
    AND public.is_internal()
);

DROP POLICY IF EXISTS "Internos leen adjuntos NC" ON storage.objects;
CREATE POLICY "Internos leen adjuntos NC"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'no-conformidades'
    AND public.is_internal()
);

DROP POLICY IF EXISTS "Internos eliminan adjuntos NC" ON storage.objects;
CREATE POLICY "Internos eliminan adjuntos NC"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'no-conformidades'
    AND public.is_internal()
);
