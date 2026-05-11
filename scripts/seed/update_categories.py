import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan credenciales de Supabase en el .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

CATEGORIAS = {
    'Tubos y Cañerías': ['TUBO', 'CAÑO', 'PIPE', 'TUBERIA'],
    'Bridas': ['BRIDA', 'FLANGE'],
    'Accesorios (Codo, Tee, Reducción)': ['CODO', 'TEE', 'REDUCCION', 'CAP', 'ELBOW', 'REDUCER', 'ACCESORIO', 'CUPLA'],
    'Válvulas': ['VALVULA', 'VALVE'],
    'Fijaciones y Bulonería': ['ESPARRAGO', 'TUERCA', 'STUD', 'NUT', 'BULON', 'ARANDELA'],
    'Juntas y Sellados': ['JUNTA', 'GASKET', 'SELLO'],
    'Instrumentación': ['MANOMETRO', 'TERMOMETRO'],
    'Repuestos de Válvulas': ['VOLANTE', 'KIT PALANCA', 'ACTUADOR', 'SEAT'],
    'Insumos Generales': ['MANTA', 'BIGBAG', 'CINTA', 'PINTURA']
}

def obtener_categoria(desc):
    desc_upper = str(desc).upper()
    for cat, keywords in CATEGORIAS.items():
        if any(kw in desc_upper for kw in keywords):
            return cat
    return 'Otros'

def get_all_productos():
    all_prods = []
    limit = 1000
    offset = 0
    while True:
        res = supabase.table("productos").select("*").range(offset, offset + limit - 1).execute()
        if not res.data:
            break
        all_prods.extend(res.data)
        if len(res.data) < limit:
            break
        offset += limit
    return all_prods

def main():
    print("Obteniendo todos los productos...")
    productos = get_all_productos()
    print(f"Total encontrados: {len(productos)}")
    
    df = pd.DataFrame(productos)
    
    # Identificar duplicados por "nombre" (Código)
    # Conservamos el primero, eliminamos el resto.
    duplicados = df[df.duplicated(subset=['nombre'], keep='first')]
    
    ids_a_borrar = duplicados['id'].tolist()
    
    if ids_a_borrar:
        print(f"Borrando {len(ids_a_borrar)} productos duplicados...")
        for chunk in [ids_a_borrar[i:i + 100] for i in range(0, len(ids_a_borrar), 100)]:
            supabase.table("productos").delete().in_('id', chunk).execute()
        print("Duplicados borrados.")
    else:
        print("No se encontraron duplicados.")
        
    # Categorizar los que quedan
    print("Categorizando productos restantes...")
    restantes = get_all_productos()
    
    actualizados = 0
    for prod in restantes:
        cat = obtener_categoria(prod.get('descripcion', ''))
        
        # Solo actualizar si cambió o si está vacío
        if prod.get('categoria') != cat:
            supabase.table("productos").update({"categoria": cat}).eq("id", prod['id']).execute()
            actualizados += 1
            
    print(f"Proceso completado. Se actualizaron {actualizados} categorías.")

if __name__ == "__main__":
    main()
