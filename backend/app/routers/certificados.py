from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Query
from app.schemas.schemas import CertificadoResponse, UserProfile
from app.routers.auth import get_current_admin, get_current_internal_user
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
import uuid

router = APIRouter(prefix="/certificados", tags=["certificados"])

SECTION_CONFIG = {
    "certificados": {"table": "certificados",      "bucket": "certificados"},
    "ordenes":      {"table": "ordenes_de_compra", "bucket": "Ordenes de Compra"},
    "remitos":      {"table": "remitos",            "bucket": "Remitos"},
}

ROL_TO_SECCIONES: dict = {
    "vendedor": ["ordenes"],
    "deposito": ["remitos"],
    "calidad":  ["certificados"],
}


def get_section_config(seccion: str) -> dict:
    cfg = SECTION_CONFIG.get(seccion)
    if not cfg:
        raise HTTPException(status_code=400, detail=f"Seccion no valida: {seccion}")
    return cfg


def assert_section_access(seccion: str, current_user: UserProfile):
    if current_user.rol == "admin":
        return
    allowed = ROL_TO_SECCIONES.get(current_user.rol)
    if allowed and seccion not in allowed:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta seccion.")


@router.get("/by-bucket/list")
def list_by_section(
    seccion: str = Query(...),
    current_user: UserProfile = Depends(get_current_internal_user)
):
    assert_section_access(seccion, current_user)
    cfg = get_section_config(seccion)
    supabase = get_supabase_admin_client()
    res = supabase.table(cfg["table"]).select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.post("/upload")
def upload_documento(
    nombre: str = Form(...),
    colada: str = Form(None),
    seccion: str = Form("certificados"),
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_internal_user)
):
    assert_section_access(seccion, current_user)
    cfg = get_section_config(seccion)
    supabase = get_supabase_admin_client()

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    storage_path = f"{uuid.uuid4()}_{file.filename}"

    try:
        file_content = file.file.read()
        supabase.storage.from_(cfg["bucket"]).upload(
            file=file_content,
            path=storage_path,
            file_options={"content-type": "application/pdf"}
        )
        public_url = supabase.storage.from_(cfg["bucket"]).get_public_url(storage_path)

        res = supabase.table(cfg["table"]).insert({
            "nombre": nombre,
            "colada": colada,
            "archivo_url": public_url,
            "storage_path": storage_path,
        }).execute()
        return res.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{seccion}/{id}")
def delete_documento(
    seccion: str,
    id: str,
    current_user: UserProfile = Depends(get_current_internal_user)
):
    assert_section_access(seccion, current_user)
    cfg = get_section_config(seccion)
    supabase = get_supabase_admin_client()

    res = supabase.table(cfg["table"]).select("storage_path").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    storage_path = res.data[0].get("storage_path")
    try:
        if storage_path:
            supabase.storage.from_(cfg["bucket"]).remove([storage_path])
        supabase.table(cfg["table"]).delete().eq("id", id).execute()
        return {"message": "Documento eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=CertificadoResponse)
def get_certificado(id: str):
    supabase = get_supabase_client()
    res = supabase.table("certificados").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return res.data[0]
