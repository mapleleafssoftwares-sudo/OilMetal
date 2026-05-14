from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Siempre usa service role key — el backend gestiona autorización por lógica de API."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def get_supabase_admin_client() -> Client:
    """Alias mantenido por compatibilidad."""
    return get_supabase_client()
