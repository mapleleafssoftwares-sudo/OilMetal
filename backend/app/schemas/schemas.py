from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# ---- Auth ----
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: UUID
    rol: str
    nombre: Optional[str] = None
    email: str
    empresa_id: Optional[UUID] = None

class UserCreateRequest(BaseModel):
    email: str
    password: str
    nombre: Optional[str] = None
    rol: str = "consultor"

# ---- Certificados ----
class CertificadoBase(BaseModel):
    nombre: str
    colada: Optional[str] = None

class CertificadoCreate(CertificadoBase):
    pass

class CertificadoResponse(CertificadoBase):
    id: UUID
    created_at: datetime
    archivo_url: Optional[str] = None
    storage_path: Optional[str] = None

# ---- Categorias ----
class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class CategoriaResponse(CategoriaCreate):
    id: UUID
    created_at: datetime

# ---- Productos ----
class ProductoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    partida_lote: Optional[str] = None
    observaciones: Optional[str] = None
    certificado_id: Optional[UUID] = None
    categoria: Optional[str] = "Otros"

class ProductoCreate(ProductoBase):
    pass

class ProductoUpdate(ProductoBase):
    nombre: Optional[str] = None

class ProductoResponse(ProductoBase):
    id: UUID
    created_at: datetime

class ProductoConCertificadoResponse(ProductoResponse):
    certificados: List[CertificadoResponse] = []
