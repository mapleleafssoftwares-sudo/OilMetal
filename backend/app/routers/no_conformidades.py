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
    NoConformidadCreate,
    NoConformidadListItem,
    NoConformidadDetail,
    NoConformidadUpdate,
    NoConformidadResponsablesUpdate,
    NoConformidadCloseRequest,
    NoConformidadResponsable,
    NoConformidadArchivo,
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
        return "Cerrada"
    if row.get("plazo"):
        return "En proceso"
    return "Abierta"


def _get_nc_or_404(supabase, nc_id: int):
    res = (
        supabase.table("no_conformidades")
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, orden_id, sector_tipo:sectores_tipo(id, nombre)")
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


def _to_detail_model(supabase, row):
    sector = row.get("sector_tipo") or {}
    if isinstance(sector, list):
        sector = sector[0] if sector else {}
    orden_id = row.get("orden_id")
    orden_numero = _resolve_orden_numero(supabase, orden_id)
    return NoConformidadDetail(
        id=row["id"],
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
        orden_id=str(orden_id) if orden_id else None,
        orden_numero=orden_numero,
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
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, orden_id, sector_tipo:sectores_tipo(id, nombre)")
        .eq("orden_id", orden_id)
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


@router.get("", response_model=list[NoConformidadListItem])
def list_no_conformidades(current_user: UserProfile = Depends(get_current_internal_user)):
    supabase = get_supabase_admin_client()
    res = (
        supabase.table("no_conformidades")
        .select("id, fecha_apertura, fecha_cierre, plazo, sector_tipo_id, orden_id, sector_tipo:sectores_tipo(id, nombre)")
        .order("id", desc=True)
        .execute()
    )
    rows = res.data or []

    # Batch-resolve orden numbers to avoid N+1 queries
    orden_ids = list({row.get("orden_id") for row in rows if row.get("orden_id")})
    orden_map: dict = {}
    if orden_ids:
        try:
            ord_res = supabase.table("gestion_ordenes").select("id, numero_orden").in_("id", orden_ids).execute()
            for o in (ord_res.data or []):
                orden_map[str(o["id"])] = o.get("numero_orden")
        except Exception:
            pass

    result = []
    for row in rows:
        sector = row.get("sector_tipo") or {}
        orden_id = row.get("orden_id")
        result.append(
            NoConformidadListItem(
                id=row["id"],
                fecha_apertura=row["fecha_apertura"],
                fecha_cierre=row.get("fecha_cierre"),
                plazo=row.get("plazo"),
                sector_tipo_id=row.get("sector_tipo_id"),
                sector_tipo_nombre=sector.get("nombre"),
                estado=_estado_no_conformidad(row),
                orden_id=str(orden_id) if orden_id else None,
                orden_numero=orden_map.get(str(orden_id)) if orden_id else None,
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
        fecha_apertura=row["fecha_apertura"],
        fecha_cierre=row.get("fecha_cierre"),
        plazo=_to_date_only(row.get("plazo")),
        sector_tipo_id=row.get("sector_tipo_id"),
        sector_tipo_nombre=sector_nombre,
        estado=_estado_no_conformidad(row),
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

    if body.fecha_reclamo is not None:
        patch["fecha_reclamo"] = body.fecha_reclamo or None

    # Vincular / desvincular carpeta del gestor de documentos
    if body.orden_id is not None:
        if body.orden_id == "":
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
