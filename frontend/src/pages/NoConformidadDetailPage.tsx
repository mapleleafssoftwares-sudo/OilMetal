import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, Save, Upload, Trash2, Paperclip, Plus, X } from 'lucide-react';
import {
  closeNoConformidad,
  deleteNoConformidadArchivo,
  getCargos,
  getNoConformidadArchivos,
  getNoConformidadDetail,
  getOrdenesDisponibles,
  getRequisitosPuntuales,
  getSectoresTipo,
  reopenNoConformidad,
  uploadNoConformidadArchivo,
  updateNoConformidad,
  updateNoConformidadResponsables,
} from '../services/noConformidades';
import type { OrdenDisponible } from '../services/noConformidades';
import { useAuthStore } from '../store/useAuthStore';
import type { Cargo, NoConformidadArchivo, NoConformidadDetail, RequisitoPuntual, SectorTipo } from '../types/noConformidades';
import SearchableSelect from '../components/SearchableSelect';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  // Fechas "solo día" (YYYY-MM-DD) se parsean en horario local para evitar
  // el corrimiento de un día que provoca `new Date(value)` al interpretarlas como UTC.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

type IsoRequirement = {
  section: string;
  requirement: string;
  puntual: string;
};

const ISO_9001_STRUCTURE = [
  {
    section: '4. Contexto de la organización',
    requirements: [
      '4.1 Comprensión de la organización y de su contexto',
      '4.2 Comprensión de las necesidades y expectativas de las partes interesadas',
      '4.3 Determinación del alcance del sistema de gestión de la calidad',
      '4.4 Sistema de gestión de la calidad y sus procesos',
    ],
  },
  {
    section: '5. Liderazgo',
    requirements: [
      '5.1 Liderazgo y compromiso',
      '5.2 Política',
      '5.3 Roles, responsabilidades y autoridades en la organización',
    ],
  },
  {
    section: '6. Planificación',
    requirements: [
      '6.1 Acciones para abordar riesgos y oportunidades',
      '6.2 Objetivos de la calidad y planificación para lograrlos',
      '6.3 Planificación de los cambios',
    ],
  },
  {
    section: '7. Apoyo',
    requirements: [
      '7.1 Recursos',
      '7.2 Competencia',
      '7.3 Toma de conciencia',
      '7.4 Comunicación',
      '7.5 Información documentada',
    ],
  },
  {
    section: '8. Operación',
    requirements: [
      '8.1 Planificación y control operacional',
      '8.2 Requisitos para los productos y servicios',
      '8.3 Diseño y desarrollo de los productos y servicios',
      '8.4 Control de los procesos, productos y servicios suministrados externamente',
      '8.5 Producción y provisión del servicio',
      '8.6 Liberación de los productos y servicios',
      '8.7 Control de las salidas no conformes',
    ],
  },
  {
    section: '9. Evaluación del desempeño',
    requirements: [
      '9.1 Seguimiento, medición, análisis y evaluación',
      '9.2 Auditoría interna',
      '9.3 Revisión por la dirección',
    ],
  },
  {
    section: '10. Mejora',
    requirements: [
      '10.1 Generalidades',
      '10.2 No conformidad y acción correctiva',
      '10.3 Mejora continua',
    ],
  },
];

const parseIsoRequirement = (value?: string | null): IsoRequirement | null => {
  if (!value) return null;
  const [leftPart, puntualRaw = ''] = value.split(' | ');
  const [sectionRaw = '', requirementRaw = ''] = leftPart.split(' > ');
  const section = sectionRaw.trim();
  const requirement = requirementRaw.trim();
  if (!section || !requirement) return null;

  const sectionEntry = ISO_9001_STRUCTURE.find((item) => item.section === section);
  if (!sectionEntry) return null;
  if (!sectionEntry.requirements.includes(requirement)) return null;

  return {
    section,
    requirement,
    puntual: puntualRaw.trim(),
  };
};

function AutoTextarea({
  value,
  onChange,
  disabled,
  className,
  minHeight = 96,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50 resize-none overflow-hidden ${className || ''}`}
    />
  );
}

export default function NoConformidadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const ncId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);

  const [detail, setDetail] = useState<NoConformidadDetail | null>(null);
  const [sectores, setSectores] = useState<SectorTipo[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [archivos, setArchivos] = useState<NoConformidadArchivo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenDisponible[]>([]);
  const [requisitosPuntuales, setRequisitosPuntuales] = useState<RequisitoPuntual[]>([]);

  const [sectorTipoId, setSectorTipoId] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [isoSection, setIsoSection] = useState('');
  const [isoRequirement, setIsoRequirement] = useState('');
  const [isoSpecificRequirement, setIsoSpecificRequirement] = useState('');
  const [solucionInmediata, setSolucionInmediata] = useState('');
  const [analisisCausaRaiz, setAnalisisCausaRaiz] = useState('');
  const [accionPropuesta, setAccionPropuesta] = useState('');
  const [plazo, setPlazo] = useState('');
  const [fechaReclamo, setFechaReclamo] = useState('');
  const [esNoConformidad, setEsNoConformidad] = useState(true);
  const [selectedCargoIds, setSelectedCargoIds] = useState<number[]>([]);
  const [selectedCargoToAdd, setSelectedCargoToAdd] = useState<number | ''>('');
  const [ordenId, setOrdenId] = useState<string>('');

  const [cumplimientoAccion, setCumplimientoAccion] = useState<'SI' | 'NO'>('SI');
  const [cumplimientoEnPlazo, setCumplimientoEnPlazo] = useState<'SI' | 'NO'>('SI');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [archivoDescripcion, setArchivoDescripcion] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingArchivoId, setDeletingArchivoId] = useState<number | null>(null);

  const loadData = async () => {
    if (!Number.isFinite(ncId)) {
      navigate('/admin/no-conformidades', { replace: true });
      return;
    }
    setLoading(true);
    try {
      const [detailData, sectoresData, cargosData, archivosData, ordenesData, requisitosData] = await Promise.all([
        getNoConformidadDetail(ncId),
        getSectoresTipo(true),
        getCargos(true),
        getNoConformidadArchivos(ncId),
        getOrdenesDisponibles(),
        getRequisitosPuntuales(true),
      ]);

      setDetail(detailData);
      setSectores(sectoresData);
      setCargos(cargosData);
      setArchivos(archivosData);
      setOrdenes(ordenesData);
      setRequisitosPuntuales(requisitosData);

      setSectorTipoId(detailData.sector_tipo_id ?? '');
      setDescripcion(detailData.descripcion || '');
      const parsedIso = parseIsoRequirement(detailData.evidencia_objetiva || '');
      if (parsedIso) {
        setIsoSection(parsedIso.section);
        setIsoRequirement(parsedIso.requirement);
        setIsoSpecificRequirement(parsedIso.puntual);
      } else {
        setIsoSection('');
        setIsoRequirement('');
        setIsoSpecificRequirement(detailData.evidencia_objetiva || '');
      }
      setSolucionInmediata(detailData.solucion_inmediata || '');
      setAnalisisCausaRaiz(detailData.analisis_causa_raiz || '');
      setAccionPropuesta(detailData.accion_propuesta || '');
      setPlazo(detailData.plazo || '');
      setFechaReclamo(detailData.fecha_reclamo || '');
      setEsNoConformidad(detailData.es_no_conformidad ?? true);
      setSelectedCargoIds(detailData.responsables.map((r) => r.id));
      setSelectedCargoToAdd('');
      setCumplimientoAccion(detailData.cumplimiento_accion === false ? 'NO' : 'SI');
      setCumplimientoEnPlazo(detailData.cumplimiento_en_plazo === false ? 'NO' : 'SI');
      setOrdenId(detailData.orden_id ?? '');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo cargar el detalle');
      navigate('/admin/no-conformidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncId]);

  const isClosed = detail?.estado === 'Resuelto';
  const isAdmin = user?.rol === 'admin';
  const canEdit = !isClosed;

  const selectedIsoSection = useMemo(
    () => ISO_9001_STRUCTURE.find((item) => item.section === isoSection),
    [isoSection],
  );

  const requisitoNormaIncumplido = useMemo(() => {
    if (!isoSection || !isoRequirement) return '';
    const puntual = isoSpecificRequirement.trim();
    return `${isoSection} > ${isoRequirement}${puntual ? ` | ${puntual}` : ''}`;
  }, [isoSection, isoRequirement, isoSpecificRequirement]);

  const missingCloseFields = useMemo(() => {
    const missing: string[] = [];
    if (!sectorTipoId) missing.push('Sector/Tipo');
    if (!descripcion.trim()) missing.push('Descripción');
    if (!isoSection) missing.push('Inciso ISO 9001');
    if (!isoRequirement) missing.push('Requisito del inciso seleccionado');
    if (!isoSpecificRequirement.trim()) missing.push('Requisito puntual que no cumple');
    if (!solucionInmediata.trim()) missing.push('Solución Inmediata');
    if (!analisisCausaRaiz.trim()) missing.push('Análisis Causa Raíz');
    if (!accionPropuesta.trim()) missing.push('Acción Propuesta');
    if (!plazo) missing.push('Plazo de Cierre');
    if (selectedCargoIds.length === 0) missing.push('Al menos un Responsable');
    return missing;
  }, [
    sectorTipoId,
    descripcion,
    isoSection,
    isoRequirement,
    isoSpecificRequirement,
    solucionInmediata,
    analisisCausaRaiz,
    accionPropuesta,
    plazo,
    selectedCargoIds,
  ]);


  const availableCargos = useMemo(
    () => cargos.filter((cargo) => !selectedCargoIds.includes(cargo.id)),
    [cargos, selectedCargoIds],
  );

  const selectedResponsables = useMemo(
    () => cargos.filter((cargo) => selectedCargoIds.includes(cargo.id)),
    [cargos, selectedCargoIds],
  );

  const handleAddResponsable = () => {
    if (!selectedCargoToAdd) return;
    setSelectedCargoIds((prev) => [...prev, Number(selectedCargoToAdd)]);
    setSelectedCargoToAdd('');
  };

  const handleRemoveResponsable = (cargoId: number) => {
    setSelectedCargoIds((prev) => prev.filter((idItem) => idItem !== cargoId));
  };

  const persistChanges = async () => {
    if (!detail) return;
    const updated = await updateNoConformidad(detail.id, {
      ...(sectorTipoId ? { sector_tipo_id: Number(sectorTipoId) } : {}),
      descripcion,
      evidencia_objetiva: requisitoNormaIncumplido,
      solucion_inmediata: solucionInmediata,
      analisis_causa_raiz: analisisCausaRaiz,
      accion_propuesta: accionPropuesta,
      plazo,
      fecha_reclamo: fechaReclamo || null,
      es_no_conformidad: esNoConformidad,
      orden_id: ordenId || null,
    });

    const withResponsables = await updateNoConformidadResponsables(detail.id, selectedCargoIds);
    setDetail(withResponsables || updated);
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await persistChanges();
      alert('Cambios guardados');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseCase = async () => {
    if (!detail) return;
    if (missingCloseFields.length > 0) {
      alert(`Para cerrar el caso completá primero:\n\n- ${missingCloseFields.join('\n- ')}`);
      return;
    }
    if (!confirm('Confirma cerrar este Detalle Caso?')) return;
    setClosing(true);
    try {
      // Guarda los cambios pendientes del formulario antes de cerrar: el backend
      // valida contra lo persistido en la base, no contra el estado en pantalla.
      await persistChanges();
      const closed = await closeNoConformidad(detail.id, {
        cumplimiento_accion: cumplimientoAccion === 'SI',
        cumplimiento_en_plazo: cumplimientoEnPlazo === 'SI',
      });
      setDetail(closed);
      alert('Caso cerrado correctamente');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo cerrar el caso');
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!detail || !isAdmin) return;
    if (!confirm('Reabrir el caso limpiará fecha de cierre y campos de cumplimiento. Continuar?')) return;
    setReopening(true);
    try {
      const reopened = await reopenNoConformidad(detail.id);
      setDetail(reopened);
      setCumplimientoAccion('SI');
      setCumplimientoEnPlazo('SI');
      alert('Caso reabierto');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo reabrir el caso');
    } finally {
      setReopening(false);
    }
  };

  const handleUploadArchivo = async () => {
    if (!detail || !selectedFile) return;
    setUploadingFile(true);
    try {
      const nuevo = await uploadNoConformidadArchivo(detail.id, selectedFile, archivoDescripcion);
      setArchivos((prev) => [nuevo, ...prev]);
      setSelectedFile(null);
      setArchivoDescripcion('');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo subir el archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteArchivo = async (archivoId: number) => {
    if (!detail) return;
    if (!confirm('Eliminar este adjunto?')) return;
    setDeletingArchivoId(archivoId);
    try {
      await deleteNoConformidadArchivo(detail.id, archivoId);
      setArchivos((prev) => prev.filter((item) => item.id !== archivoId));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo eliminar el archivo');
    } finally {
      setDeletingArchivoId(null);
    }
  };

  if (loading || !detail) {
    return <p className="text-slate-400 text-center py-12">Cargando detalle...</p>;
  }

  return (
    <section className="max-w-6xl mx-auto w-full space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/admin/no-conformidades')}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
            >
              <ArrowLeft className="h-4 w-4" /> Volver al listado
            </button>
            <h3 className="text-xl font-bold text-slate-800">Informe Caso #{detail.id}</h3>
            <p className="text-sm text-slate-500 mt-1">Completá la ficha y cerrá el caso cuando estén todos los campos obligatorios.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${detail.estado === 'Resuelto' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
              {detail.estado}
            </span>
            <span className="text-xs text-slate-500">Apertura: {formatDate(detail.fecha_apertura)}</span>
            <span className="text-xs text-slate-500">Cierre: {formatDate(detail.fecha_cierre)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-slate-900">Identificación del caso</h4>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={esNoConformidad}
                onChange={(e) => setEsNoConformidad(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              No conformidad
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sector/Tipo</label>
              <select
                disabled={!canEdit}
                value={sectorTipoId}
                onChange={(e) => setSectorTipoId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
              >
                <option value="">Seleccionar...</option>
                {sectores.map((sector) => (
                  <option key={sector.id} value={sector.id}>{sector.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Carpeta vinculada (Gestor de Documentos)
              </label>
              <SearchableSelect
                disabled={!canEdit}
                value={ordenId}
                onChange={setOrdenId}
                placeholder="Buscar carpeta por número o empresa..."
                emptyLabel="No hay carpetas que coincidan."
                options={ordenes.map((orden) => ({
                  value: orden.id,
                  label: orden.numero_orden,
                  sublabel: orden.empresa_nombre || undefined,
                }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Reclamo</label>
              <input
                type="date"
                disabled={!canEdit}
                value={fechaReclamo}
                onChange={(e) => setFechaReclamo(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-400 mt-1">Puede diferir de la fecha de apertura de la carpeta.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <AutoTextarea
              disabled={!canEdit}
              value={descripcion}
              onChange={setDescripcion}
              minHeight={80}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-4">
            <h5 className="text-sm font-semibold text-slate-800">Requerimiento No Cumplido - ISO 9001</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Inciso</label>
                <select
                  disabled={!canEdit}
                  value={isoSection}
                  onChange={(e) => {
                    setIsoSection(e.target.value);
                    setIsoRequirement('');
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
                >
                  <option value="">Seleccionar inciso...</option>
                  {ISO_9001_STRUCTURE.map((item) => (
                    <option key={item.section} value={item.section}>{item.section}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requisito del inciso seleccionado</label>
                <select
                  disabled={!canEdit || !selectedIsoSection}
                  value={isoRequirement}
                  onChange={(e) => setIsoRequirement(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
                >
                  <option value="">Seleccionar requisito...</option>
                  {selectedIsoSection?.requirements.map((requirement) => (
                    <option key={requirement} value={requirement}>{requirement}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requisito puntual que no cumple</label>
              <SearchableSelect
                disabled={!canEdit || !isoRequirement}
                value={isoSpecificRequirement}
                onChange={setIsoSpecificRequirement}
                placeholder="Buscar o escribir requisito puntual..."
                emptyLabel="Sin coincidencias. Podés escribir uno nuevo o cargarlo en Catálogos."
                allowCustom
                options={requisitosPuntuales.map((r) => ({ value: r.nombre, label: r.nombre }))}
              />
              <p className="text-xs text-slate-500 mt-1">
                Primero seleccioná inciso y requisito; luego buscá o escribí el incumplimiento puntual.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h4 className="font-semibold text-slate-900">Evidencia Objetiva (Adjuntos)</h4>
          <p className="text-xs text-slate-500">
            Adjuntá uno o más archivos. La descripción es opcional para agregar un comentario adicional.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start">
            <input
              type="file"
              disabled={!canEdit || uploadingFile}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            <input
              type="text"
              disabled={!canEdit || uploadingFile}
              value={archivoDescripcion}
              onChange={(e) => setArchivoDescripcion(e.target.value)}
              placeholder="Descripción adicional (opcional)"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
            />
            <button
              type="button"
              disabled={!canEdit || !selectedFile || uploadingFile}
              onClick={handleUploadArchivo}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="h-4 w-4" /> {uploadingFile ? 'Subiendo...' : 'Subir adjunto'}
            </button>
          </div>

          {archivos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay adjuntos cargados.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {archivos.map((archivo) => (
                <li key={archivo.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                  <Paperclip className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={archivo.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {archivo.archivo_url.split('/').pop()}
                    </a>
                    <p className="text-xs text-slate-500 truncate">
                      {archivo.descripcion || 'Sin descripción'} • {formatDate(archivo.fecha_subida)}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteArchivo(archivo.id)}
                      disabled={deletingArchivoId === archivo.id}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50 flex-shrink-0"
                      title="Eliminar adjunto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h4 className="font-semibold text-slate-900">Acción Reactiva</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Solución Inmediata</label>
              <AutoTextarea
                disabled={!canEdit}
                value={solucionInmediata}
                onChange={setSolucionInmediata}
                minHeight={80}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Análisis Causa Raíz</label>
              <AutoTextarea
                disabled={!canEdit}
                value={analisisCausaRaiz}
                onChange={setAnalisisCausaRaiz}
                minHeight={80}
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h4 className="font-semibold text-slate-900">Acción Correctiva</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plazo de Cierre</label>
              <input
                type="date"
                disabled={!canEdit}
                value={plazo}
                onChange={(e) => setPlazo(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Acción Propuesta</label>
              <AutoTextarea
                disabled={!canEdit}
                value={accionPropuesta}
                onChange={setAccionPropuesta}
                minHeight={44}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Responsable(s)</label>
            <div className="flex flex-col md:flex-row md:items-start gap-3">
              <div className="flex gap-2 md:w-80 flex-shrink-0">
                <select
                  disabled={!canEdit || availableCargos.length === 0}
                  value={selectedCargoToAdd}
                  onChange={(e) => setSelectedCargoToAdd(e.target.value ? Number(e.target.value) : '')}
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
                >
                  <option value="">Seleccionar responsable...</option>
                  {availableCargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>{cargo.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddResponsable}
                  disabled={!canEdit || !selectedCargoToAdd}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Agregar
                </button>
              </div>

              {selectedResponsables.length === 0 ? (
                <p className="text-xs text-slate-400 pt-2">Sin responsables asignados.</p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedResponsables.map((cargo) => (
                    <span key={cargo.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                      {cargo.nombre}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveResponsable(cargo.id)}
                          className="text-slate-500 hover:text-rose-600"
                          title="Quitar responsable"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="font-semibold text-slate-900">Seguimiento y Control</h4>
            <p className="text-xs text-slate-500">Estos campos se registran al cerrar el caso.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cumplimiento de la acción propuesta</label>
              <select
                value={cumplimientoAccion}
                onChange={(e) => setCumplimientoAccion(e.target.value as 'SI' | 'NO')}
                disabled={isClosed}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
              >
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cumplimiento en el plazo</label>
              <select
                value={cumplimientoEnPlazo}
                onChange={(e) => setCumplimientoEnPlazo(e.target.value as 'SI' | 'NO')}
                disabled={isClosed}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm disabled:bg-slate-50"
              >
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>
        </article>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={isClosed || !canEdit || saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <button
            onClick={handleCloseCase}
            disabled={isClosed || closing}
            title={missingCloseFields.length > 0 ? `Falta completar: ${missingCloseFields.join(', ')}` : undefined}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> {closing ? 'Cerrando...' : 'Cerrar Caso'}
          </button>

          {isClosed && isAdmin && (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> {reopening ? 'Reabriendo...' : 'Reabrir Caso'}
            </button>
          )}
        </div>

        {!isClosed && missingCloseFields.length > 0 && (
          <p className="text-xs text-amber-600">
            Para cerrar el caso todavía falta completar: {missingCloseFields.join(', ')}.
          </p>
        )}
      </div>
    </section>
  );
}
