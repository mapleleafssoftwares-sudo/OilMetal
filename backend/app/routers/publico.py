"""
Endpoints PÚBLICOS (sin autenticación) de solo lectura.

Alcance deliberadamente mínimo: únicamente exponen el listado de certificados
de materiales y piezas (tabla `certificados`) con los campos estrictamente
necesarios para buscarlos y descargarlos. No exponen órdenes de compra,
remitos, empresas, usuarios, no conformidades ni `storage_path`.

Medidas de protección (el endpoint es anónimo y la instancia tiene 512 MB):
- Solo método GET, columnas explícitas (nunca select("*")).
- Paginación obligatoria con tope de page_size.
- Búsqueda sanitizada (evita inyección en filtros PostgREST y wildcards masivos).
- Rate limit por IP + límite global en memoria, con limpieza para no crecer.
- Solo se devuelven URLs https.
"""
import os
import re
import time
import threading
from collections import deque
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.core.supabase_client import get_supabase_admin_client

router = APIRouter(prefix="/publico", tags=["publico"])

MAX_PAGE_SIZE = 50
MAX_QUERY_LEN = 80

RATE_WINDOW_SECONDS = 60
RATE_LIMIT_PER_IP = int(os.getenv("PUBLIC_RATE_LIMIT_PER_IP", "60"))
RATE_LIMIT_GLOBAL = int(os.getenv("PUBLIC_RATE_LIMIT_GLOBAL", "600"))
MAX_TRACKED_IPS = 5000

_lock = threading.Lock()
_hits_by_ip: dict[str, deque] = {}
_global_hits: deque = deque()

# Solo letras, números, espacios y signos habituales en nombres de certificado.
# Se descartan , ( ) * % _ \ " ' etc. que tienen significado en filtros PostgREST/LIKE.
_DISALLOWED = re.compile(r"[^\w\s\-./°ºª#]", re.UNICODE)


def _client_ip(request: Request) -> str:
    # Se usa la entrada MÁS A LA DERECHA de X-Forwarded-For: es la que agrega el
    # proxy de confianza (Render); las de la izquierda las puede falsificar el cliente.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()[:64] or "unknown"
    return request.client.host if request.client else "unknown"


def _rate_limit(request: Request) -> None:
    now = time.monotonic()
    cutoff = now - RATE_WINDOW_SECONDS
    ip = _client_ip(request)
    with _lock:
        while _global_hits and _global_hits[0] < cutoff:
            _global_hits.popleft()
        if len(_global_hits) >= RATE_LIMIT_GLOBAL:
            raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intentá nuevamente en unos instantes.",
                                headers={"Retry-After": str(RATE_WINDOW_SECONDS)})

        hits = _hits_by_ip.get(ip)
        if hits is None:
            if len(_hits_by_ip) >= MAX_TRACKED_IPS:
                # Limpieza de entradas vencidas para acotar memoria
                for k in [k for k, v in _hits_by_ip.items() if not v or v[-1] < cutoff]:
                    del _hits_by_ip[k]
                if len(_hits_by_ip) >= MAX_TRACKED_IPS:
                    raise HTTPException(status_code=429, detail="Demasiadas solicitudes.",
                                        headers={"Retry-After": str(RATE_WINDOW_SECONDS)})
            hits = _hits_by_ip[ip] = deque()
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_PER_IP:
            raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intentá nuevamente en unos instantes.",
                                headers={"Retry-After": str(RATE_WINDOW_SECONDS)})
        hits.append(now)
        _global_hits.append(now)


def _sanitize_query(q: Optional[str]) -> str:
    if not q:
        return ""
    q = _DISALLOWED.sub(" ", q[:MAX_QUERY_LEN])
    return re.sub(r"\s+", " ", q).strip()


@router.get("/certificados")
def listar_certificados_publicos(
    request: Request,
    response: Response,
    q: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
):
    _rate_limit(request)

    term = _sanitize_query(q)
    start = (page - 1) * page_size
    end = start + page_size - 1

    supabase = get_supabase_admin_client()
    query = (
        supabase.table("certificados")
        .select("id,nombre,colada,archivo_url,created_at", count="exact")
        .like("archivo_url", "https://%")
    )
    if term:
        query = query.or_(f"nombre.ilike.*{term}*,colada.ilike.*{term}*")

    try:
        res = query.order("nombre").range(start, end).execute()
    except Exception:
        raise HTTPException(status_code=502, detail="No se pudo obtener el listado de certificados.")

    response.headers["Cache-Control"] = "public, max-age=30"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return {
        "items": res.data or [],
        "total": res.count or 0,
        "page": page,
        "page_size": page_size,
    }
