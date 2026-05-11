"""
extract_products_from_pdfs.py
------------------------------
Itera todos los PDFs en la carpeta `certificados/` y extrae los nombres 
de productos que aparecen en el texto de cada PDF.

Estrategia:
  1. Carga todos los códigos de producto del CSV como referencia.
  2. Para cada PDF, extrae todo el texto visible (tablas + texto libre).
  3. Busca cuáles códigos de producto del inventario aparecen en ese texto.
  4. Genera un reporte Markdown con el resultado.
  5. Lista los PDFs que fallaron (imagen escaneada, sin texto extraíble).

Requiere:
  pip install pdfplumber pandas
"""

import os
import re
import pdfplumber
import pandas as pd
from datetime import datetime

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
PDF_FOLDER  = "./certificados"
CSV_PATH    = "./productos.csv"
OUTPUT_FILE = f"reporte_extraccion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
# ──────────────────────────────────────────────────────────────────────────────


def cargar_codigos_producto(csv_path: str) -> list[str]:
    """Carga todos los códigos de producto del CSV (columna 'Producto')."""
    df = pd.read_csv(csv_path)
    codigos = df['Producto'].dropna().astype(str).str.strip().tolist()
    # Eliminar duplicados conservando orden
    seen = set()
    unique = []
    for c in codigos:
        if c and c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def extraer_texto_pdf(pdf_path: str) -> tuple[str, str]:
    """
    Extrae todo el texto de un PDF (tablas + texto libre).
    Retorna (texto_completo, estado).
    estado puede ser: 'ok', 'sin_texto', 'error'
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            all_text_parts = []
            for page in pdf.pages:
                # Texto libre
                page_text = page.extract_text()
                if page_text:
                    all_text_parts.append(page_text)
                
                # Texto de tablas (celda a celda para no perder datos fragmentados)
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        for cell in row:
                            if cell and str(cell).strip():
                                all_text_parts.append(str(cell).strip())

            full_text = " ".join(all_text_parts)
            
            if not full_text.strip():
                return "", "sin_texto"
            return full_text, "ok"
    except Exception as e:
        return "", f"error:{e}"


def buscar_productos_en_texto(texto: str, codigos: list[str]) -> list[str]:
    """
    Busca qué códigos de producto aparecen en el texto del PDF.
    Usa búsqueda de palabra exacta (case-insensitive) para evitar falsos positivos.
    """
    texto_upper = texto.upper()
    encontrados = []
    for codigo in codigos:
        # Buscar el código como palabra completa o rodeado de separadores
        pattern = r'(?<![A-Z0-9])' + re.escape(codigo.upper()) + r'(?![A-Z0-9])'
        if re.search(pattern, texto_upper):
            encontrados.append(codigo)
    return encontrados


def main():
    print(f"📂 Carpeta de PDFs: {PDF_FOLDER}")
    print(f"📊 Cargando códigos de producto desde: {CSV_PATH}")
    
    codigos = cargar_codigos_producto(CSV_PATH)
    print(f"   → {len(codigos)} códigos únicos cargados.\n")
    
    pdfs = sorted([f for f in os.listdir(PDF_FOLDER) if f.lower().endswith('.pdf')])
    print(f"📄 PDFs encontrados: {len(pdfs)}\n")
    
    resultados = {}      # pdf_name → lista de productos encontrados
    fallidos_imagen = [] # PDFs sin texto (escaneados como imagen)
    fallidos_error  = [] # PDFs con error de lectura

    for i, pdf_name in enumerate(pdfs, 1):
        pdf_path = os.path.join(PDF_FOLDER, pdf_name)
        print(f"[{i:3d}/{len(pdfs)}] Procesando: {pdf_name}", end="")
        
        texto, estado = extraer_texto_pdf(pdf_path)
        
        if estado == "ok":
            encontrados = buscar_productos_en_texto(texto, codigos)
            resultados[pdf_name] = encontrados
            if encontrados:
                print(f" → ✅ {len(encontrados)} producto(s) encontrado(s)")
            else:
                print(f" → ⚠️  Sin coincidencias de producto")
        elif estado == "sin_texto":
            fallidos_imagen.append(pdf_name)
            resultados[pdf_name] = []
            print(f" → 🖼️  Sin texto (imagen escaneada)")
        else:
            fallidos_error.append((pdf_name, estado.replace("error:", "")))
            resultados[pdf_name] = []
            print(f" → ❌ Error: {estado.replace('error:', '')}")

    # ─── GENERAR REPORTE MARKDOWN ───────────────────────────────────────────
    print(f"\n📝 Generando reporte: {OUTPUT_FILE}")
    
    total_mapeados    = sum(1 for v in resultados.values() if v)
    total_sin_match   = sum(1 for k, v in resultados.items() 
                            if not v and k not in fallidos_imagen 
                            and k not in [f for f, _ in fallidos_error])
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# Reporte de Extracción de Productos desde PDFs\n\n")
        f.write(f"**Generado:** {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}  \n")
        f.write(f"**PDFs procesados:** {len(pdfs)}  \n")
        f.write(f"**PDFs con coincidencias:** {total_mapeados}  \n")
        f.write(f"**PDFs sin coincidencias (texto OK):** {total_sin_match}  \n")
        f.write(f"**PDFs sin texto (imagen):** {len(fallidos_imagen)}  \n")
        f.write(f"**PDFs con error:** {len(fallidos_error)}  \n\n")
        f.write("---\n\n")
        
        # ── Sección 1: PDFs con productos encontrados
        f.write("## ✅ PDFs con Productos Identificados\n\n")
        encontrados_list = [(k, v) for k, v in resultados.items() if v]
        if encontrados_list:
            for pdf_name, productos in sorted(encontrados_list):
                f.write(f"### 📄 `{pdf_name}`\n")
                f.write(f"**{len(productos)} producto(s):**\n")
                for prod in productos:
                    f.write(f"- `{prod}`\n")
                f.write("\n")
        else:
            f.write("_Ninguno._\n\n")
        
        # ── Sección 2: PDFs sin coincidencias (texto extraíble pero sin match)
        f.write("---\n\n## ⚠️ PDFs sin Coincidencias de Producto (Revisar Manualmente)\n\n")
        sin_match = [(k, v) for k, v in resultados.items() 
                     if not v 
                     and k not in fallidos_imagen 
                     and k not in [e for e, _ in fallidos_error]]
        if sin_match:
            f.write("Estos PDFs tienen texto extraíble pero ningún código de producto del inventario fue encontrado en ellos. "
                    "Puede deberse a que los productos están identificados de otra forma en el documento.\n\n")
            for pdf_name, _ in sorted(sin_match):
                f.write(f"- `{pdf_name}`\n")
        else:
            f.write("_Ninguno._\n")
        f.write("\n")
        
        # ── Sección 3: PDFs imagen (sin texto)
        f.write("---\n\n## 🖼️ PDFs Escaneados como Imagen (Requieren Trabajo Manual)\n\n")
        if fallidos_imagen:
            f.write("Estos PDFs no contienen texto extraíble. Son imágenes escaneadas y requieren "
                    "OCR o revisión manual para identificar productos.\n\n")
            for pdf_name in sorted(fallidos_imagen):
                f.write(f"- `{pdf_name}`\n")
        else:
            f.write("_Ninguno._\n")
        f.write("\n")
        
        # ── Sección 4: Errores
        if fallidos_error:
            f.write("---\n\n## ❌ PDFs con Error de Lectura\n\n")
            for pdf_name, err in sorted(fallidos_error):
                f.write(f"- `{pdf_name}`: {err}\n")
            f.write("\n")
    
    print(f"\n{'='*55}")
    print(f"✅ Reporte generado: {OUTPUT_FILE}")
    print(f"   PDFs con productos mapeados : {total_mapeados}")
    print(f"   PDFs sin coincidencias      : {total_sin_match}")
    print(f"   PDFs imagen (sin texto)     : {len(fallidos_imagen)}")
    print(f"   PDFs con error              : {len(fallidos_error)}")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
