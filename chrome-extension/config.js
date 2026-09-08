// FirmaVB Postulador - Shared Configuration
// ==========================================
// Central configuration file for all extension scripts.

export const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
export const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;
export const SYNC_COMPRAS_AGILES_ENDPOINT = `${SUPABASE_URL}/functions/v1/sync-compras-agiles`;
export const SYNC_ORDENES_COMPRA_ENDPOINT = `${SUPABASE_URL}/functions/v1/sync-ordenes-compra`;
// Adjuntos (bases y anexos) de una licitación, tomados por la extensión desde la sección
// "Adjuntos" de Mercado Público (que exige captcha y por eso el robot no puede bajar).
export const EXTENSION_ADJUNTOS_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-adjuntos`;
// Descarga de documentos de una compra ágil (misma ruta que usa la app de Mercado Público; exige la sesión del usuario).
export const CA_DESCARGA_ENDPOINT = 'https://servicios-compra-agil.mercadopublico.cl/v1/compra-agil/comprador/descargar?id=';
export const CA_TOKEN_COOKIE = 'access_token_ccr';

export const PENDING_SYNC_URL = 'https://compraagil-pending-sync.onrender.com';

export const SYNC_ALARM_NAME = 'firmavb-sync';
export const PENDING_SYNC_ALARM_NAME = 'pending-sync-check';
export const SYNC_INTERVAL_MINUTES = 30;
export const PENDING_SYNC_INTERVAL_MINUTES = 1;

export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;
export const SCRAPER_TIMEOUT_MS = 30000;
export const TAB_LOAD_TIMEOUT_MS = 60000;
export const PAGE_STABILIZATION_DELAY_MS = 1000;
