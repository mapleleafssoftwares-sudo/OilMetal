-- =========================================================
-- Catálogo: Costos de No Calidad
-- Lista administrable de conceptos de costo asociados a
-- no conformidades (igual patrón que Sector/Tipo, Cargos
-- y Requisitos Puntuales).
-- =========================================================

CREATE TABLE IF NOT EXISTS costos_no_calidad (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE costos_no_calidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leen costos_no_calidad"
ON costos_no_calidad FOR SELECT
USING (public.is_internal());

CREATE POLICY "Admin inserta costos_no_calidad"
ON costos_no_calidad FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admin actualiza costos_no_calidad"
ON costos_no_calidad FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admin elimina costos_no_calidad"
ON costos_no_calidad FOR DELETE
USING (public.is_admin());
