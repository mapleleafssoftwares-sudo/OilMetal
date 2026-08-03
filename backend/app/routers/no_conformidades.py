from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import os
import uuid
import re
import unicodedata
from app.schemas.schemas import (
    UserProfile,
    SectorTipoCreate,
    CargoCreate,
    RequisitoPuntualCreate,
    CostoNoCalidadCreate,
    NoConformidadCreate,
    NoConformidadListItem,
    NoConformidadDetail,
    NoConformidadUpdate,
    NoConformidadResponsablesUpdate,
    NoConformidadCloseRequest,
    NoConformidadResponsable,
    NoConformidadArchivo,
    NcCosto,
    NcCostoCreate,
    NcCostoUpdate,
    DashboardConteoItem,
    DashboardCostoConceptoItem,
    DashboardClienteItem,
    DashboardVendedorItem,
    NoConformidadesDashboard,
)
from app.routers.auth import get_current_admin, get_current_internal_user, get_current_user
from app.core.supabase_client import get_supabase_admin_client
from app.core.config import settings

router = APIRouter(prefix="/no-conformidades", tags=["no-conformidades"])


def _sanitize_storage_filename(filename: str) -> str:
    # Supabase Storage rejects keys with some special characters.
    # Convert to ASCII, replace unsupported chars and keep extension.
    base = os.path.basename(filename or "adjunto")
    normalized = unicodedata.normalize("NFKD", base)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", ascii_name).strip("._")
    return safe or "adjunto"


def _to_date_only(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value[:10]
    return str(value)[:10]


def _estado_no_conformidad(row) -> str:
    if row.get("fecha_cierre"):
        return "Resuelto"
    return "En proceso"


def _get_nc_or_404(supabase, nc_id: int):
    res = (
        supabase.table("no_conformidades")
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, es_no_conformidad, orden_id, monto_orden_compra, sector_tipo:sectores_tipo(id, nombre)")
        .eq("id", nc_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="No Conformidad no encontrada")
    return res.data[0]


def _get_responsables(supabase, nc_id: int):
    res = (
        supabase.table("nc_responsables")
        .select("cargo_id, cargo:cargos(id, nombre)")
        .eq("no_conformidad_id", nc_id)
        .execute()
    )
    data = res.data or []
    result = []
    for row in data:
        cargo = row.get("cargo") or {}
        if isinstance(cargo, list):
            cargo = cargo[0] if cargo else {}
        if cargo.get("id") is not None:
            result.append(NoConformidadResponsable(id=cargo["id"], nombre=cargo.get("nombre") or ""))
    return result


def _get_archivos(supabase, nc_id: int):
    res = (
        supabase.table("nc_archivos")
        .select("id, archivo_url, descripcion, fecha_subida")
        .eq("no_conformidad_id", nc_id)
        .order("fecha_subida", desc=True)
        .execute()
    )
    return [NoConformidadArchivo(**row) for row in (res.data or [])]


def _get_costos(supabase, nc_id: int):
    res = (
        supabase.table("nc_costos")
        .select("id, costo_no_calidad_id, monto, costo_no_calidad:costos_no_calidad(id, nombre)")
        .eq("no_conformidad_id", nc_id)
        .order("id")
        .execute()
    )
    result = []
    for row in (res.data or []):
        costo = row.get("costo_no_calidad") or {}
        if isinstance(costo, list):
            costo = costo[0] if costo else {}
        result.append(NcCosto(
            id=row["id"],
            costo_no_calidad_id=row["costo_no_calidad_id"],
            costo_no_calidad_nombre=costo.get("nombre"),
            monto=float(row.get("monto") or 0),
        ))
    return result


def _resolve_orden_numero(supabase, orden_id):
    """Resolve the numero_orden for a given orden_id UUID."""
    if not orden_id:
        return None
    try:
        res = supabase.table("gestion_ordenes").select("numero_orden").eq("id", str(orden_id)).limit(1).execute()
        if res.data:
            return res.data[0].get("numero_orden")
    except Exception:
        pass
    return None


def _get_numero_secuencial(supabase, nc_id: int) -> int:
    """Número de caso secuencial y sin saltos (posición cronológica), pensado
    para mostrar en auditorías en vez del id interno de la base de datos."""
    res = (
        supabase.table("no_conformidades")
        .select("id")
        .lte("id", nc_id)
        .execute()
    )
    return len(res.data or []) or 1


def _to_detail_model(supabase, row):
    sector = row.get("sector_tipo") or {}
    if isinstance(sector, list):
        sector = sector[0] if sector else {}
    orden_id = row.get("orden_id")
    orden_numero = _resolve_orden_numero(supabase, orden_id)
    return NoConformidadDetail(
        id=row["id"],
        numero_secuencial=_get_numero_secuencial(supabase, row["id"]),
        sector_tipo_id=row.get("sector_tipo_id"),
        sector_tipo_nombre=sector.get("nombre"),
        fecha_apertura=row["fecha_apertura"],
        fecha_cierre=row.get("fecha_cierre"),
        fecha_reclamo=_to_date_only(row.get("fecha_reclamo")),
        descripcion=row.get("descripcion"),
        evidencia_objetiva=row.get("evidencia_objetiva"),
        solucion_inmediata=row.get("solucion_inmediata"),
        analisis_causa_raiz=row.get("analisis_causa_raiz"),
        accion_propuesta=row.get("accion_propuesta"),
        plazo=_to_date_only(row.get("plazo")),
        cumplimiento_accion=row.get("cumplimiento_accion"),
        cumplimiento_en_plazo=row.get("cumplimiento_en_plazo"),
        estado=_estado_no_conformidad(row),
        responsables=_get_responsables(supabase, row["id"]),
        archivos=_get_archivos(supabase, row["id"]),
        es_no_conformidad=row.get("es_no_conformidad", True),
        orden_id=str(orden_id) if orden_id else None,
        orden_numero=orden_numero,
        monto_orden_compra=(float(row["monto_orden_compra"]) if row.get("monto_orden_compra") is not None else None),
        costos=_get_costos(supabase, row["id"]),
    )


@router.get("/by-orden/{orden_id}", response_model=list[NoConformidadDetail])
def list_no_conformidades_by_orden(orden_id: str, current_user: UserProfile = Depends(get_current_user)):
    """Devuelve las no conformidades vinculadas a una carpeta (orden) del gestor de documentos.

    Los consultores (usuarios externos) solo pueden ver las no conformidades
    de carpetas que pertenezcan a su propia empresa.
    """
    supabase = get_supabase_admin_client()

    if current_user.rol == "consultor":
        orden_res = supabase.table("gestion_ordenes").select("empresa_id").eq("id", orden_id).limit(1).execute()
        if not orden_res.data or str(orden_res.data[0].get("empresa_id")) != str(current_user.empresa_id):
            raise HTTPException(status_code=403, detail="No tenés acceso a esta carpeta")

    res = (
        supabase.table("no_conformidades")
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, es_no_conformidad, orden_id, monto_orden_compra, sector_tipo:sectores_tipo(id, nombre)")
        .eq("orden_id", orden_id)
        # Solo se muestran en la carpeta del gestor de documentos los casos
        # efectivamente marcados como No Conformidad (no simples Reclamos).
        .eq("es_no_conformidad", True)
        .order("id", desc=True)
        .execute()
    )
    rows = res.data or []
    return [_to_detail_model(supabase, row) for row in rows]


@router.get("/{nc_id}/archivos", response_model=list[NoConformidadArchivo])
def list_no_conformidad_archivos(nc_id: int, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    _get_nc_or_404(supabase, nc_id)
    return _get_archivos(supabase, nc_id)


@router.post("/{nc_id}/archivos", response_model=NoConformidadArchivo)
def upload_no_conformidad_archivo(
    nc_id: int,
    file: UploadFile = File(...),
    descripcion: str = Form(""),
    current_user: UserProfile = Depends(get_current_internal_user),
):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para modificar adjuntos")

    bucket = settings.SUPABASE_NC_BUCKET
    filename = file.filename or "adjunto"
    safe_name = _sanitize_storage_filename(filename)
    storage_path = f"nc/{nc_id}/{uuid.uuid4()}_{safe_name}"

    try:
        content = file.file.read()
        supabase.storage.from_(bucket).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
        public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
        ins = supabase.table("nc_archivos").insert({
            "no_conformidad_id": nc_id,
            "archivo_url": public_url,
            "descripcion": descripcion.strip() or None,
            "storage_path": storage_path,
            "bucket": bucket,
        }).execute()
        if not ins.data:
            raise HTTPException(status_code=400, detail="No se pudo registrar el adjunto")
        return NoConformidadArchivo(**ins.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo subir el archivo: {str(e)}")


@router.delete("/{nc_id}/archivos/{archivo_id}")
def delete_no_conformidad_archivo(
    nc_id: int,
    archivo_id: int,
    current_user: UserProfile = Depends(get_current_internal_user),
):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para modificar adjuntos")

    row_res = (
        supabase.table("nc_archivos")
        .select("id, storage_path, bucket")
        .eq("id", archivo_id)
        .eq("no_conformidad_id", nc_id)
        .limit(1)
        .execute()
    )
    if not row_res.data:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")

    row = row_res.data[0]
    bucket = row.get("bucket") or settings.SUPABASE_NC_BUCKET
    storage_path = row.get("storage_path")

    try:
        if storage_path:
            supabase.storage.from_(bucket).remove([storage_path])
        supabase.table("nc_archivos").delete().eq("id", archivo_id).eq("no_conformidad_id", nc_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el adjunto: {str(e)}")


@router.get("/{nc_id}/costos", response_model=list[NcCosto])
def list_no_conformidad_costos(nc_id: int, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    _get_nc_or_404(supabase, nc_id)
    return _get_costos(supabase, nc_id)


@router.post("/{nc_id}/costos", response_model=NcCosto)
def create_no_conformidad_costo(nc_id: int, body: NcCostoCreate, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para modificar el costeo")

    costo_res = (
        supabase.table("costos_no_calidad")
        .select("id, activo")
        .eq("id", body.costo_no_calidad_id)
        .limit(1)
        .execute()
    )
    if not costo_res.data or not costo_res.data[0].get("activo", False):
        raise HTTPException(status_code=400, detail="Costo de No Calidad inválido o inactivo")

    ins = supabase.table("nc_costos").insert({
        "no_conformidad_id": nc_id,
        "costo_no_calidad_id": body.costo_no_calidad_id,
        "monto": body.monto,
    }).execute()
    if not ins.data:
        raise HTTPException(status_code=400, detail="No se pudo agregar el costo")

    costos = _get_costos(supabase, nc_id)
    nuevo = next((c for c in costos if c.id == ins.data[0]["id"]), None)
    if not nuevo:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el costo creado")
    return nuevo


@router.put("/{nc_id}/costos/{costo_id}", response_model=NcCosto)
def update_no_conformidad_costo(nc_id: int, costo_id: int, body: NcCostoUpdate, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para modificar el costeo")

    res = (
        supabase.table("nc_costos")
        .update({"monto": body.monto})
        .eq("id", costo_id)
        .eq("no_conformidad_id", nc_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Costo no encontrado")

    costos = _get_costos(supabase, nc_id)
    actualizado = next((c for c in costos if c.id == costo_id), None)
    if not actualizado:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el costo actualizado")
    return actualizado


@router.delete("/{nc_id}/costos/{costo_id}")
def delete_no_conformidad_costo(nc_id: int, costo_id: int, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para modificar el costeo")

    res = (
        supabase.table("nc_costos")
        .delete()
        .eq("id", costo_id)
        .eq("no_conformidad_id", nc_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Costo no encontrado")
    return {"ok": True}


@router.get("/sectores-tipo")
def list_sectores_tipo(activos: bool = True, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    query = supabase.table("sectores_tipo").select("id, nombre, activo").order("nombre")
    if activos:
        query = query.eq("activo", True)
    res = query.execute()
    return res.data or []


@router.post("/sectores-tipo")
def create_sector_tipo(body: SectorTipoCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("sectores_tipo").insert({"nombre": nombre, "activo": True}).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el Sector/Tipo: {str(e)}")


@router.put("/sectores-tipo/{sector_tipo_id}")
def update_sector_tipo(sector_tipo_id: int, body: SectorTipoCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    res = (
        supabase.table("sectores_tipo")
        .update({"nombre": nombre})
        .eq("id", sector_tipo_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Sector/Tipo no encontrado")
    return res.data[0]


@router.delete("/sectores-tipo/{sector_tipo_id}")
def deactivate_sector_tipo(sector_tipo_id: int, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    res = (
        supabase.table("sectores_tipo")
        .update({"activo": False})
        .eq("id", sector_tipo_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Sector/Tipo no encontrado")
    return {"ok": True}


@router.get("/cargos")
def list_cargos(activos: bool = True, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    query = supabase.table("cargos").select("id, nombre, activo").order("nombre")
    if activos:
        query = query.eq("activo", True)
    res = query.execute()
    return res.data or []


@router.post("/cargos")
def create_cargo(body: CargoCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("cargos").insert({"nombre": nombre, "activo": True}).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el cargo: {str(e)}")


@router.put("/cargos/{cargo_id}")
def update_cargo(cargo_id: int, body: CargoCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    res = supabase.table("cargos").update({"nombre": nombre}).eq("id", cargo_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    return res.data[0]


@router.delete("/cargos/{cargo_id}")
def deactivate_cargo(cargo_id: int, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    res = supabase.table("cargos").update({"activo": False}).eq("id", cargo_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    return {"ok": True}


@router.get("/requisitos-puntuales")
def list_requisitos_puntuales(activos: bool = True, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    query = supabase.table("requisitos_puntuales").select("id, nombre, activo").order("nombre")
    if activos:
        query = query.eq("activo", True)
    res = query.execute()
    return res.data or []


@router.post("/requisitos-puntuales")
def create_requisito_puntual(body: RequisitoPuntualCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("requisitos_puntuales").insert({"nombre": nombre, "activo": True}).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el Requisito Puntual: {str(e)}")


@router.put("/requisitos-puntuales/{requisito_id}")
def update_requisito_puntual(requisito_id: int, body: RequisitoPuntualCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    res = supabase.table("requisitos_puntuales").update({"nombre": nombre}).eq("id", requisito_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Requisito Puntual no encontrado")
    return res.data[0]


@router.delete("/requisitos-puntuales/{requisito_id}")
def deactivate_requisito_puntual(requisito_id: int, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    res = supabase.table("requisitos_puntuales").update({"activo": False}).eq("id", requisito_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Requisito Puntual no encontrado")
    return {"ok": True}


@router.get("/costos-no-calidad")
def list_costos_no_calidad(activos: bool = True, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    query = supabase.table("costos_no_calidad").select("id, nombre, activo").order("nombre")
    if activos:
        query = query.eq("activo", True)
    res = query.execute()
    return res.data or []


@router.post("/costos-no-calidad")
def create_costo_no_calidad(body: CostoNoCalidadCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("costos_no_calidad").insert({"nombre": nombre, "activo": True}).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear el Costo de No Calidad: {str(e)}")


@router.put("/costos-no-calidad/{costo_id}")
def update_costo_no_calidad(costo_id: int, body: CostoNoCalidadCreate, current_user: UserProfile = Depends(get_current_admin)):
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    res = supabase.table("costos_no_calidad").update({"nombre": nombre}).eq("id", costo_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Costo de No Calidad no encontrado")
    return res.data[0]


@router.delete("/costos-no-calidad/{costo_id}")
def deactivate_costo_no_calidad(costo_id: int, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    res = supabase.table("costos_no_calidad").update({"activo": False}).eq("id", costo_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Costo de No Calidad no encontrado")
    return {"ok": True}


@router.get("/ordenes-disponibles")
def list_ordenes_disponibles(current_user: UserProfile = Depends(get_current_internal_user)):
    """Devuelve las carpetas (ordenes) del gestor de documentos para el selector de vinculación."""
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("gestion_ordenes").select("id, numero_orden, empresa_id, empresa:empresas(id, nombre)").order("numero_orden").execute()
        result = []
        for row in (res.data or []):
            empresa = row.get("empresa") or {}
            if isinstance(empresa, list):
                empresa = empresa[0] if empresa else {}
            result.append({
                "id": str(row["id"]),
                "numero_orden": row.get("numero_orden"),
                "empresa_nombre": empresa.get("nombre"),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron obtener las carpetas: {str(e)}")


@router.get("/dashboard", response_model=NoConformidadesDashboard)
def get_dashboard(current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()

    nc_res = (
        supabase.table("no_conformidades")
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, es_no_conformidad, orden_id, created_by, monto_orden_compra, cumplimiento_en_plazo, sector_tipo:sectores_tipo(id, nombre)")
        .execute()
    )
    casos = nc_res.data or []

    total_casos = len(casos)
    total_no_conformidades = sum(1 for c in casos if c.get("es_no_conformidad", True))
    total_reclamos = total_casos - total_no_conformidades
    casos_resueltos = sum(1 for c in casos if c.get("fecha_cierre"))
    casos_en_proceso = total_casos - casos_resueltos
    casos_con_carpeta = sum(1 for c in casos if c.get("orden_id"))

    sector_counts: dict = {}
    for c in casos:
        sector = c.get("sector_tipo") or {}
        if isinstance(sector, list):
            sector = sector[0] if sector else {}
        nombre = sector.get("nombre") or "Sin sector"
        sector_counts[nombre] = sector_counts.get(nombre, 0) + 1
    por_sector = [
        DashboardConteoItem(nombre=k, cantidad=v)
        for k, v in sorted(sector_counts.items(), key=lambda x: -x[1])
    ]

    orden_ids = list({c.get("orden_id") for c in casos if c.get("orden_id")})
    empresa_por_orden: dict = {}
    if orden_ids:
        ord_res = (
            supabase.table("gestion_ordenes")
            .select("id, empresa:empresas(nombre)")
            .in_("id", orden_ids)
            .execute()
        )
        for o in (ord_res.data or []):
            empresa = o.get("empresa") or {}
            if isinstance(empresa, list):
                empresa = empresa[0] if empresa else {}
            empresa_por_orden[str(o["id"])] = empresa.get("nombre")

    creador_ids = list({c.get("created_by") for c in casos if c.get("created_by")})
    nombre_por_creador: dict = {}
    if creador_ids:
        perfiles_res = supabase.table("perfiles").select("id, nombre").in_("id", creador_ids).execute()
        for p in (perfiles_res.data or []):
            nombre_por_creador[str(p["id"])] = p.get("nombre")

    nc_ids = [c["id"] for c in casos]
    costos_rows = []
    if nc_ids:
        costos_res = (
            supabase.table("nc_costos")
            .select("no_conformidad_id, monto, costo_no_calidad:costos_no_calidad(nombre)")
            .in_("no_conformidad_id", nc_ids)
            .execute()
        )
        costos_rows = costos_res.data or []

    costos_por_caso: dict = {}
    concepto_totales: dict = {}
    costos_no_calidad_total = 0.0
    for row in costos_rows:
        monto = float(row.get("monto") or 0)
        costos_no_calidad_total += monto
        nc_id = row.get("no_conformidad_id")
        costos_por_caso[nc_id] = costos_por_caso.get(nc_id, 0.0) + monto
        concepto = row.get("costo_no_calidad") or {}
        if isinstance(concepto, list):
            concepto = concepto[0] if concepto else {}
        nombre_concepto = concepto.get("nombre") or "Sin concepto"
        concepto_totales[nombre_concepto] = concepto_totales.get(nombre_concepto, 0.0) + monto

    costos_por_concepto = [
        DashboardCostoConceptoItem(nombre=k, monto=round(v, 2))
        for k, v in sorted(concepto_totales.items(), key=lambda x: -x[1])
    ]

    monto_total_oc = sum(float(c.get("monto_orden_compra") or 0) for c in casos)
    utilidad_neta_total = monto_total_oc - costos_no_calidad_total
    porcentaje_impacto_costos = (
        round((costos_no_calidad_total / monto_total_oc) * 100, 2) if monto_total_oc > 0 else None
    )

    cliente_stats: dict = {}
    for c in casos:
        orden_id = c.get("orden_id")
        if not orden_id:
            continue
        empresa_nombre = empresa_por_orden.get(str(orden_id)) or "Sin empresa"
        stats = cliente_stats.setdefault(empresa_nombre, {"cantidad": 0, "monto_oc": 0.0, "costos": 0.0})
        stats["cantidad"] += 1
        stats["monto_oc"] += float(c.get("monto_orden_compra") or 0)
        stats["costos"] += costos_por_caso.get(c["id"], 0.0)
    por_cliente = [
        DashboardClienteItem(
            nombre=k,
            cantidad_casos=v["cantidad"],
            monto_oc=round(v["monto_oc"], 2),
            costos_no_calidad=round(v["costos"], 2),
        )
        for k, v in sorted(cliente_stats.items(), key=lambda x: -x[1]["cantidad"])
    ]

    vendedor_counts: dict = {}
    for c in casos:
        created_by = c.get("created_by")
        nombre = nombre_por_creador.get(str(created_by)) if created_by else None
        nombre = nombre or "Sin asignar"
        vendedor_counts[nombre] = vendedor_counts.get(nombre, 0) + 1
    por_vendedor = [
        DashboardVendedorItem(nombre=k, cantidad_casos=v)
        for k, v in sorted(vendedor_counts.items(), key=lambda x: -x[1])
    ]

    resueltos = [c for c in casos if c.get("fecha_cierre")]
    en_plazo_count = sum(1 for c in resueltos if c.get("cumplimiento_en_plazo"))
    porcentaje_en_plazo = round((en_plazo_count / len(resueltos)) * 100, 2) if resueltos else None

    dias_totales = []
    for c in resueltos:
        try:
            apertura = datetime.fromisoformat(str(c["fecha_apertura"]).replace("Z", "+00:00"))
            cierre = datetime.fromisoformat(str(c["fecha_cierre"]).replace("Z", "+00:00"))
            dias_totales.append((cierre - apertura).total_seconds() / 86400)
        except Exception:
            continue
    dias_promedio_resolucion = round(sum(dias_totales) / len(dias_totales), 1) if dias_totales else None

    return NoConformidadesDashboard(
        total_casos=total_casos,
        total_no_conformidades=total_no_conformidades,
        total_reclamos=total_reclamos,
        casos_en_proceso=casos_en_proceso,
        casos_resueltos=casos_resueltos,
        casos_con_carpeta_vinculada=casos_con_carpeta,
        por_sector=por_sector,
        monto_total_oc=round(monto_total_oc, 2),
        costos_no_calidad_total=round(costos_no_calidad_total, 2),
        utilidad_neta_total=round(utilidad_neta_total, 2),
        porcentaje_impacto_costos=porcentaje_impacto_costos,
        costos_por_concepto=costos_por_concepto,
        por_cliente=por_cliente,
        por_vendedor=por_vendedor,
        porcentaje_en_plazo=porcentaje_en_plazo,
        dias_promedio_resolucion=dias_promedio_resolucion,
    )


@router.get("", response_model=list[NoConformidadListItem])
def list_no_conformidades(current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    res = (
        supabase.table("no_conformidades")
        .select("id, fecha_apertura, fecha_cierre, plazo, sector_tipo_id, es_no_conformidad, orden_id, created_by, sector_tipo:sectores_tipo(id, nombre)")
        .order("id", desc=True)
        .execute()
    )
    rows = res.data or []

    # Batch-resolve orden -> numero_orden y empresa, para evitar N+1 queries
    orden_ids = list({row.get("orden_id") for row in rows if row.get("orden_id")})
    orden_numero_map: dict = {}
    empresa_map: dict = {}
    if orden_ids:
        try:
            ord_res = (
                supabase.table("gestion_ordenes")
                .select("id, numero_orden, empresa:empresas(nombre)")
                .in_("id", orden_ids)
                .execute()
            )
            for o in (ord_res.data or []):
                orden_numero_map[str(o["id"])] = o.get("numero_orden")
                empresa = o.get("empresa") or {}
                if isinstance(empresa, list):
                    empresa = empresa[0] if empresa else {}
                empresa_map[str(o["id"])] = empresa.get("nombre")
        except Exception:
            pass

    # Batch-resolve created_by -> nombre del usuario que creó el caso
    creador_ids = list({row.get("created_by") for row in rows if row.get("created_by")})
    creador_map: dict = {}
    if creador_ids:
        try:
            perfiles_res = supabase.table("perfiles").select("id, nombre").in_("id", creador_ids).execute()
            for p in (perfiles_res.data or []):
                creador_map[str(p["id"])] = p.get("nombre")
        except Exception:
            pass

    # Numeración secuencial y sin saltos, según orden cronológico de creación
    numero_map = {row_id: idx + 1 for idx, row_id in enumerate(sorted(row["id"] for row in rows))}

    result = []
    for row in rows:
        sector = row.get("sector_tipo") or {}
        orden_id = row.get("orden_id")
        created_by = row.get("created_by")
        result.append(
            NoConformidadListItem(
                id=row["id"],
                numero_secuencial=numero_map[row["id"]],
                fecha_apertura=row["fecha_apertura"],
                fecha_cierre=row.get("fecha_cierre"),
                plazo=row.get("plazo"),
                sector_tipo_id=row.get("sector_tipo_id"),
                sector_tipo_nombre=sector.get("nombre"),
                estado=_estado_no_conformidad(row),
                es_no_conformidad=row.get("es_no_conformidad", True),
                orden_id=str(orden_id) if orden_id else None,
                orden_numero=orden_numero_map.get(str(orden_id)) if orden_id else None,
                empresa_nombre=empresa_map.get(str(orden_id)) if orden_id else None,
                created_by_nombre=creador_map.get(str(created_by)) if created_by else None,
            )
        )
    return result


@router.post("", response_model=NoConformidadListItem)
def create_no_conformidad(body: NoConformidadCreate, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()

    sector_res = (
        supabase.table("sectores_tipo")
        .select("id, nombre, activo")
        .eq("id", body.sector_tipo_id)
        .limit(1)
        .execute()
    )
    if not sector_res.data:
        raise HTTPException(status_code=400, detail="Sector/Tipo inexistente")
    if not sector_res.data[0].get("activo", False):
        raise HTTPException(status_code=400, detail="Sector/Tipo inactivo")

    payload = {
        "sector_tipo_id": body.sector_tipo_id,
        "created_by": str(current_user.id),
        "fecha_apertura": datetime.now(timezone.utc).isoformat(),
    }
    if body.plazo:
        payload["plazo"] = body.plazo

    ins = supabase.table("no_conformidades").insert(payload).execute()
    if not ins.data:
        raise HTTPException(status_code=400, detail="No se pudo crear la No Conformidad")

    row = ins.data[0]
    sector_nombre = sector_res.data[0].get("nombre")
    return NoConformidadListItem(
        id=row["id"],
        numero_secuencial=_get_numero_secuencial(supabase, row["id"]),
        fecha_apertura=row["fecha_apertura"],
        fecha_cierre=row.get("fecha_cierre"),
        plazo=_to_date_only(row.get("plazo")),
        sector_tipo_id=row.get("sector_tipo_id"),
        sector_tipo_nombre=sector_nombre,
        estado=_estado_no_conformidad(row),
        created_by_nombre=current_user.nombre,
    )


@router.get("/{nc_id}", response_model=NoConformidadDetail)
def get_no_conformidad_detail(nc_id: int, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    row = _get_nc_or_404(supabase, nc_id)
    return _to_detail_model(supabase, row)


@router.put("/{nc_id}", response_model=NoConformidadDetail)
def update_no_conformidad(nc_id: int, body: NoConformidadUpdate, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para editar")

    patch = {}
    for field in ("descripcion", "evidencia_objetiva", "solucion_inmediata", "analisis_causa_raiz", "accion_propuesta"):
        value = getattr(body, field)
        if value is not None:
            patch[field] = value.strip() if isinstance(value, str) else value

    if body.sector_tipo_id is not None:
        sector_res = (
            supabase.table("sectores_tipo")
            .select("id, activo")
            .eq("id", body.sector_tipo_id)
            .limit(1)
            .execute()
        )
        if not sector_res.data or not sector_res.data[0].get("activo", False):
            raise HTTPException(status_code=400, detail="Sector/Tipo inválido")
        patch["sector_tipo_id"] = body.sector_tipo_id

    if body.plazo is not None:
        patch["plazo"] = body.plazo or None

    # fecha_reclamo, monto_orden_compra y orden_id son campos que el frontend
    # envía siempre (incluso como null para "borrar"/"desvincular"), por eso se
    # chequea si vinieron en el body (model_fields_set) en vez de "is not None":
    # un null explícito debe limpiar el campo, no ser ignorado.
    provided = body.model_fields_set

    if "fecha_reclamo" in provided:
        patch["fecha_reclamo"] = body.fecha_reclamo or None

    if body.es_no_conformidad is not None:
        patch["es_no_conformidad"] = body.es_no_conformidad

    if "monto_orden_compra" in provided:
        patch["monto_orden_compra"] = body.monto_orden_compra

    # Vincular / desvincular carpeta del gestor de documentos
    if "orden_id" in provided:
        if not body.orden_id:
            patch["orden_id"] = None
        else:
            # Verificar que la orden existe
            try:
                ord_res = supabase.table("gestion_ordenes").select("id").eq("id", body.orden_id).limit(1).execute()
                if not ord_res.data:
                    raise HTTPException(status_code=400, detail="Carpeta (orden) no encontrada")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=400, detail="Error al verificar la carpeta")
            patch["orden_id"] = body.orden_id

    if patch:
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("no_conformidades").update(patch).eq("id", nc_id).execute()

    updated = _get_nc_or_404(supabase, nc_id)
    return _to_detail_model(supabase, updated)


@router.put("/{nc_id}/responsables", response_model=NoConformidadDetail)
def set_no_conformidad_responsables(nc_id: int, body: NoConformidadResponsablesUpdate, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)
    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso está cerrado. Reabrilo para editar responsables")

    clean_ids = sorted(set(body.cargo_ids))
    if clean_ids:
        cargos = (
            supabase.table("cargos")
            .select("id")
            .in_("id", clean_ids)
            .eq("activo", True)
            .execute()
        )
        found = {c["id"] for c in (cargos.data or [])}
        if found != set(clean_ids):
            raise HTTPException(status_code=400, detail="Uno o más cargos son inválidos o inactivos")

    supabase.table("nc_responsables").delete().eq("no_conformidad_id", nc_id).execute()

    if clean_ids:
        payload = [{"no_conformidad_id": nc_id, "cargo_id": cargo_id} for cargo_id in clean_ids]
        supabase.table("nc_responsables").insert(payload).execute()

    updated = _get_nc_or_404(supabase, nc_id)
    return _to_detail_model(supabase, updated)


@router.post("/{nc_id}/cerrar", response_model=NoConformidadDetail)
def close_no_conformidad(nc_id: int, body: NoConformidadCloseRequest, current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    current = _get_nc_or_404(supabase, nc_id)

    if current.get("fecha_cierre"):
        raise HTTPException(status_code=400, detail="El caso ya está cerrado")

    required_text = [
        current.get("descripcion"),
        current.get("evidencia_objetiva"),
        current.get("solucion_inmediata"),
        current.get("analisis_causa_raiz"),
        current.get("accion_propuesta"),
    ]
    if not current.get("sector_tipo_id") or not current.get("plazo"):
        raise HTTPException(status_code=400, detail="Faltan campos obligatorios para cerrar el caso")
    if any(not (v or "").strip() for v in required_text):
        raise HTTPException(status_code=400, detail="Faltan campos obligatorios para cerrar el caso")

    responsables = _get_responsables(supabase, nc_id)
    if not responsables:
        raise HTTPException(status_code=400, detail="Debe asignar al menos un responsable para cerrar el caso")

    supabase.table("no_conformidades").update({
        "fecha_cierre": datetime.now(timezone.utc).isoformat(),
        "cumplimiento_accion": body.cumplimiento_accion,
        "cumplimiento_en_plazo": body.cumplimiento_en_plazo,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", nc_id).execute()

    updated = _get_nc_or_404(supabase, nc_id)
    return _to_detail_model(supabase, updated)


@router.post("/{nc_id}/reabrir", response_model=NoConformidadDetail)
def reopen_no_conformidad(nc_id: int, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    _get_nc_or_404(supabase, nc_id)

    supabase.table("no_conformidades").update({
        "fecha_cierre": None,
        "cumplimiento_accion": None,
        "cumplimiento_en_plazo": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", nc_id).execute()

    updated = _get_nc_or_404(supabase, nc_id)
    return _to_detail_model(supabase, updated)
