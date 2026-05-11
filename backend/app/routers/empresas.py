from fastapi import APIRouter, Depends, HTTPException
from app.schemas.schemas import UserProfile
from app.routers.auth import get_current_admin, get_current_user
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/empresas", tags=["empresas"])


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
    supabase = get_supabase_client()
    query = (
        supabase.table("gestion_ordenes")
        .select("*, empresa:empresas(id, nombre)")
        .order("created_at", desc=True)
    )
    # Consultores solo ven las carpetas de su empresa
    if current_user.rol != "admin":
        if not current_user.empresa_id:
            return []
        query = query.eq("empresa_id", str(current_user.empresa_id))
    res = query.execute()
    return res.data or []


class OrdenCreate(BaseModel):
    numero_orden: str
    empresa_id: str


@router.post("/ordenes")
def create_orden(body: OrdenCreate, current_user: UserProfile = Depends(get_current_admin)):
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
            result.append(doc)
    return result


class DocumentoLink(BaseModel):
    tipo: str        # 'certificado' | 'orden_compra' | 'remito'
    documento_id: str


@router.post("/ordenes/{orden_id}/documentos")
def link_documento(orden_id: str, body: DocumentoLink, current_user: UserProfile = Depends(get_current_admin)):
    if body.tipo not in ("certificado", "orden_compra", "remito"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    supabase = get_supabase_admin_client()
    try:
        res = supabase.table("gestion_documentos").insert({
            "orden_id": orden_id,
            "tipo": body.tipo,
            "documento_id": body.documento_id,
        }).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail="Documento ya vinculado u otro error: " + str(e))


@router.delete("/ordenes/{orden_id}/documentos/{link_id}")
def unlink_documento(orden_id: str, link_id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()
    supabase.table("gestion_documentos").delete().eq("id", link_id).eq("orden_id", orden_id).execute()
    return {"message": "Documento desvinculado"}
