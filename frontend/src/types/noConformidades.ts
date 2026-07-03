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

export interface NoConformidadListItem {
  id: number;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  plazo?: string | null;
  sector_tipo_id?: number | null;
  sector_tipo_nombre?: string | null;
  estado: 'Abierta' | 'En proceso' | 'Cerrada';
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

export interface NoConformidadDetail {
  id: number;
  sector_tipo_id?: number | null;
  sector_tipo_nombre?: string | null;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  descripcion?: string | null;
  evidencia_objetiva?: string | null;
  solucion_inmediata?: string | null;
  analisis_causa_raiz?: string | null;
  accion_propuesta?: string | null;
  plazo?: string | null;
  cumplimiento_accion?: boolean | null;
  cumplimiento_en_plazo?: boolean | null;
  estado: 'Abierta' | 'En proceso' | 'Cerrada';
  responsables: NoConformidadResponsable[];
  archivos: NoConformidadArchivo[];
}

export interface UpdateNoConformidadPayload {
  sector_tipo_id?: number;
  descripcion?: string;
  evidencia_objetiva?: string;
  solucion_inmediata?: string;
  analisis_causa_raiz?: string;
  accion_propuesta?: string;
  plazo?: string;
}

export interface CloseNoConformidadPayload {
  cumplimiento_accion: boolean;
  cumplimiento_en_plazo: boolean;
}
