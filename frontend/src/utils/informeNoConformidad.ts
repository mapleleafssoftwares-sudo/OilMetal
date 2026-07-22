import type { NoConformidadDetail } from '../types/noConformidades';

function esc(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(value: unknown): string {
  return esc(value).replace(/\n/g, '<br>');
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  // Fechas "solo día" (YYYY-MM-DD, sin hora) se parsean en horario local para evitar
  // el corrimiento de un día que provoca `new Date(value)` al interpretarlas como UTC.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function siNo(value?: boolean | null): string {
  if (value === null || value === undefined) return '—';
  return value ? 'SI' : 'NO';
}

function buildInformeHtml(nc: NoConformidadDetail): string {
  const logoUrl = `${window.location.origin}/Vite.svg`;
  const emitido = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const cierreRows = (nc.cumplimiento_accion !== null && nc.cumplimiento_accion !== undefined)
    ? `
      <table class="tabla">
        <tr><th class="label">¿Acción cumplida?</th><td>${siNo(nc.cumplimiento_accion)}</td>
            <th class="label">¿En plazo?</th><td>${siNo(nc.cumplimiento_en_plazo)}</td></tr>
      </table>`
    : '';

  const archivosRows = nc.archivos && nc.archivos.length > 0
    ? nc.archivos.map((a, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${esc(a.descripcion || `Adjunto #${a.id}`)}</td>
          <td class="center">${formatDate(a.fecha_subida)}</td>
          <td class="center">${a.archivo_url ? `<a class="enlace" href="${esc(a.archivo_url)}" target="_blank" rel="noopener noreferrer">Descargar PDF</a>` : '—'}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="center vacio">Sin archivos adjuntos</td></tr>`;

  const responsables = nc.responsables && nc.responsables.length > 0
    ? nc.responsables.map(r => esc(r.nombre)).join(', ')
    : '—';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe NC-${esc(nc.id)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #111;
    background: #777;
    margin: 0;
    padding: 0;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #222; color: #fff;
    padding: 10px 16px;
    display: flex; align-items: center; justify-content: space-between;
    font-family: Arial, sans-serif;
  }
  .toolbar button {
    background: #fff; color: #111; border: 1px solid #444;
    padding: 6px 14px; font-size: 13px; font-weight: bold;
    border-radius: 4px; cursor: pointer;
  }
  .toolbar button:hover { background: #ddd; }
  .hoja {
    width: 210mm;
    min-height: 297mm;
    margin: 20px auto;
    background: #fff;
    padding: 18mm 16mm;
  }
  .encabezado {
    display: flex;
    align-items: center;
    gap: 16px;
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
    margin-bottom: 4px;
  }
  .encabezado img { height: 46px; width: auto; }
  .encabezado .empresa { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #444; }
  .encabezado .titulo { font-size: 19px; font-weight: bold; margin-top: 2px; }
  .meta {
    display: flex; justify-content: space-between;
    font-size: 11px; color: #444;
    margin-bottom: 14px;
    font-family: Arial, sans-serif;
  }
  h2.seccion {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #111;
    padding-bottom: 3px;
    margin: 18px 0 6px;
    font-family: Arial, sans-serif;
  }
  table.tabla {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    margin-bottom: 4px;
  }
  table.tabla th, table.tabla td {
    border: 1px solid #999;
    padding: 6px 8px;
    vertical-align: top;
    text-align: left;
  }
  table.tabla th.label {
    width: 22%;
    background: #f2f2f2;
    font-weight: bold;
    font-family: Arial, sans-serif;
    font-size: 10.5px;
    text-transform: uppercase;
  }
  table.tabla td.contenido {
    white-space: pre-wrap;
  }
  table.tabla td.center, table.tabla th.center { text-align: center; }
  table.tabla td.vacio { color: #777; font-style: italic; }
  .enlace {
    color: #111;
    text-decoration: underline;
    font-family: Arial, sans-serif;
    font-size: 11.5px;
    font-weight: bold;
  }
  .pie {
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid #999;
    display: flex; justify-content: space-between;
    font-size: 10px; color: #666;
    font-family: Arial, sans-serif;
  }
  @media print {
    .toolbar { display: none; }
    body { background: #fff; }
    .hoja { margin: 0; box-shadow: none; width: auto; min-height: auto; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span>Vista previa del informe</span>
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="hoja">
    <div class="encabezado">
      <img src="${logoUrl}" alt="OilMetal">
      <div>
        <div class="empresa">OilMetal &mdash; Sistema de Gestión de Calidad</div>
        <div class="titulo">Informe de No Conformidad N&deg; ${esc(nc.id)}</div>
      </div>
    </div>
    <div class="meta">
      <span>Estado: <strong>${esc(nc.estado)}</strong></span>
      <span>Emitido: ${esc(emitido)}</span>
    </div>

    <h2 class="seccion">Datos Generales</h2>
    <table class="tabla">
      <tr>
        <th class="label">Sector / Tipo</th><td>${esc(nc.sector_tipo_nombre) || '—'}</td>
        <th class="label">Carpeta vinculada</th><td>${esc(nc.orden_numero) || '—'}</td>
      </tr>
      <tr>
        <th class="label">Fecha de apertura</th><td>${formatDate(nc.fecha_reclamo || nc.fecha_apertura)}</td>
        <th class="label">Plazo de cierre</th><td>${formatDate(nc.plazo)}</td>
      </tr>
      <tr>
        <th class="label">Fecha de cierre</th><td>${formatDate(nc.fecha_cierre)}</td>
        <th class="label">Responsables</th><td>${responsables}</td>
      </tr>
    </table>

    <h2 class="seccion">Desarrollo de la No Conformidad</h2>
    <table class="tabla">
      <tr><th class="label">1. Descripción</th><td class="contenido">${nl2br(nc.descripcion) || '—'}</td></tr>
      <tr><th class="label">2. Requisito No Cumplido</th><td class="contenido">${nl2br(nc.evidencia_objetiva) || '—'}</td></tr>
      <tr><th class="label">3. Solución Inmediata</th><td class="contenido">${nl2br(nc.solucion_inmediata) || '—'}</td></tr>
      <tr><th class="label">4. Análisis de Causa Raíz</th><td class="contenido">${nl2br(nc.analisis_causa_raiz) || '—'}</td></tr>
      <tr><th class="label">5. Acción Propuesta</th><td class="contenido">${nl2br(nc.accion_propuesta) || '—'}</td></tr>
    </table>

    ${cierreRows ? `<h2 class="seccion">Evaluación de Cierre</h2>${cierreRows}` : ''}

    <h2 class="seccion">Archivos Adjuntos</h2>
    <table class="tabla">
      <tr>
        <th class="label center" style="width:8%">#</th>
        <th class="label">Descripción</th>
        <th class="label center" style="width:18%">Fecha de carga</th>
        <th class="label center" style="width:18%">Archivo</th>
      </tr>
      ${archivosRows}
    </table>

    <div class="pie">
      <span>Documento generado automáticamente por el sistema de Gestión de Calidad de OilMetal.</span>
      <span>NC-${esc(nc.id)}</span>
    </div>
  </div>
</body>
</html>`;
}

export function openInformeNoConformidad(nc: NoConformidadDetail): void {
  const html = buildInformeHtml(nc);
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
