from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from typing import List
from app.schemas.schemas import CertificadoResponse, UserProfile
from app.routers.auth import get_current_admin
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from app.core.config import settings
import uuid

router = APIRouter(prefix="/certificados", tags=["certificados"])


@router.get("", response_model=List[CertificadoResponse])
def get_certificados():
    supabase = get_supabase_client()
    res = supabase.table("certificados").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.get("/{id}", response_model=CertificadoResponse)
def get_certificado(id: str):
    supabase = get_supabase_client()
    res = supabase.table("certificados").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return res.data[0]


@router.post("/upload", response_model=CertificadoResponse)
def upload_certificado(
    nombre: str = Form(...),
    colada: str = Form(None),
    file: UploadFile = File(...),
    current_user: UserProfile = Depends(get_current_admin)
):
    supabase = get_supabase_admin_client()

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    storage_path = f"{uuid.uuid4()}_{file.filename}"

    try:
        file_content = file.file.read()
        supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
            file=file_content,
            path=storage_path,
            file_options={"content-type": "application/pdf"}
        )
        public_url = supabase.storage.from_(settings.SUPABASE_BUCKET).get_public_url(storage_path)

        cert_data, _ = supabase.table("certificados").insert({
            "nombre": nombre,
            "colada": colada,
            "archivo_url": public_url,
            "storage_path": storage_path,
        }).execute()
        return cert_data[1][0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def delete_certificado(id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_admin_client()

    cert_res = supabase.table("certificados").select("storage_path").eq("id", id).execute()
    if not cert_res.data:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    storage_path = cert_res.data[0].get("storage_path")
    try:
        if storage_path:
            supabase.storage.from_(settings.SUPABASE_BUCKET).remove([storage_path])
        supabase.table("certificados").delete().eq("id", id).execute()
        return {"message": "Certificado eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
