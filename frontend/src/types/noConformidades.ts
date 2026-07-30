export interface SectorTipo {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Cargo {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface RequisitoPuntual {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface CostoNoCalidad {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface NoConformidadListItem {
  id: number;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  plazo?: string | null;
  sector_tipo_id?: number | null;
  sector_tipo_nombre?: string | null;
  estado: 'En proceso' | 'Resuelto';
  es_no_conformidad: boolean;
  orden_id?: string | null;
  orden_numero?: string | null;
  empresa_nombre?: string | null;
  created_by_nombre?: string | null;
}

export interface CreateNoConformidadPayload {
  sector_tipo_id: number;
  plazo?: string;
}

export interface NoConformidadResponsable {
  id: number;
  nombre: string;
}

export interface NoConformidadArchivo {
  id: number;
  archivo_url: string;
  descripcion?: string | null;
  fecha_subida: string;
}

export interface NcCosto {
  id: number;
  costo_no_calidad_id: number;
  costo_no_calidad_nombre?: string | null;
  monto: number;
}

export interface NoConformidadDetail {
  id: number;
  sector_tipo_id?: number | null;
  sector_tipo_nombre?: string | null;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  fecha_reclamo?: string | null;
  descripcion?: string | null;
  evidencia_objetiva?: string | null;
  solucion_inmediata?: string | null;
  analisis_causa_raiz?: string | null;
  accion_propuesta?: string | null;
  plazo?: string | null;
  cumplimiento_accion?: boolean | null;
  cumplimiento_en_plazo?: boolean | null;
  estado: 'En proceso' | 'Resuelto';
  responsables: NoConformidadResponsable[];
  archivos: NoConformidadArchivo[];
  es_no_conformidad: boolean;
  orden_id?: string | null;
  orden_numero?: string | null;
  monto_orden_compra?: number | null;
  costos: NcCosto[];
}

export interface UpdateNoConformidadPayload {
  sector_tipo_id?: number;
  descripcion?: string;
  evidencia_objetiva?: string;
  solucion_inmediata?: string;
  analisis_causa_raiz?: string;
  accion_propuesta?: string;
  plazo?: string;
  fecha_reclamo?: string | null;
  es_no_conformidad?: boolean;
  orden_id?: string | null;
  monto_orden_compra?: number | null;
}

export interface CloseNoConformidadPayload {
  cumplimiento_accion: boolean;
  cumplimiento_en_plazo: boolean;
}

export interface DashboardConteoItem {
  nombre: string;
  cantidad: number;
}

export interface DashboardCostoConceptoItem {
  nombre: string;
  monto: number;
}

export interface DashboardClienteItem {
  nombre: string;
  cantidad_casos: number;
  monto_oc: number;
  costos_no_calidad: number;
}

export interface DashboardVendedorItem {
  nombre: string;
  cantidad_casos: number;
}

export interface NoConformidadesDashboard {
  total_casos: number;
  total_no_conformidades: number;
  total_reclamos: number;
  casos_en_proceso: number;
  casos_resueltos: number;
  casos_con_carpeta_vinculada: number;
  por_sector: DashboardConteoItem[];
  monto_total_oc: number;
  costos_no_calidad_total: number;
  utilidad_neta_total: number;
  porcentaje_impacto_costos?: number | null;
  costos_por_concepto: DashboardCostoConceptoItem[];
  por_cliente: DashboardClienteItem[];
  por_vendedor: DashboardVendedorItem[];
  porcentaje_en_plazo?: number | null;
  dias_promedio_resolucion?: number | null;
}
