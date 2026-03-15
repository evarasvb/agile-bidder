// FirmaVB Postulador - Pending Sync Module
// =========================================
// Handles scraping task polling and execution via the PendingSync server.

import {
  PENDING_SYNC_URL,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
  SCRAPER_TIMEOUT_MS,
  TAB_LOAD_TIMEOUT_MS,
  PAGE_STABILIZATION_DELAY_MS
} from '../config.js';
import { syncComprasAgiles, syncOrdenCompra } from './supabase-api.js';

// In-memory flag to prevent concurrent task processing.
// Resets automatically when the service worker is restarted (correct MV3 behaviour).
let isProcessingTasks = false;

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
// STATUS
// ============================================

export async function getPendingSyncStatus() {
  const { pendingSyncEnabled, lastPendingSyncCheck, pendingTasksProcessed } =
    await chrome.storage.local.get(['pendingSyncEnabled', 'lastPendingSyncCheck', 'pendingTasksProcessed']);

  return {
    success: true,
    enabled: pendingSyncEnabled !== false,
    lastCheck: lastPendingSyncCheck,
    tasksProcessed: pendingTasksProcessed || 0
  };
}

// ============================================
// TASK POLLING
// ============================================

export async function checkPendingTasks() {
  if (isProcessingTasks) {
    console.log('[PendingSync] Already processing tasks, skipping...');
    return { success: false, error: 'Already processing' };
  }

  try {
    isProcessingTasks = true;

    const { apiKey, pendingSyncEnabled } = await chrome.storage.local.get(['apiKey', 'pendingSyncEnabled']);

    if (!apiKey) {
      console.log('[PendingSync] No API key configured');
      return { success: false, error: 'No API key configured' };
    }

    if (pendingSyncEnabled === false) {
      console.log('[PendingSync] Pending sync disabled');
      return { success: false, error: 'Pending sync disabled' };
    }

    console.log('[PendingSync] Fetching pending tasks...');

    const response = await withRetry(() =>
      fetch(`${PENDING_SYNC_URL}/api/pending-sync?limit=5`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[PendingSync] Failed to fetch tasks:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const tasks = data.items || [];

    console.log(`[PendingSync] Found ${tasks.length} pending task(s)`);

    await chrome.storage.local.set({ lastPendingSyncCheck: new Date().toISOString() });

    let processed = 0;
    for (const task of tasks) {
      try {
        await processTask(task);
        processed++;
      } catch (error) {
        console.error(`[PendingSync] Error processing task ${task.id}:`, error);
      }
    }

    const { pendingTasksProcessed } = await chrome.storage.local.get('pendingTasksProcessed');
    await chrome.storage.local.set({
      pendingTasksProcessed: (pendingTasksProcessed || 0) + processed
    });

    return { success: true, processed, total: tasks.length };

  } catch (error) {
    console.error('[PendingSync] Error checking tasks:', error);
    return { success: false, error: error.message };
  } finally {
    isProcessingTasks = false;
  }
}

// ============================================
// TASK PROCESSING
// ============================================

async function processTask(task) {
  console.log(`[PendingSync] Processing task ${task.id}: ${task.kind} - ${task.url}`);

  let tab = null;

  try {
    tab = await chrome.tabs.create({ url: task.url, active: false });

    console.log(`[PendingSync] Opened tab ${tab.id} for ${task.url}`);

    await waitForTabLoad(tab.id);

    console.log(`[PendingSync] Tab ${tab.id} loaded, injecting scraper...`);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [getScraperForKind(task.kind)]
    });

    const scrapedData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Scraper timeout'));
      }, SCRAPER_TIMEOUT_MS);

      chrome.tabs.sendMessage(tab.id, { action: 'EXECUTE_SCRAPE', kind: task.kind }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    console.log(`[PendingSync] Scraped data for task ${task.id}:`, scrapedData);

    await chrome.tabs.remove(tab.id);
    tab = null;

    await sendComplete(task.id, scrapedData, task.kind);

    console.log(`[PendingSync] Task ${task.id} completed successfully`);

  } catch (error) {
    console.error(`[PendingSync] Task ${task.id} failed:`, error);

    if (tab) {
      try { await chrome.tabs.remove(tab.id); } catch (_) { /* tab may already be closed */ }
    }

    await sendFailed(task.id, error.message);

    throw error;
  }
}

function getScraperForKind(_kind) {
  return 'scraper.js';
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, TAB_LOAD_TIMEOUT_MS);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Brief pause to let page scripts finish executing after load
        setTimeout(resolve, PAGE_STABILIZATION_DELAY_MS);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ============================================
// TASK COMPLETION REPORTING
// ============================================

async function getApiKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return apiKey;
}

async function sendComplete(taskId, data, kind) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No API key for sendComplete');
  }

  let payload = {};

  switch (kind) {
    case 'compra_agil_list':
      payload = { licitaciones: data.licitaciones || [] };
      break;

    case 'compra_agil_detail':
      payload = {
        licitaciones: data.licitacion ? [data.licitacion] : [],
        items: data.items || []
      };
      try {
        if (payload.licitaciones.length > 0) {
          await syncComprasAgiles(payload.licitaciones[0], payload.items);
        }
      } catch (syncError) {
        console.error('[FirmaVB] Error en sync directo de compra ágil:', syncError);
      }
      break;

    case 'oc_detail':
      payload = {
        orden_compra: data.orden_compra || data.header,
        items: data.items || []
      };
      try {
        if (payload.orden_compra && payload.orden_compra.codigo) {
          await syncOrdenCompra(payload.orden_compra, payload.items);
        }
      } catch (syncError) {
        console.error('[FirmaVB] Error en sync directo de OC:', syncError);
      }
      break;

    case 'licitacion_detail':
      payload = { licitacion: data.licitacion || data.row };
      break;

    default:
      payload = data;
  }

  console.log(`[PendingSync] Sending complete for task ${taskId}:`, { kind, payload });

  const response = await withRetry(() =>
    fetch(`${PENDING_SYNC_URL}/api/pending-sync/complete`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, payload })
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`sendComplete failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function sendFailed(taskId, errorMsg) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    console.warn('[PendingSync] No API key for sendFailed');
    return;
  }

  console.log(`[PendingSync] Sending failed for task ${taskId}:`, errorMsg);

  try {
    const response = await fetch(`${PENDING_SYNC_URL}/api/pending-sync/complete`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: 'failed', last_error: errorMsg })
    });

    if (!response.ok) {
      console.warn(`[PendingSync] sendFailed request failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[PendingSync] sendFailed error:', error);
  }
}
