// PQRItem is now dynamic - any field from n8n is accepted
export interface PQRItem {
  id: number;
  estado?: string;
  fecha?: string;
  prioridad?: string;
  nombre?: string;
  telefono?: string;
  direccion?: string;
  barrio?: string;
  descripcion_problema?: string;
  descripcion?: string;
  codigo?: string;
  identificacion?: string;
  tipo?: string;
  correo?: string;
  ubicacion?: string;
  notificado?: string;
  imagen_mime?: string;
  foto?: string;
  imagen?: string;
  [key: string]: unknown;
}

export interface PQRResponse {
  data: PQRItem[];
}

export type EstadoFilter = 'TODOS' | 'PENDIENTE' | 'EN_PROCESO' | 'SOLUCIONADO' | 'OTRO';

// Fields that should NOT be shown in detail tables (internal or rendered separately)
export const HIDDEN_FIELDS = ['id', 'foto', 'imagen', 'imagen_mime'];

// Fields that contain base64 images
export const IMAGE_FIELDS = ['foto', 'imagen'];

// Human-readable labels for known fields
export const FIELD_LABELS: Record<string, string> = {
  descripcion_problema: 'Descripción',
  descripcion: 'Descripción',
  fecha: 'Fecha',
  telefono: 'Teléfono',
  nombre: 'Nombre',
  codigo: 'Código',
  prioridad: 'Prioridad',
  tipo: 'Tipo',
  direccion: 'Dirección',
  identificacion: 'Identificación',
  estado: 'Estado',
  barrio: 'Barrio',
  correo: 'Correo',
  ubicacion: 'Ubicación',
  notificado: 'Notificado',
};

// Get a label for a field key
export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}