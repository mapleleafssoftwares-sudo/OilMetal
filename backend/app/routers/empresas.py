from fastapi import APIRouter, Depends, HTTPException
from app.schemas.schemas import UserProfile
from app.routers.auth import get_current_admin, get_current_user, get_current_internal_user
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/empresas", tags=["empresas"])

ROL_TO_TIPO: dict = {
    "vendedor": "orden_compra",
    "deposito": "remito",
    "calidad":  "certificado",
}


def assert_tipo_access(tipo: str, current_user: UserProfile):
    if current_user.rol == "admin":
        return
    allowed = ROL_TO_TIPO.get(current_user.rol)
    if allowed and tipo != allowed:
        raise HTTPException(status_code=403, detail="No tienes permiso para vincular este tipo de documento.")


class EmpresaCreate(BaseModel):
    nombre: str


# ── Empresas ──────────────────────────────────────────────────────────────────

@router.get("")
def list_empresas(current_user: UserProfile = Depends(get_current_user)):
    supabase = get_supabase_client()
    res = supabase.table("empresas").select("*").order("nombre").execute()
    return res.data or []


@router.post("")
def create_empresa(body: EmpresaCreate, current_user: UserProfile = Depends(get_current_admin)):
    if not body.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    supabase = get_supabase_admin_client()
    res = supabase.table("empresas").insert({"nombre": body.nombre.strip()}).execute()
    return res.data[0]


@router.delete("/{empresa_id}")
def delete_empresa(empresa_id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    supabase.table("empresas").delete().eq("id", empresa_id).execute()
    return {"message": "Empresa eliminada"}


# ── Órdenes de gestión (carpetas) ─────────────────────────────────────────────

@router.get("/ordenes")
def list_ordenes(current_user: UserProfile = Depends(get_current_user)):
    supabase = get_supabase_admin_client()
    query = (
        supabase.table("gestion_ordenes")
        .select("*, empresa:empresas(id, nombre)")
        .order("created_at", desc=True)
    )
    # Solo consultores (usuarios externos) ven únicamente sus carpetas de empresa
    if current_user.rol == "consultor":
        if not current_user.empresa_id:
            return []
        query = query.eq("empresa_id", str(current_user.empresa_id))
    res = query.execute()
    return res.data or []


class OrdenCreate(BaseModel):
    numero_orden: str
    empresa_id: str


@router.post("/ordenes")
def create_orden(body: OrdenCreate, current_user: UserProfile = Depends(get_current_internal_user)):
    if current_user.rol not in ("admin", "vendedor"):
        raise HTTPException(status_code=403, detail="No tienes permiso para crear órdenes.")
    numero_orden_clean = body.numero_orden.strip()
    if not numero_orden_clean:
        raise HTTPException(status_code=400, detail="El número de orden no puede estar vacío")
    
    supabase = get_supabase_admin_client()
    
    # Validar que el número de orden no exista
    existing = supabase.table("gestion_ordenes").select("id").eq("numero_orden", numero_orden_clean).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"El número de orden '{numero_orden_clean}' ya existe")
    
    try:
        res = supabase.table("gestion_ordenes").insert({
            "numero_orden": numero_orden_clean,
            "empresa_id": body.empresa_id,
        }).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear la orden: {str(e)}")


@router.delete("/ordenes/{orden_id}")
def delete_orden(orden_id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    supabase.table("gestion_ordenes").delete().eq("id", orden_id).execute()
    return {"message": "Orden eliminada"}


# ── Documentos vinculados a una orden ────────────────────────────────────────

@router.get("/ordenes/{orden_id}/documentos")
def list_documentos_orden(orden_id: str, current_user: UserProfile = Depends(get_current_user)):
    supabase = get_supabase_client()
    res = (
        supabase.table("gestion_documentos")
        .select("*")
        .eq("orden_id", orden_id)
        .order("tipo")
        .execute()
    )
    links = res.data or []

    # Para cada link, traemos los datos del documento
    result = []
    for link in links:
        tipo = link["tipo"]
        doc_id = link["documento_id"]
        table_map = {
            "certificado": "certificados",
            "orden_compra": "ordenes_de_compra",
            "remito": "remitos",
        }
        table = table_map.get(tipo)
        if not table:
            continue
        doc_res = supabase.table(table).select("*").eq("id", str(doc_id)).execute()
        if doc_res.data:
            doc = doc_res.data[0]
            doc["__tipo"] = tipo
            doc["__link_id"] = link["id"]
            doc["__link_created_at"] = link["created_at"]  # Fecha de vinculación
            doc["__observacion"] = link.get("observacion") or ""
            result.append(doc)
    return result


class DocumentoLink(BaseModel):
    tipo: str        # 'certificado' | 'orden_compra' | 'remito'
    documento_id: str
    observacion: Optional[str] = None


@router.post("/ordenes/{orden_id}/documentos")
def link_documento(orden_id: str, body: DocumentoLink, current_user: UserProfile = Depends(get_current_internal_user)):
    if body.tipo not in ("certificado", "orden_compra", "remito"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    assert_tipo_access(body.tipo, current_user)
    supabase = get_supabase_admin_client()
    try:
        payload = {
            "orden_id": orden_id,
            "tipo": body.tipo,
            "documento_id": body.documento_id,
        }
        if body.observacion is not None:
            payload["observacion"] = body.observacion.strip()
        res = supabase.table("gestion_documentos").insert(payload).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail="Documento ya vinculado u otro error: " + str(e))


class DocumentoObservacion(BaseModel):
    observacion: Optional[str] = None


@router.patch("/ordenes/{orden_id}/documentos/{link_id}")
def update_observacion(orden_id: str, link_id: str, body: DocumentoObservacion, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    supabase.table("gestion_documentos").update({
        "observacion": body.observacion.strip() if body.observacion else None
    }).eq("id", link_id).eq("orden_id", orden_id).execute()
    return {"message": "Observación actualizada"}


@router.delete("/ordenes/{orden_id}/documentos/{link_id}")
def unlink_documento(orden_id: str, link_id: str, current_user: UserProfile = Depends(get_current_internal_user)):
    # Fetch the link to know the tipo before deleting
    supabase = get_supabase_admin_client()
    link_res = supabase.table("gestion_documentos").select("tipo").eq("id", link_id).execute()
    if link_res.data:
        assert_tipo_access(link_res.data[0]["tipo"], current_user)
    supabase.table("gestion_documentos").delete().eq("id", link_id).eq("orden_id", orden_id).execute()
    return {"message": "Documento desvinculado"}
