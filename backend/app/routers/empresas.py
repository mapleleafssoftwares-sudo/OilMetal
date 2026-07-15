from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.schemas import UserProfile
from app.routers.auth import get_current_admin, get_current_user, get_current_internal_user
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
import httpx
import zipfile
import re

router = APIRouter(prefix="/empresas", tags=["empresas"])

ROL_TO_TIPO: dict = {
    "vendedor": "orden_compra",
    "deposito": "remito",
    "calidad":  "certificado",
}

TIPO_LABEL_ZIP: dict[str, str] = {
    "certificado": "Certificaciones",
    "orden_compra": "Ordenes de Compra",
    "remito": "Remitos y Pedidos",
}


def assert_tipo_access(tipo: str, current_user: UserProfile):
    if current_user.rol == "admin":
        return
    allowed = ROL_TO_TIPO.get(current_user.rol)
    if allowed and tipo != allowed:
        raise HTTPException(status_code=403, detail="No tienes permiso para vincular este tipo de documento.")


def _sanitize_zip_name(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._ -]+", "_", value or "repositorio").strip().strip(".")
    return safe or "repositorio"


def _download_url_content(url: str) -> bytes:
    response = httpx.get(url, follow_redirects=True, timeout=60)
    response.raise_for_status()
    return response.content


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


@router.get("/repositorio.zip")
def export_repositorio_zip(current_user: UserProfile = Depends(get_current_user)):
    supabase = get_supabase_admin_client()

    empresa_id = current_user.empresa_id if current_user.rol == "consultor" else current_user.empresa_id
    if not empresa_id and current_user.rol == "consultor":
        raise HTTPException(status_code=400, detail="Tu cuenta no tiene una empresa asignada")

    empresa_nombre = None
    if empresa_id:
        empresa_res = supabase.table("empresas").select("id, nombre").eq("id", str(empresa_id)).limit(1).execute()
        if empresa_res.data:
            empresa_nombre = empresa_res.data[0].get("nombre")

    orden_query = supabase.table("gestion_ordenes").select("id, numero_orden, empresa_id, empresa:empresas(id, nombre)").order("created_at", desc=True)
    if empresa_id:
        orden_query = orden_query.eq("empresa_id", str(empresa_id))

    ordenes_res = orden_query.execute()
    ordenes = ordenes_res.data or []

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        base_folder = _sanitize_zip_name(empresa_nombre or f"repositorio_{current_user.id}")
        if not ordenes:
            zip_file.writestr(f"{base_folder}/README.txt", "No hay carpetas ni documentos para exportar.")
        for orden in ordenes:
            orden_id = orden["id"]
            numero_orden = _sanitize_zip_name(str(orden.get("numero_orden") or orden_id))
            empresa = orden.get("empresa") or {}
            if isinstance(empresa, list):
                empresa = empresa[0] if empresa else {}
            empresa_folder = _sanitize_zip_name(empresa.get("nombre") or empresa_nombre or "Empresa")

            docs_res = (
                supabase.table("gestion_documentos")
                .select("id, tipo, documento_id, observacion, created_at")
                .eq("orden_id", orden_id)
                .order("tipo")
                .execute()
            )
            links = docs_res.data or []

            for link in links:
                tipo = link.get("tipo")
                tipo_label = TIPO_LABEL_ZIP.get(tipo, tipo or "Documentos")
                doc_id = link.get("documento_id")
                table_map = {
                    "certificado": "certificados",
                    "orden_compra": "ordenes_de_compra",
                    "remito": "remitos",
                }
                table = table_map.get(tipo)
                if not table:
                    continue

                doc_res = supabase.table(table).select("*").eq("id", str(doc_id)).limit(1).execute()
                if not doc_res.data:
                    continue

                doc = doc_res.data[0]
                archivo_url = doc.get("archivo_url")
                if not archivo_url:
                    continue

                parsed = urlparse(archivo_url)
                filename = Path(parsed.path).name or f"documento_{doc.get('id')}"
                if not Path(filename).suffix:
                    filename = f"{filename}.pdf"

                folder_path = f"{base_folder}/{empresa_folder}/{numero_orden}/{tipo_label}"
                archive_name = f"{folder_path}/{_sanitize_zip_name(doc.get('nombre') or filename)}"
                try:
                    content = _download_url_content(archivo_url)
                    zip_file.writestr(archive_name, content)
                except Exception as exc:
                    zip_file.writestr(f"{folder_path}/ERROR_{_sanitize_zip_name(doc.get('nombre') or filename)}.txt", f"No se pudo descargar el archivo: {exc}")

    buffer.seek(0)
    filename = f"{_sanitize_zip_name(empresa_nombre or 'repositorio')}.zip"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)


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
