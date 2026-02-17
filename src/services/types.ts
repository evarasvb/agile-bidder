/**
 * Unified Types for Services
 * Centralized type definitions to ensure consistency across all services
 */

// ============ INVENTORY TYPES ============

export interface InventoryItem {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string;
  keywords: string[];
  precio_unitario: number;
  margen_minimo: number;
  margen_objetivo: number;
  stock_disponible: number;
  unidad_medida: string;
  tiempo_entrega_dias: number;
  proveedor: string | null;
  activo: boolean;
}

// ============ LICITACION TYPES ============

export interface Licitacion {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
}

export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

// ============ MATCHING TYPES ============

/**
 * Unified ProductMatch interface
 * Used across matchingEngine, fuzzyMatching, and related components
 */
export interface ProductMatch {
  // Core identification
  inventory_id: string;
  sku: string;
  nombre: string;
  
  // Matching details
  keywords_matched: string[];
  similarity_score: number; // 0-100
  match_type?: 'exact' | 'partial' | 'keyword' | 'fuzzy' | 'category';
  
  // Pricing and quantities
  cantidad_requerida: number;
  precio_unitario: number;
  precio_oferta: number;
  margen_aplicado: number;
  subtotal: number;
  
  // Optional: Full inventory item for detailed views
  inventory_item?: InventoryItem;
}

export interface MatchResult {
  licitacion_id: string;
  match_score: number; // 0-100
  productos_matcheados: ProductMatch[];
  valor_total_estimado: number;
  margen_estimado: number;
  confidence_level: 'high' | 'medium' | 'low';
  razones_match: string[];
  alertas: string[];
  presupuesto_licitacion: number | null;
  cobertura_items: number; // % de items de licitación cubiertos
}

// ============ FUZZY MATCHING TYPES ============

export interface ItemRequerido {
  id: string;
  nombre: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
}

// ============ OFERTA TYPES ============

export interface ProductoOfertado {
  inventory_id?: string;
  sku?: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  precio_total?: number;
  margen?: number;
}

// ============ ERROR TYPES ============

export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export class ServiceException extends Error {
  code: string;
  details?: Record<string, unknown>;
  
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ServiceException';
    this.code = code;
    this.details = details;
  }
}
