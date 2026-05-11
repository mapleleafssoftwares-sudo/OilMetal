from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    # El backend siempre usa service role key para bypass RLS.
    # RLS lo gestiona la lógica de la API, no Supabase directamente.
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Alias mantenido por compatibilidad
def get_supabase_admin_client() -> Client:
    return get_supabase_client()
