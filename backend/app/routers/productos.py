from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.schemas.schemas import ProductoResponse, ProductoConCertificadoResponse, ProductoCreate, ProductoUpdate, UserProfile
from app.routers.auth import get_current_admin, get_current_user
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client

router = APIRouter(prefix="/productos", tags=["productos"])

@router.get("", response_model=List[ProductoConCertificadoResponse])
def get_productos(
    search: Optional[str] = Query(None, description="Buscar por nombre"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría")
):
    supabase = get_supabase_client()
    query = supabase.table("productos").select("*")
    if search:
        query = query.ilike("nombre", f"%{search}%")
    if categoria and categoria != "Todas":
        query = query.eq("categoria", categoria)

    all_data = []
    limit = 1000
    offset = 0
    while True:
        res = query.range(offset, offset + limit - 1).execute()
        if not res.data:
            break
        all_data.extend(res.data)
        if len(res.data) < limit:
            break
        offset += limit

    if not all_data:
        return []

    prod_ids = [p["id"] for p in all_data]
    certificados_by_producto: dict = {}

    try:
        # Intentar leer tabla muchos-a-muchos
        pc_res = supabase.table("producto_certificados").select("*").in_("producto_id", prod_ids).execute()
        pc_rows = pc_res.data or []
        cert_ids = list({row["certificado_id"] for row in pc_rows})
        if cert_ids:
            certs_res = supabase.table("certificados").select("*").in_("id", cert_ids).execute()
            certs_map = {c["id"]: c for c in (certs_res.data or [])}
        else:
            certs_map = {}
        for row in pc_rows:
            pid = row["producto_id"]
            cert = certs_map.get(row["certificado_id"])
            if cert:
                certificados_by_producto.setdefault(pid, []).append(cert)
    except Exception:
        # Fallback: usar FK certificado_id directa
        cert_ids_fk = list({p.get("certificado_id") for p in all_data if p.get("certificado_id")})
        if cert_ids_fk:
            certs_res = supabase.table("certificados").select("*").in_("id", cert_ids_fk).execute()
            certs_map = {c["id"]: c for c in (certs_res.data or [])}
            for p in all_data:
                cid = p.get("certificado_id")
                if cid and cid in certs_map:
                    certificados_by_producto[p["id"]] = [certs_map[cid]]

    for p in all_data:
        p["certificados"] = certificados_by_producto.get(p["id"], [])

    return all_data

@router.get("/{id}", response_model=ProductoConCertificadoResponse)
def get_producto(id: str):
    supabase = get_supabase_client()
    res = supabase.table("productos").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    producto = res.data[0]

    try:
        pc_res = supabase.table("producto_certificados").select("*").eq("producto_id", id).execute()
        pc_rows = pc_res.data or []
        cert_ids = [row["certificado_id"] for row in pc_rows]
        if cert_ids:
            certs_res = supabase.table("certificados").select("*").in_("id", cert_ids).execute()
            producto["certificados"] = certs_res.data or []
        else:
            producto["certificados"] = []
    except Exception:
        cid = producto.get("certificado_id")
        if cid:
            cert_res = supabase.table("certificados").select("*").eq("id", cid).execute()
            producto["certificados"] = cert_res.data or []
        else:
            producto["certificados"] = []

    return producto

@router.post("/{id}/certificados/{cert_id}")
def agregar_certificado(
    id: str,
    cert_id: str,
    current_user: UserProfile = Depends(get_current_admin)
):
    supabase = get_supabase_admin_client()
    prod_res = supabase.table("productos").select("id").eq("id", id).execute()
    if not prod_res.data:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    cert_res = supabase.table("certificados").select("id").eq("id", cert_id).execute()
    if not cert_res.data:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    try:
        supabase.table("producto_certificados").upsert({
            "producto_id": id,
            "certificado_id": cert_id,
        }, on_conflict="producto_id,certificado_id").execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Certificado asignado"}

@router.delete("/{id}/certificados/{cert_id}")
def quitar_certificado(
    id: str,
    cert_id: str,
    current_user: UserProfile = Depends(get_current_admin)
):
    supabase = get_supabase_admin_client()
    supabase.table("producto_certificados").delete().eq("producto_id", id).eq("certificado_id", cert_id).execute()
    return {"message": "Certificado quitado"}

@router.put("/{id}/categoria", response_model=ProductoResponse)
def asignar_categoria(
    id: str,
    categoria: str = Query(..., description="Nombre de la categoría"),
    current_user: UserProfile = Depends(get_current_admin)
):
    supabase = get_supabase_client()
    res, count = supabase.table("productos").update({"categoria": categoria}).eq("id", id).execute()
    if not res[1]:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return res[1][0]

@router.post("", response_model=ProductoResponse)
def crear_producto(producto: ProductoCreate, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_client()
    res, count = supabase.table("productos").insert(producto.model_dump(exclude_unset=True)).execute()
    return res[1][0]

@router.delete("/{id}")
def eliminar_producto(id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_client()
    res, count = supabase.table("productos").delete().eq("id", id).execute()
    if not res[1]:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}
