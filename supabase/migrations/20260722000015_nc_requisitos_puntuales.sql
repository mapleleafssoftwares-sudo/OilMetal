-- =========================================================
-- Catálogo: Requisitos Puntuales
-- Lista administrable de requisitos puntuales que no se
-- cumplen, para seleccionar mediante buscador en el detalle
-- de la No Conformidad (igual que Sector/Tipo y Cargos).
-- =========================================================

CREATE TABLE IF NOT EXISTS requisitos_puntuales (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE requisitos_puntuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leen requisitos_puntuales"
ON requisitos_puntuales FOR SELECT
USING (public.is_internal());

CREATE POLICY "Admin inserta requisitos_puntuales"
ON requisitos_puntuales FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admin actualiza requisitos_puntuales"
ON requisitos_puntuales FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admin elimina requisitos_puntuales"
ON requisitos_puntuales FOR DELETE
USING (public.is_admin());
