// Types for FirmaVB Postulador Chrome Extension

export interface ApiConfig {
  apiKey: string;
  supabaseUrl: string;
}

export interface ClienteInfo {
  id: string;
  empresa: string;
  categoria: string;
}

export interface MatchOportunidad {
  oferta_id: string;
  licitacion_id: string;
  match_score: number;
  estado: string;
  valor_total: number;
  titulo: string;
  organismo: string;
  presupuesto: number;
  fecha_cierre: string;
  link_oficial: string;
}

export interface ProductoOfertado {
  producto_id: string;
  nombre: string;
  sku: string;
  cantidad: number;
  precio_unitario: number;
  precio_ofertado: number;
  margen: number;
  item_licitacion_id?: number;
}

export interface OfertaData {
  oferta_id: string;
  licitacion_id: string;
  nombre_oferta: string;
  productos: ProductoOfertado[];
  items_licitacion: LicitacionItem[];
  valor_total: number;
  margen_total: number;
  observaciones: string;
  licitacion: {
    titulo: string;
    organismo: string;
    presupuesto: number;
    fecha_cierre: string;
  };
}

export interface LicitacionItem {
  id: number;
  nombre_producto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

export interface PageInfo {
  isCompraAgil: boolean;
  codigoLicitacion: string | null;
  items: ExtractedItem[];
  isLoggedIn: boolean;
  pageUrl: string;
}

export interface ExtractedItem {
  linea: number;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

export interface SubmitResult {
  success: boolean;
  numero_oferta_mp?: string;
  mensaje?: string;
  error_detalle?: string;
}

export interface StorageData {
  apiKey?: string;
  clienteInfo?: ClienteInfo;
  matches?: MatchOportunidad[];
  lastSync?: string;
  settings?: ExtensionSettings;
}

export interface ExtensionSettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  notifications: boolean;
  autoFillConfirm: boolean;
}

// Message types for communication between scripts
export type MessageAction = 
  | 'GET_CONFIG'
  | 'SET_CONFIG'
  | 'SYNC_MATCHES'
  | 'GET_MATCHES'
  | 'GET_OFFER'
  | 'SUBMIT_RESULT'
  | 'PAGE_INFO'
  | 'START_AUTOFILL'
  | 'AUTOFILL_COMPLETE';

export interface ExtensionMessage {
  action: MessageAction;
  payload?: any;
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
}
