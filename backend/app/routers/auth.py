from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from pydantic import BaseModel
import httpx
from app.schemas.schemas import LoginRequest, TokenResponse, UserProfile, UserCreateRequest
from app.core.supabase_client import get_supabase_client, get_supabase_admin_client
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

VALID_ROLES = ("admin", "consultor", "vendedor", "deposito", "calidad")
INTERNAL_ROLES = ("admin", "vendedor", "deposito", "calidad")


# ── Supabase Auth Admin REST helpers (bypasan el bug de supabase-py 2.0.x
#    donde auth.admin no envía Authorization: Bearer correctamente) ──────────

def _auth_admin_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

def _list_auth_users() -> list[dict]:
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    r = httpx.get(url, headers=_auth_admin_headers(), params={"page": 1, "per_page": 1000})
    r.raise_for_status()
    data = r.json()
    return data.get("users", data) if isinstance(data, dict) else data

def _create_auth_user(email: str, password: str) -> dict:
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    r = httpx.post(url, headers=_auth_admin_headers(), json={
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    if r.status_code not in (200, 201):
        data = r.json()
        msg = data.get("message") or data.get("msg") or "Error al crear usuario"
        raise HTTPException(status_code=400, detail=msg)
    return r.json()

def _delete_auth_user(user_id: str):
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    r = httpx.delete(url, headers=_auth_admin_headers())
    if r.status_code not in (200, 204):
        data = r.json()
        raise HTTPException(status_code=400, detail=data.get("message") or "Error al eliminar usuario")


# ── Auth endpoints ────────────────────────────────────────────────────────────

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

        profile_res = supabase_admin.table("perfiles").select("*").eq("id", user.id).execute()

        if not profile_res.data:
            rol = "consultor"
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


# ── Auth dependencies ─────────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(...)) -> UserProfile:
    return get_me(authorization)

def get_current_admin(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return current_user

def get_current_internal_user(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Allows admin + internal employees (vendedor, deposito, calidad)."""
    if current_user.rol not in INTERNAL_ROLES:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return current_user


# ── Gestión de usuarios (solo admin) ─────────────────────────────────────────

@router.get("/usuarios")
def list_usuarios(current_user: UserProfile = Depends(get_current_admin)):
    supabase_admin = get_supabase_admin_client()
    res = supabase_admin.table("perfiles").select("*, empresa:empresas(id, nombre)").execute()
    profiles = res.data or []
    try:
        auth_users = _list_auth_users()
        email_map = {u["id"]: u.get("email") for u in auth_users}
    except Exception:
        email_map = {}
    for p in profiles:
        p["email"] = email_map.get(p["id"])
    return profiles


class UserUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    empresa_id: Optional[str] = None


@router.put("/usuarios/{user_id}")
def update_usuario(user_id: str, body: UserUpdateRequest, current_user: UserProfile = Depends(get_current_admin)):
    if body.rol and body.rol not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Debe ser uno de: {', '.join(VALID_ROLES)}.")
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


@router.delete("/usuarios/{user_id}")
def delete_usuario(user_id: str, current_user: UserProfile = Depends(get_current_admin)):
    if user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="No podés eliminar tu propio usuario.")
    _delete_auth_user(user_id)
    return {"ok": True}


@router.post("/usuarios")
def create_usuario(user_data: UserCreateRequest, current_user: UserProfile = Depends(get_current_admin)):
    if user_data.rol not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Debe ser uno de: {', '.join(VALID_ROLES)}.")
    supabase_admin = get_supabase_admin_client()

    try:
        auth_user = _create_auth_user(user_data.email, user_data.password)
        user_id = auth_user["id"]
    except HTTPException as e:
        err = e.detail.lower() if isinstance(e.detail, str) else ""
        if any(k in err for k in ("already registered", "already exists", "user_already_exists", "email already")):
            try:
                auth_users = _list_auth_users()
                existing = next((u for u in auth_users if u.get("email") == user_data.email), None)
                if not existing:
                    raise HTTPException(status_code=400, detail="El email ya está en uso.")
                user_id = existing["id"]
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=400, detail="El email ya está registrado.")
        else:
            raise

    try:
        supabase_admin.table("perfiles").upsert({
            "id": user_id,
            "nombre": user_data.nombre,
            "rol": user_data.rol,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creando perfil: {str(e)}")

    return {
        "id": user_id,
        "email": user_data.email,
        "nombre": user_data.nombre,
        "rol": user_data.rol,
    }
