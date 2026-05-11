import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan credenciales de Supabase en el .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_user_with_role(email, password, rol, nombre):
    try:
        # Crear usuario en Auth
        print(f"Creando usuario {email}...")
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        user_id = res.user.id
        print(f"✅ Usuario creado en Auth con ID: {user_id}")
        
        # Asignar rol en la tabla perfiles
        print(f"Asignando rol '{rol}' en la tabla perfiles...")
        supabase.table("perfiles").insert({
            "id": user_id,
            "rol": rol,
            "nombre": nombre
        }).execute()
        
        print(f"✅ Perfil creado con éxito.\n")
    except Exception as e:
        print(f"❌ Error al crear {email}: {str(e)}\n")

if __name__ == "__main__":
    print("--- CREACIÓN DE USUARIOS DE PRUEBA ---")
    
    # Usuario Administrador
    create_user_with_role(
        email="admin@ejemplo.com",
        password="Password123!",
        rol="admin",
        nombre="Administrador General"
    )
    
    # Usuario Consultor
    create_user_with_role(
        email="consultor@ejemplo.com",
        password="Password123!",
        rol="consultor",
        nombre="Consultor Prueba"
    )
    
    print("Proceso completado.")
