from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from pydantic import BaseModel
from app.schemas.schemas import LoginRequest, TokenResponse, UserProfile, UserCreateRequest
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest):
    supabase = get_supabase_client()
    try:
        res = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        return {"access_token": res.session.access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
def logout(authorization: str = Header(...)):
    supabase = get_supabase_client()
    try:
        token = authorization.replace("Bearer ", "")
        supabase.auth.sign_out(jwt=token)
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me", response_model=UserProfile)
def get_me(authorization: str = Header(...)):
    supabase = get_supabase_client()
    supabase_admin = get_supabase_admin_client()
    try:
        token = authorization.replace("Bearer ", "")
        res = supabase.auth.get_user(token)
        user = res.user
        
        # Fetch profile using admin client to bypass RLS
        profile_res = supabase_admin.table("perfiles").select("*").eq("id", user.id).execute()
        
        if not profile_res.data:
            rol = "consultor" # Default
            nombre = None
            empresa_id = None
        else:
            rol = profile_res.data[0].get("rol", "consultor")
            nombre = profile_res.data[0].get("nombre")
            empresa_id = profile_res.data[0].get("empresa_id")
            
        return UserProfile(
            id=user.id,
            email=user.email,
            rol=rol,
            nombre=nombre,
            empresa_id=empresa_id
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Dependency for protecting routes
def get_current_user(authorization: str = Header(...)) -> UserProfile:
    return get_me(authorization)

def get_current_admin(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return current_user

# ── Gestión de usuarios (solo admin) ──
@router.get("/usuarios")
def list_usuarios(current_user: UserProfile = Depends(get_current_admin)):
    """Lista todos los perfiles de usuario con su rol."""
    supabase = get_supabase_client()
    res = supabase.table("perfiles").select("*, empresa:empresas(id, nombre)").execute()
    return res.data


class UserUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    empresa_id: Optional[str] = None


@router.put("/usuarios/{user_id}")
def update_usuario(user_id: str, body: UserUpdateRequest, current_user: UserProfile = Depends(get_current_admin)):
    """Actualiza nombre, rol y/o empresa de un usuario."""
    if body.rol and body.rol not in ("admin", "consultor"):
        raise HTTPException(status_code=400, detail="Rol inválido.")
    supabase_admin = get_supabase_admin_client()
    patch: dict = {}
    if body.nombre is not None:
        patch["nombre"] = body.nombre.strip() or None
    if body.rol is not None:
        patch["rol"] = body.rol
    if body.empresa_id is not None:
        patch["empresa_id"] = None if body.empresa_id == "" else body.empresa_id
    if not patch:
        raise HTTPException(status_code=400, detail="Nada que actualizar.")
    try:
        supabase_admin.table("perfiles").update(patch).eq("id", user_id).execute()
        res = supabase_admin.table("perfiles").select("*, empresa:empresas(id, nombre)").eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return res.data[0]


@router.put("/usuarios/{user_id}/empresa")
def update_empresa(user_id: str, empresa_id: Optional[str] = None, current_user: UserProfile = Depends(get_current_admin)):
    """Asigna o desvincula la empresa de un usuario."""
    supabase_admin = get_supabase_admin_client()
    # 'null' como string o vacío significa desasignar
    new_empresa_id = None if not empresa_id or empresa_id.lower() == "null" else empresa_id
    try:
        supabase_admin.table("perfiles").update({"empresa_id": new_empresa_id}).eq("id", user_id).execute()
        res = supabase_admin.table("perfiles").select("*").eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not res.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return res.data[0]


@router.delete("/usuarios/{user_id}")
def delete_usuario(user_id: str, current_user: UserProfile = Depends(get_current_admin)):
    """Elimina un usuario de Auth y su perfil."""
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="No podés eliminar tu propio usuario.")
    try:
        supabase_admin = get_supabase_admin_client()
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/usuarios")
def create_usuario(user_data: UserCreateRequest, current_user: UserProfile = Depends(get_current_admin)):
    """Crea un nuevo usuario en Supabase Auth y su perfil."""
    if user_data.rol not in ("admin", "consultor"):
        raise HTTPException(status_code=400, detail="Rol inválido. Debe ser 'admin' o 'consultor'.")
    try:
        supabase_admin = get_supabase_admin_client()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase admin client not available: {str(e)}")

    # Create the auth user
    try:
        res = supabase_admin.auth.admin.create_user({
            "email": user_data.email,
            "password": user_data.password,
            "email_confirm": True,
        })
        user_id = str(res.user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Insert profile — explicitly force service role key on PostgREST client
    # to avoid gotrue session state overriding the auth header with a user JWT.
    try:
        supabase_admin.postgrest.auth(settings.SUPABASE_SERVICE_ROLE_KEY)
        supabase_admin.table("perfiles").insert({
            "id": user_id,
            "nombre": user_data.nombre,
            "rol": user_data.rol,
        }).execute()
    except Exception as e:
        # Revert the auth user if profile creation fails
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Error creando perfil: {str(e)}")

    return {
        "id": user_id,
        "email": user_data.email,
        "nombre": user_data.nombre,
        "rol": user_data.rol,
    }

