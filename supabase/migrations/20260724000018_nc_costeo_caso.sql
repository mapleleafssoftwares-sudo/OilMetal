-- =========================================================
-- Costeo del Caso: Monto de la Orden de Compra + costos de
-- no calidad asociados a cada No Conformidad, para calcular
-- la utilidad neta del caso.
-- =========================================================

ALTER TABLE no_conformidades
  ADD COLUMN IF NOT EXISTS monto_orden_compra NUMERIC(14,2);

CREATE TABLE IF NOT EXISTS nc_costos (
    id BIGSERIAL PRIMARY KEY,
    no_conformidad_id BIGINT NOT NULL REFERENCES no_conformidades(id) ON DELETE CASCADE,
    costo_no_calidad_id BIGINT NOT NULL REFERENCES costos_no_calidad(id),
    monto NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nc_costos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leen nc_costos"
ON nc_costos FOR SELECT
USING (public.is_internal());

CREATE POLICY "Internos insertan nc_costos"
ON nc_costos FOR INSERT
WITH CHECK (public.is_internal());

CREATE POLICY "Internos actualizan nc_costos"
ON nc_costos FOR UPDATE
USING (public.is_internal());

CREATE POLICY "Admin elimina nc_costos"
ON nc_costos FOR DELETE
USING (public.is_admin());
