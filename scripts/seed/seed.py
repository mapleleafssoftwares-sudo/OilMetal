import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BUCKET_NAME = os.environ.get("SUPABASE_BUCKET", "certificados")
CSV_PATH = os.environ.get("CSV_PATH", "./productos.csv")
PDF_FOLDER = os.environ.get("PDF_FOLDER", "./certificados/")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan credenciales de Supabase en el .env")

# Inicializar cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_certificates():
    print("Iniciando subida de certificados...")
    archivos = os.listdir(PDF_FOLDER)
    pdfs = [f for f in archivos if f.endswith('.pdf')]
    
    certificados_subidos = 0
    
    for pdf in pdfs:
        file_path = os.path.join(PDF_FOLDER, pdf)
        storage_path = pdf
        
        # Subir archivo al bucket
        try:
            with open(file_path, 'rb') as f:
                res = supabase.storage.from_(BUCKET_NAME).upload(
                    file=f,
                    path=storage_path,
                    file_options={"content-type": "application/pdf"}
                )
            
            # Obtener URL pública
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
            
            # Insertar en base de datos
            data, count = supabase.table('certificados').insert({
                "nombre": pdf,
                "archivo_url": public_url,
                "storage_path": storage_path
            }).execute()
            
            certificados_subidos += 1
            print(f"✅ Subido: {pdf}")
        except Exception as e:
            # Podría fallar si ya existe
            print(f"❌ Error con {pdf}: {str(e)}")
            
    print(f"Total certificados subidos: {certificados_subidos}")

def upload_products():
    print("Iniciando carga de productos...")
    df = pd.read_csv(CSV_PATH)
    
    # Manejar NaN
    df = df.fillna('')
    
    productos_insertados = 0
    
    for _, row in df.iterrows():
        # Columnas: Producto, Descripción, Partida / Lote, Certificado, Observaciones
        producto_data = {
            "nombre": str(row.get('Producto', '')),
            "descripcion": str(row.get('Descripción', '')),
            "partida_lote": str(row.get('Partida / Lote', '')),
            "observaciones": str(row.get('Observaciones', ''))
        }
        
        # certificado_id = NULL por ahora, se mapea luego
        
        try:
            supabase.table('productos').insert(producto_data).execute()
            productos_insertados += 1
        except Exception as e:
            print(f"❌ Error insertando {producto_data['nombre']}: {str(e)}")
            
    print(f"Total productos insertados: {productos_insertados}")

if __name__ == "__main__":
    upload_certificates()
    upload_products()
    print("✅ Migración completada.")
