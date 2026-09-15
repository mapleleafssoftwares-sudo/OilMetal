from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings

# Los clientes se crean una única vez por proceso y se reutilizan en todos los
# requests (en vez de crear un Client -> httpx.Client nuevo, con su propio pool
# de conexiones, en cada llamada). Los métodos usados en este proyecto no
# mutan estado compartido del cliente por request (los tokens de usuario se
# pasan como parámetro por-llamada, nunca se guardan en el cliente), por lo
# que reutilizar una única instancia es seguro incluso con requests
# concurrentes.


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Client con service role key (autorización gestionada por la API). Singleton por proceso."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@lru_cache(maxsize=1)
def get_supabase_admin_client() -> Client:
    """Client con service role key y postgrest.auth() para bypass explícito de RLS. Singleton por proceso."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    client = create_client(settings.SUPABASE_URL, key)
    client.postgrest.auth(key)
    return client
