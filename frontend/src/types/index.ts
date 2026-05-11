export interface Certificado {
  id: string;
  nombre: string;
  colada?: string;
  created_at: string;
  archivo_url?: string;
  storage_path?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion?: string;
  partida_lote?: string;
  observaciones?: string;
  certificado_id?: string;
  categoria?: string;
  created_at: string;
  certificados: Certificado[];
}
