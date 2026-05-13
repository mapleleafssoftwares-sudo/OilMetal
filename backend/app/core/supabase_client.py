from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Client con anon key (para operaciones de auth del usuario)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise ValueError("Supabase URL and Anon Key must be configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_admin_client() -> Client:
    """Client con service role key — bypasea RLS en DB y Storage.

    En supabase-py 2.x el postgrest client NO hereda el JWT del API key
    automaticamente: hay que setearlo explicito con .postgrest.auth().
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    client = create_client(settings.SUPABASE_URL, key)
    # Bypass RLS en postgrest (queries a tablas)
    client.postgrest.auth(key)
    # Bypass RLS en storage (uploads / deletes)
    try:
        client.storage._client.headers["Authorization"] = f"Bearer {key}"
    except Exception:
        pass
    return client
