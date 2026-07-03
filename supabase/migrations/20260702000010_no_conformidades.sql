-- =========================================================
-- Modulo de No Conformidades
-- =========================================================

-- Catalogo: Sector/Tipo
CREATE TABLE IF NOT EXISTS sectores_tipo (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogo: Cargos
CREATE TABLE IF NOT EXISTS cargos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cabecera y detalle principal de NC
CREATE TABLE IF NOT EXISTS no_conformidades (
    id BIGSERIAL PRIMARY KEY,
    sector_tipo_id BIGINT REFERENCES sectores_tipo(id),
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_cierre TIMESTAMPTZ,
    descripcion TEXT,
    evidencia_objetiva TEXT,
    solucion_inmediata TEXT,
    analisis_causa_raiz TEXT,
    accion_propuesta TEXT,
    plazo DATE,
    cumplimiento_accion BOOLEAN,
    cumplimiento_en_plazo BOOLEAN,
    created_by UUID REFERENCES perfiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (fecha_cierre IS NULL AND cumplimiento_accion IS NULL AND cumplimiento_en_plazo IS NULL)
        OR (fecha_cierre IS NOT NULL)
    )
);

-- Relacion NC <> Responsables (N a N)
CREATE TABLE IF NOT EXISTS nc_responsables (
    id BIGSERIAL PRIMARY KEY,
    no_conformidad_id BIGINT NOT NULL REFERENCES no_conformidades(id) ON DELETE CASCADE,
    cargo_id BIGINT NOT NULL REFERENCES cargos(id),
    UNIQUE (no_conformidad_id, cargo_id)
);

-- Adjuntos de NC (1 a N)
CREATE TABLE IF NOT EXISTS nc_archivos (
    id BIGSERIAL PRIMARY KEY,
    no_conformidad_id BIGINT NOT NULL REFERENCES no_conformidades(id) ON DELETE CASCADE,
    archivo_url TEXT NOT NULL,
    descripcion TEXT,
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE sectores_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_conformidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE nc_responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE nc_archivos ENABLE ROW LEVEL SECURITY;

-- lectura: usuarios internos
CREATE POLICY "Internos leen sectores_tipo"
ON sectores_tipo FOR SELECT
USING (public.is_internal());

CREATE POLICY "Internos leen cargos"
ON cargos FOR SELECT
USING (public.is_internal());

CREATE POLICY "Internos leen no_conformidades"
ON no_conformidades FOR SELECT
USING (public.is_internal());

CREATE POLICY "Internos leen nc_responsables"
ON nc_responsables FOR SELECT
USING (public.is_internal());

CREATE POLICY "Internos leen nc_archivos"
ON nc_archivos FOR SELECT
USING (public.is_internal());

-- catalogos: solo admin escribe
CREATE POLICY "Admin inserta sectores_tipo"
ON sectores_tipo FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admin actualiza sectores_tipo"
ON sectores_tipo FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admin elimina sectores_tipo"
ON sectores_tipo FOR DELETE
USING (public.is_admin());

CREATE POLICY "Admin inserta cargos"
ON cargos FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admin actualiza cargos"
ON cargos FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admin elimina cargos"
ON cargos FOR DELETE
USING (public.is_admin());

-- modulo NC: internos crean/actualizan, solo admin elimina
CREATE POLICY "Internos insertan no_conformidades"
ON no_conformidades FOR INSERT
WITH CHECK (public.is_internal());

CREATE POLICY "Internos actualizan no_conformidades"
ON no_conformidades FOR UPDATE
USING (public.is_internal());

CREATE POLICY "Admin elimina no_conformidades"
ON no_conformidades FOR DELETE
USING (public.is_admin());

CREATE POLICY "Internos insertan nc_responsables"
ON nc_responsables FOR INSERT
WITH CHECK (public.is_internal());

CREATE POLICY "Internos actualizan nc_responsables"
ON nc_responsables FOR UPDATE
USING (public.is_internal());

CREATE POLICY "Admin elimina nc_responsables"
ON nc_responsables FOR DELETE
USING (public.is_admin());

CREATE POLICY "Internos insertan nc_archivos"
ON nc_archivos FOR INSERT
WITH CHECK (public.is_internal());

CREATE POLICY "Internos actualizan nc_archivos"
ON nc_archivos FOR UPDATE
USING (public.is_internal());

CREATE POLICY "Admin elimina nc_archivos"
ON nc_archivos FOR DELETE
USING (public.is_admin());
