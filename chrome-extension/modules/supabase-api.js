// FirmaVB Postulador - Supabase API Module
// =========================================
// Handles all communication with the Supabase backend.

import {
  EXTENSION_API_ENDPOINT,
  SUPABASE_URL,
  SYNC_COMPRAS_AGILES_ENDPOINT,
  SYNC_ORDENES_COMPRA_ENDPOINT,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS
} from '../config.js';
import { showNotification } from './notifications.js';

// ============================================
// RETRY HELPER
// ============================================

async function withRetry(fn, attempts = MAX_RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// ============================================
// SUPABASE API REQUEST HELPER
// ============================================

async function supabaseApiRequest(apiKey, action, body = null) {
  return withRetry(async () => {
    const response = await fetch(`${EXTENSION_API_ENDPOINT}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  });
}

// ============================================
// PUBLIC API FUNCTIONS
// ============================================

export async function getConfig() {
  const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'settings', 'pendingSyncEnabled']);
  return {
    success: true,
    hasApiKey: !!stored.apiKey,
    clienteInfo: stored.clienteInfo || null,
    settings: stored.settings || { notifications: true, autoSync: true },
    pendingSyncEnabled: stored.pendingSyncEnabled !== false
  };
}

export async function setApiKey(apiKey) {
  const response = await supabaseApiRequest(apiKey, 'verify');

  if (response.success && response.cliente) {
    await chrome.storage.local.set({
      apiKey,
      clienteInfo: response.cliente,
      pendingSyncEnabled: true
    });

    await syncMatches();

    return { success: true, cliente: response.cliente };
  }

  throw new Error('API Key inválida');
}

export async function syncMatches() {
  try {
    const { apiKey, settings } = await chrome.storage.local.get(['apiKey', 'settings']);

    if (!apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    const response = await supabaseApiRequest(apiKey, 'get-matches');

    if (response.success) {
      const { matches: oldMatches } = await chrome.storage.local.get('matches');
      const newMatches = response.matches || [];

      await chrome.storage.local.set({
        matches: newMatches,
        lastSync: new Date().toISOString()
      });

      if (settings?.notifications && oldMatches) {
        const oldIds = new Set(oldMatches.map(m => m.id_licitacion));
        const newlyAddedMatches = newMatches.filter(m => !oldIds.has(m.id_licitacion));

        if (newlyAddedMatches.length > 0) {
          showNotification(
            'Nuevas oportunidades',
            `Se encontraron ${newlyAddedMatches.length} nueva(s) licitación(es) que coinciden con tu perfil`
          );
        }
      }

      return { success: true, matches: newMatches };
    }

    return { success: false, error: 'Failed to fetch matches' };
  } catch (error) {
    console.error('[FirmaVB] Sync error:', error);
    return { success: false, error: error.message };
  }
}

export async function getStoredMatches() {
  const { matches, lastSync } = await chrome.storage.local.get(['matches', 'lastSync']);
  return {
    success: true,
    matches: matches || [],
    lastSync
  };
}

export async function getOffer(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');

  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const body = data.ofertaId
    ? { oferta_id: data.ofertaId }
    : { licitacion_id: data.licitacionId };

  const response = await supabaseApiRequest(apiKey, 'get-offer', body);

  if (response.success) {
    return { success: true, oferta: response.oferta };
  }

  throw new Error(response.error || 'Failed to get offer');
}

export async function submitResult(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');

  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const response = await supabaseApiRequest(apiKey, 'submit-result', {
    oferta_id: data.ofertaId,
    exito: data.exito,
    mensaje: data.mensaje,
    datos_adicionales: data.datosAdicionales
  });

  if (response.success) {
    await syncMatches();
    return { success: true, estado: response.estado };
  }

  throw new Error(response.error || 'Failed to submit result');
}

export async function syncLicitacion(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');

  if (!apiKey) {
    console.log('[FirmaVB] No API key, skipping licitacion sync');
    return { success: false, error: 'No API key configured' };
  }

  const { licitacion, items } = data;

  console.log('[FirmaVB] Syncing licitacion:', licitacion?.id_licitacion, 'items:', items?.length);

  const response = await supabaseApiRequest(apiKey, 'sync-licitacion', { licitacion, items });

  if (response.success) {
    console.log('[FirmaVB] Licitacion synced successfully');
    return { success: true, message: response.message };
  }

  console.warn('[FirmaVB] Licitacion sync failed:', response.error);
  return { success: false, error: response.error };
}

export async function handleScrapedData(data, sender) {
  if (data.orden_compra && data.orden_compra.codigo) {
    try {
      const { apiKey } = await chrome.storage.local.get('apiKey');
      if (apiKey) {
        const response = await withRetry(() =>
          fetch(SYNC_ORDENES_COMPRA_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({ ordenes_compra: [data.orden_compra], items: data.items || [] })
          })
        );

        if (response.ok) {
          console.log('[FirmaVB] Orden de compra sincronizada:', data.orden_compra.codigo);
          return { success: true, message: 'Orden de compra sincronizada' };
        } else {
          const error = await response.json();
          console.warn('[FirmaVB] Error sincronizando OC:', error);
        }
      }
    } catch (error) {
      console.error('[FirmaVB] Error en handleScrapedData para OC:', error);
    }
  }

  console.log('[FirmaVB] Received scraped data from tab:', sender.tab?.id, data);

  await chrome.storage.local.set({
    [`scrapedData_${sender.tab?.id}`]: data
  });

  return { success: true };
}

export async function syncComprasAgiles(licitacion, items = []) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) return;

  const response = await withRetry(() =>
    fetch(SYNC_COMPRAS_AGILES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ compras_agiles: [licitacion], items })
    })
  );

  if (response.ok) {
    const result = await response.json();
    console.log('[FirmaVB] Compra ágil sincronizada a Supabase:', licitacion.codigo, result);
  } else {
    const error = await response.json();
    console.warn('[FirmaVB] Error sincronizando compra ágil a Supabase:', error);
  }
}

export async function syncOrdenCompra(ordenCompra, items = []) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) return;

  const response = await withRetry(() =>
    fetch(SYNC_ORDENES_COMPRA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ ordenes_compra: [ordenCompra], items })
    })
  );

  if (response.ok) {
    const result = await response.json();
    console.log('[FirmaVB] Orden de compra sincronizada a Supabase:', ordenCompra.codigo, result);
  } else {
    const error = await response.json();
    console.warn('[FirmaVB] Error sincronizando OC a Supabase:', error);
  }
}
