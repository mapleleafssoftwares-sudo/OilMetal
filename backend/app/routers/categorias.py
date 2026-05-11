from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.schemas.schemas import CategoriaCreate, CategoriaResponse, UserProfile
from app.routers.auth import get_current_admin
from app.core.supabase_client import get_supabase_client

router = APIRouter(prefix="/categorias", tags=["categorias"])

@router.get("", response_model=List[CategoriaResponse])
def get_categorias():
    supabase = get_supabase_client()
    res = supabase.table("categorias").select("*").order("nombre").execute()
    return res.data

@router.post("", response_model=CategoriaResponse)
def crear_categoria(categoria: CategoriaCreate, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_client()
    try:
        res, _ = supabase.table("categorias").insert({"nombre": categoria.nombre, "descripcion": categoria.descripcion}).execute()
        return res[1][0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear categoría: {str(e)}")

@router.put("/{id}", response_model=CategoriaResponse)
def actualizar_categoria(id: str, categoria: CategoriaCreate, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_client()
    try:
        res, _ = supabase.table("categorias").update({"nombre": categoria.nombre, "descripcion": categoria.descripcion}).eq("id", id).execute()
        if not res[1]:
            raise HTTPException(status_code=404, detail="Categoría no encontrada")
        return res[1][0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")

@router.delete("/{id}")
def eliminar_categoria(id: str, current_user: UserProfile = Depends(get_current_admin)):
    supabase = get_supabase_client()
    res, _ = supabase.table("categorias").delete().eq("id", id).execute()
    return {"message": "Categoría eliminada"}
