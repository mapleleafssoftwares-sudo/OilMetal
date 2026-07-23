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


# ---- No Conformidades ----
class SectorTipoBase(BaseModel):
    nombre: str


class SectorTipoCreate(SectorTipoBase):
    pass


class CargoBase(BaseModel):
    nombre: str


class CargoCreate(CargoBase):
    pass


class RequisitoPuntualBase(BaseModel):
    nombre: str


class RequisitoPuntualCreate(RequisitoPuntualBase):
    pass


class NoConformidadCreate(BaseModel):
    sector_tipo_id: int
    plazo: Optional[str] = None


class NoConformidadListItem(BaseModel):
    id: int
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    plazo: Optional[str] = None
    sector_tipo_id: Optional[int] = None
    sector_tipo_nombre: Optional[str] = None
    estado: str
    es_no_conformidad: bool = True
    orden_id: Optional[str] = None
    orden_numero: Optional[str] = None
    empresa_nombre: Optional[str] = None
    created_by_nombre: Optional[str] = None


class NoConformidadResponsable(BaseModel):
    id: int
    nombre: str


class NoConformidadArchivo(BaseModel):
    id: int
    archivo_url: str
    descripcion: Optional[str] = None
    fecha_subida: datetime


class NoConformidadDetail(BaseModel):
    id: int
    sector_tipo_id: Optional[int] = None
    sector_tipo_nombre: Optional[str] = None
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    fecha_reclamo: Optional[str] = None
    descripcion: Optional[str] = None
    evidencia_objetiva: Optional[str] = None
    solucion_inmediata: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    accion_propuesta: Optional[str] = None
    plazo: Optional[str] = None
    cumplimiento_accion: Optional[bool] = None
    cumplimiento_en_plazo: Optional[bool] = None
    estado: str
    responsables: List[NoConformidadResponsable] = []
    archivos: List[NoConformidadArchivo] = []
    es_no_conformidad: bool = True
    orden_id: Optional[str] = None
    orden_numero: Optional[str] = None


class NoConformidadUpdate(BaseModel):
    sector_tipo_id: Optional[int] = None
    descripcion: Optional[str] = None
    evidencia_objetiva: Optional[str] = None
    solucion_inmediata: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    accion_propuesta: Optional[str] = None
    plazo: Optional[str] = None
    fecha_reclamo: Optional[str] = None
    es_no_conformidad: Optional[bool] = None
    orden_id: Optional[str] = None  # UUID de la orden del gestor de documentos (vacío = desasociar)


class NoConformidadResponsablesUpdate(BaseModel):
    cargo_ids: List[int]


class NoConformidadCloseRequest(BaseModel):
    cumplimiento_accion: bool
    cumplimiento_en_plazo: bool
