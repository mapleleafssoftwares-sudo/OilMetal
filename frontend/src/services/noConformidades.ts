import { api } from './api';
import type {
  SectorTipo,
  Cargo,
  RequisitoPuntual,
  NoConformidadListItem,
  CreateNoConformidadPayload,
  NoConformidadDetail,
  UpdateNoConformidadPayload,
  CloseNoConformidadPayload,
  NoConformidadArchivo,
} from '../types/noConformidades';

export interface OrdenDisponible {
  id: string;
  numero_orden: string;
  empresa_nombre?: string | null;
}

export async function getSectoresTipo(activos = true): Promise<SectorTipo[]> {
  const res = await api.get('/no-conformidades/sectores-tipo', { params: { activos } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createSectorTipo(nombre: string): Promise<SectorTipo> {
  const res = await api.post('/no-conformidades/sectores-tipo', { nombre });
  return res.data;
}

export async function updateSectorTipo(id: number, nombre: string): Promise<SectorTipo> {
  const res = await api.put(`/no-conformidades/sectores-tipo/${id}`, { nombre });
  return res.data;
}

export async function deleteSectorTipo(id: number): Promise<void> {
  await api.delete(`/no-conformidades/sectores-tipo/${id}`);
}

export async function getCargos(activos = true): Promise<Cargo[]> {
  const res = await api.get('/no-conformidades/cargos', { params: { activos } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createCargo(nombre: string): Promise<Cargo> {
  const res = await api.post('/no-conformidades/cargos', { nombre });
  return res.data;
}

export async function updateCargo(id: number, nombre: string): Promise<Cargo> {
  const res = await api.put(`/no-conformidades/cargos/${id}`, { nombre });
  return res.data;
}

export async function deleteCargo(id: number): Promise<void> {
  await api.delete(`/no-conformidades/cargos/${id}`);
}

export async function getRequisitosPuntuales(activos = true): Promise<RequisitoPuntual[]> {
  const res = await api.get('/no-conformidades/requisitos-puntuales', { params: { activos } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createRequisitoPuntual(nombre: string): Promise<RequisitoPuntual> {
  const res = await api.post('/no-conformidades/requisitos-puntuales', { nombre });
  return res.data;
}

export async function updateRequisitoPuntual(id: number, nombre: string): Promise<RequisitoPuntual> {
  const res = await api.put(`/no-conformidades/requisitos-puntuales/${id}`, { nombre });
  return res.data;
}

export async function deleteRequisitoPuntual(id: number): Promise<void> {
  await api.delete(`/no-conformidades/requisitos-puntuales/${id}`);
}

export async function getNoConformidades(): Promise<NoConformidadListItem[]> {
  const res = await api.get('/no-conformidades');
  return Array.isArray(res.data) ? res.data : [];
}

export async function createNoConformidad(payload: CreateNoConformidadPayload): Promise<NoConformidadListItem> {
  const res = await api.post('/no-conformidades', payload);
  return res.data;
}

export async function getNoConformidadDetail(id: number): Promise<NoConformidadDetail> {
  const res = await api.get(`/no-conformidades/${id}`);
  return res.data;
}

export async function updateNoConformidad(id: number, payload: UpdateNoConformidadPayload): Promise<NoConformidadDetail> {
  const res = await api.put(`/no-conformidades/${id}`, payload);
  return res.data;
}

export async function updateNoConformidadResponsables(id: number, cargoIds: number[]): Promise<NoConformidadDetail> {
  const res = await api.put(`/no-conformidades/${id}/responsables`, { cargo_ids: cargoIds });
  return res.data;
}

export async function closeNoConformidad(id: number, payload: CloseNoConformidadPayload): Promise<NoConformidadDetail> {
  const res = await api.post(`/no-conformidades/${id}/cerrar`, payload);
  return res.data;
}

export async function reopenNoConformidad(id: number): Promise<NoConformidadDetail> {
  const res = await api.post(`/no-conformidades/${id}/reabrir`);
  return res.data;
}

export async function getNoConformidadArchivos(id: number): Promise<NoConformidadArchivo[]> {
  const res = await api.get(`/no-conformidades/${id}/archivos`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function uploadNoConformidadArchivo(
  id: number,
  file: File,
  descripcion?: string,
): Promise<NoConformidadArchivo> {
  const formData = new FormData();
  formData.append('file', file);
  if (descripcion?.trim()) {
    formData.append('descripcion', descripcion.trim());
  }
  const res = await api.post(`/no-conformidades/${id}/archivos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteNoConformidadArchivo(id: number, archivoId: number): Promise<void> {
  await api.delete(`/no-conformidades/${id}/archivos/${archivoId}`);
}

export async function getOrdenesDisponibles(): Promise<OrdenDisponible[]> {
  const res = await api.get('/no-conformidades/ordenes-disponibles');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getNoConformidadesByOrden(ordenId: string): Promise<NoConformidadDetail[]> {
  const res = await api.get(`/no-conformidades/by-orden/${ordenId}`);
  return Array.isArray(res.data) ? res.data : [];
}
