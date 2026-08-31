from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.schemas import UserProfile
from app.routers.auth import get_current_admin, get_current_user, get_current_internal_user
from app.routers.no_conformidades import _to_detail_model
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


def _build_archive_filename(nombre: Optional[str], filename: str) -> str:
    """Nombre del archivo dentro del ZIP: prioriza el nombre visible del
    documento, pero siempre conserva la extensión real (ej. .pdf) — el
    nombre del documento en la base no suele incluirla."""
    base = _sanitize_zip_name(nombre or filename)
    if not Path(base).suffix:
        ext = Path(filename).suffix or ".pdf"
        base = f"{base}{ext}"
    return base


def _esc(value) -> str:
    s = "" if value is None else str(value)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _nl2br(value) -> str:
    return _esc(value).replace("\n", "<br>")


def _format_fecha_zip(value) -> str:
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    s = str(value)
    try:
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            y, m, d = s.split("-")
            return f"{d}/{m}/{y}"
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return s


def _si_no_zip(value) -> str:
    if value is None:
        return "—"
    return "SI" if value else "NO"


def _build_nc_informe_html(nc) -> str:
    """Réplica en Python (para el export en ZIP) del informe A4 que se genera
    en el navegador desde frontend/src/utils/informeNoConformidad.ts."""
    responsables = ", ".join(r.nombre for r in (nc.responsables or [])) or "—"

    cierre_html = ""
    if nc.cumplimiento_accion is not None:
        cierre_html = f"""
        <table class="tabla">
          <tr><th class="label">¿Acción cumplida?</th><td>{_si_no_zip(nc.cumplimiento_accion)}</td>
              <th class="label">¿En plazo?</th><td>{_si_no_zip(nc.cumplimiento_en_plazo)}</td></tr>
        </table>"""

    if nc.archivos:
        archivos_rows = "".join(
            f"""<tr>
                  <td class="center">{i + 1}</td>
                  <td>{_esc(a.descripcion or f"Adjunto #{a.id}")}</td>
                  <td class="center">{_format_fecha_zip(a.fecha_subida)}</td>
                  <td class="center">{f'<a class="enlace" href="{_esc(a.archivo_url)}">Ver archivo</a>' if a.archivo_url else '—'}</td>
                </tr>"""
            for i, a in enumerate(nc.archivos)
        )
    else:
        archivos_rows = '<tr><td colspan="4" class="center vacio">Sin archivos adjuntos</td></tr>'

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe NC-{_esc(nc.numero_secuencial)}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color: #111; background: #fff; margin: 0; }}
  .hoja {{ width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 16mm; }}
  .encabezado {{ border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 4px; }}
  .empresa {{ font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #444; }}
  .titulo {{ font-size: 19px; font-weight: bold; margin-top: 2px; }}
  .meta {{ display: flex; justify-content: space-between; font-size: 11px; color: #444; margin-bottom: 14px; font-family: Arial, sans-serif; }}
  h2.seccion {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #111; padding-bottom: 3px; margin: 18px 0 6px; font-family: Arial, sans-serif; }}
  table.tabla {{ width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 4px; }}
  table.tabla th, table.tabla td {{ border: 1px solid #999; padding: 6px 8px; vertical-align: top; text-align: left; }}
  table.tabla th.label {{ width: 22%; background: #f2f2f2; font-weight: bold; font-family: Arial, sans-serif; font-size: 10.5px; text-transform: uppercase; }}
  table.tabla td.contenido {{ white-space: pre-wrap; }}
  table.tabla td.center, table.tabla th.center {{ text-align: center; }}
  table.tabla td.vacio {{ color: #777; font-style: italic; }}
  .enlace {{ color: #111; text-decoration: underline; font-family: Arial, sans-serif; font-size: 11.5px; font-weight: bold; }}
  .pie {{ margin-top: 24px; padding-top: 8px; border-top: 1px solid #999; display: flex; justify-content: space-between; font-size: 10px; color: #666; font-family: Arial, sans-serif; }}
  @media print {{ @page {{ size: A4; margin: 12mm; }} }}
</style>
</head>
<body>
  <div class="hoja">
    <div class="encabezado">
      <div class="empresa">OilMetal &mdash; Sistema de Gestión de Calidad</div>
      <div class="titulo">Informe de No Conformidad N&deg; {_esc(nc.numero_secuencial)}</div>
    </div>
    <div class="meta">
      <span>Estado: <strong>{_esc(nc.estado)}</strong></span>
      <span>Emitido: {_esc(datetime.now().strftime('%d/%m/%Y %H:%M'))}</span>
    </div>

    <h2 class="seccion">Datos Generales</h2>
    <table class="tabla">
      <tr>
        <th class="label">Sector / Tipo</th><td>{_esc(nc.sector_tipo_nombre) or '—'}</td>
        <th class="label">Carpeta vinculada</th><td>{_esc(nc.orden_numero) or '—'}</td>
      </tr>
      <tr>
        <th class="label">Fecha de apertura</th><td>{_format_fecha_zip(nc.fecha_reclamo or nc.fecha_apertura)}</td>
        <th class="label">Plazo de cierre</th><td>{_format_fecha_zip(nc.plazo)}</td>
      </tr>
      <tr>
        <th class="label">Fecha de cierre</th><td>{_format_fecha_zip(nc.fecha_cierre)}</td>
        <th class="label">Responsables</th><td>{responsables}</td>
      </tr>
    </table>

    <h2 class="seccion">Desarrollo de la No Conformidad</h2>
    <table class="tabla">
      <tr><th class="label">1. Descripción</th><td class="contenido">{_nl2br(nc.descripcion) or '—'}</td></tr>
      <tr><th class="label">2. Requisito No Cumplido</th><td class="contenido">{_nl2br(nc.evidencia_objetiva) or '—'}</td></tr>
      <tr><th class="label">3. Solución Inmediata</th><td class="contenido">{_nl2br(nc.solucion_inmediata) or '—'}</td></tr>
      <tr><th class="label">4. Análisis de Causa Raíz</th><td class="contenido">{_nl2br(nc.analisis_causa_raiz) or '—'}</td></tr>
      <tr><th class="label">5. Acción Propuesta</th><td class="contenido">{_nl2br(nc.accion_propuesta) or '—'}</td></tr>
    </table>

    {f'<h2 class="seccion">Evaluación de Cierre</h2>{cierre_html}' if cierre_html else ''}

    <h2 class="seccion">Archivos Adjuntos</h2>
    <table class="tabla">
      <tr>
        <th class="label center" style="width:8%">#</th>
        <th class="label">Descripción</th>
        <th class="label center" style="width:18%">Fecha de carga</th>
        <th class="label center" style="width:18%">Archivo</th>
      </tr>
      {archivos_rows}
    </table>

    <div class="pie">
      <span>Documento generado automáticamente por el sistema de Gestión de Calidad de OilMetal.</span>
      <span>NC-{_esc(nc.numero_secuencial)}</span>
    </div>
  </div>
</body>
</html>"""


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
                archive_name = f"{folder_path}/{_build_archive_filename(doc.get('nombre'), filename)}"
                try:
                    content = _download_url_content(archivo_url)
                    zip_file.writestr(archive_name, content)
                except Exception as exc:
                    zip_file.writestr(f"{folder_path}/ERROR_{_sanitize_zip_name(doc.get('nombre') or filename)}.txt", f"No se pudo descargar el archivo: {exc}")

            # Informe de No Conformidades vinculadas a esta carpeta (solo casos
            # efectivamente marcados como No Conformidad, igual que en la vista web)
            nc_res = (
                supabase.table("no_conformidades")
                .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, es_no_conformidad, orden_id, monto_orden_compra, sector_tipo:sectores_tipo(id, nombre)")
                .eq("orden_id", orden_id)
                .eq("es_no_conformidad", True)
                .order("id")
                .execute()
            )
            for nc_row in (nc_res.data or []):
                nc_detail = _to_detail_model(supabase, nc_row)
                nc_folder = f"{base_folder}/{empresa_folder}/{numero_orden}/No Conformidades"
                nc_archive_name = f"{nc_folder}/Informe_NC_{nc_detail.numero_secuencial}.html"
                zip_file.writestr(nc_archive_name, _build_nc_informe_html(nc_detail).encode("utf-8"))

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


@router.get("/ordenes/{orden_id}/zip")
def export_orden_zip(orden_id: str, current_user: UserProfile = Depends(get_current_user)):
    supabase = get_supabase_admin_client()

    orden_res = supabase.table("gestion_ordenes").select("id, numero_orden, empresa_id, empresa:empresas(id, nombre)").eq("id", orden_id).limit(1).execute()
    if not orden_res.data:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    orden = orden_res.data[0]

    # Consultor solo puede descargar ordenes de su empresa
    if current_user.rol == "consultor":
        if not current_user.empresa_id or str(current_user.empresa_id) != str(orden.get("empresa_id")):
            raise HTTPException(status_code=403, detail="No tienes permiso para descargar esta carpeta")

    numero_orden = _sanitize_zip_name(str(orden.get("numero_orden") or orden_id))
    empresa = orden.get("empresa") or {}
    if isinstance(empresa, list):
        empresa = empresa[0] if empresa else {}
    empresa_nombre = _sanitize_zip_name(empresa.get("nombre") or "Empresa")

    docs_res = (
        supabase.table("gestion_documentos")
        .select("id, tipo, documento_id, observacion, created_at")
        .eq("orden_id", orden_id)
        .order("tipo")
        .execute()
    )
    links = docs_res.data or []

    # No Conformidades vinculadas a esta carpeta (solo casos efectivamente
    # marcados como tal, igual que en la vista web)
    nc_res = (
        supabase.table("no_conformidades")
        .select("id, sector_tipo_id, fecha_apertura, fecha_cierre, fecha_reclamo, descripcion, evidencia_objetiva, solucion_inmediata, analisis_causa_raiz, accion_propuesta, plazo, cumplimiento_accion, cumplimiento_en_plazo, es_no_conformidad, orden_id, monto_orden_compra, sector_tipo:sectores_tipo(id, nombre)")
        .eq("orden_id", orden_id)
        .eq("es_no_conformidad", True)
        .order("id")
        .execute()
    )
    nc_rows = nc_res.data or []

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        if not links and not nc_rows:
            zip_file.writestr(f"{numero_orden}/README.txt", "No hay documentos en esta carpeta.")
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
            folder_path = f"{numero_orden}/{tipo_label}"
            archive_name = f"{folder_path}/{_build_archive_filename(doc.get('nombre'), filename)}"
            try:
                content = _download_url_content(archivo_url)
                zip_file.writestr(archive_name, content)
            except Exception as exc:
                zip_file.writestr(f"{folder_path}/ERROR_{_sanitize_zip_name(doc.get('nombre') or filename)}.txt", f"No se pudo descargar el archivo: {exc}")

        for nc_row in nc_rows:
            nc_detail = _to_detail_model(supabase, nc_row)
            nc_folder = f"{numero_orden}/No Conformidades"
            nc_archive_name = f"{nc_folder}/Informe_NC_{nc_detail.numero_secuencial}.html"
            zip_file.writestr(nc_archive_name, _build_nc_informe_html(nc_detail).encode("utf-8"))

    buffer.seek(0)
    zip_filename = f"{numero_orden}.zip"
    headers = {"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)


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
