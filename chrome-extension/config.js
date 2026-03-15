// FirmaVB Postulador - Shared Configuration
// ==========================================
// Central configuration file for all extension scripts.

export const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
export const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;
export const SYNC_COMPRAS_AGILES_ENDPOINT = `${SUPABASE_URL}/functions/v1/sync-compras-agiles`;
export const SYNC_ORDENES_COMPRA_ENDPOINT = `${SUPABASE_URL}/functions/v1/sync-ordenes-compra`;

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
