import pandas as pd
import sys

def main():
    try:
        df = pd.read_csv('productos.csv')
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return

    print("=== Total de Registros ===")
    print(len(df))
    
    # 1. Duplicados
    # Check for exact duplicates across all columns
    exact_duplicates = df[df.duplicated(keep=False)]
    
    # Check for duplicates by "Producto" (Código)
    code_duplicates = df[df.duplicated(subset=['Producto'], keep=False)]
    
    print("\n=== Productos (Códigos) Duplicados ===")
    if not code_duplicates.empty:
        # Get counts
        counts = df['Producto'].value_counts()
        dupes = counts[counts > 1]
        print(f"Hay {len(dupes)} códigos repetidos.")
        print("Ejemplos (Top 10):")
        for code, count in dupes.head(10).items():
            print(f"- {code}: {count} veces")
    else:
        print("No hay códigos duplicados.")

    # 2. Categorización basada en Descripción
    # Let's define some basic keywords
    df['Descripción'] = df['Descripción'].fillna('').astype(str).str.upper()
    
    categories = {
        'TUBOS Y CAÑERÍAS': ['TUBO', 'CAÑO', 'PIPE', 'TUBERIA'],
        'BRIDAS': ['BRIDA', 'FLANGE'],
        'ACCESORIOS (CODO, TEE, REDUCCIÓN)': ['CODO', 'TEE', 'REDUCCION', 'CAP', 'ELBOW', 'REDUCER', 'ACCESORIO'],
        'VÁLVULAS': ['VALVULA', 'VALVE'],
        'FIJACIONES (ESPARRAGOS, TUERCAS)': ['ESPARRAGO', 'TUERCA', 'STUD', 'NUT', 'BULON'],
        'JUNTAS Y SELLADOS': ['JUNTA', 'GASKET', 'SELLO'],
        'BRIDAS / ACCESORIOS FORJADOS': ['FORGED', 'FORJADO'],
        'OTROS': []
    }
    
    def get_category(desc):
        for cat, keywords in categories.items():
            if any(kw in desc for kw in keywords):
                return cat
        return 'OTROS / SIN CLASIFICAR'
        
    df['Categoria'] = df['Descripción'].apply(get_category)
    
    print("\n=== Categorización ===")
    cat_counts = df['Categoria'].value_counts()
    for cat, count in cat_counts.items():
        print(f"{cat}: {count}")

    # Top 5 products in "Otros" to see what we missed
    print("\n=== Ejemplos de 'Otros' ===")
    otros = df[df['Categoria'] == 'OTROS / SIN CLASIFICAR']['Descripción'].head(10)
    for desc in otros:
        print(f"- {desc}")

if __name__ == '__main__':
    main()
