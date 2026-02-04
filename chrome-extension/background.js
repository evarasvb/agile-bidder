// FirmaVB Postulador - Background Service Worker
// ============================================
// Dual-mode: Supabase API (auth/matches) + PendingSync Server (scraping tasks)

// === SUPABASE CONFIGURATION (existing) ===
const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;
const SYNC_ALARM_NAME = 'firmavb-sync';
const SYNC_INTERVAL_MINUTES = 30;

// === PENDING SYNC SERVER CONFIGURATION (new) ===
// URL del servidor pending_sync deployado - cambiar por URL real de producción
const PENDING_SYNC_URL = 'https://compraagil-pending-sync.onrender.com'; // TODO: Update with real URL
const PENDING_SYNC_ALARM_NAME = 'pending-sync-check';
const PENDING_SYNC_INTERVAL_MINUTES = 1; // Mínimo en MV3

// Task processing state
let isProcessingTasks = false;

// ============================================
// EXTENSION LIFECYCLE
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FirmaVB] Extension installed');
  
  // Set up periodic sync alarm (existing - Supabase matches)
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  
  // Set up pending sync alarm (new - scraping tasks)
  chrome.alarms.create(PENDING_SYNC_ALARM_NAME, {
    periodInMinutes: PENDING_SYNC_INTERVAL_MINUTES
  });
  
  console.log('[FirmaVB] Alarms created:', SYNC_ALARM_NAME, PENDING_SYNC_ALARM_NAME);
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[FirmaVB] Alarm triggered:', alarm.name);
  
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('[FirmaVB] Running scheduled Supabase sync...');
    await syncMatches();
  }
  
  if (alarm.name === PENDING_SYNC_ALARM_NAME) {
    console.log('[FirmaVB] Checking pending sync tasks...');
    await checkPendingTasks();
  }
});

// ============================================
// MESSAGE HANDLING (existing - enhanced)
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  return true; // Async response
});

async function handleMessage(message, sender) {
  const { action, data } = message;
  
  switch (action) {
    // Existing Supabase actions
    case 'GET_CONFIG':
      return await getConfig();
    
    case 'SET_API_KEY':
      return await setApiKey(data.apiKey);
    
    case 'SYNC_MATCHES':
      return await syncMatches();
    
    case 'GET_MATCHES':
      return await getStoredMatches();
    
    case 'GET_OFFER':
      return await getOffer(data);
    
    case 'SUBMIT_RESULT':
      return await submitResult(data);
    
    case 'SYNC_LICITACION':
      return await syncLicitacion(data);
    
    // New pending sync actions
    case 'CHECK_PENDING_TASKS':
      return await checkPendingTasks();
    
    case 'GET_PENDING_SYNC_STATUS':
      return await getPendingSyncStatus();
    
    // Scraped data from content script
    case 'SCRAPED_DATA':
      return await handleScrapedData(data, sender);
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================
// SUPABASE API FUNCTIONS (existing)
// ============================================

async function getConfig() {
  const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'settings', 'pendingSyncEnabled']);
  return {
    success: true,
    hasApiKey: !!stored.apiKey,
    clienteInfo: stored.clienteInfo || null,
    settings: stored.settings || { notifications: true, autoSync: true },
    pendingSyncEnabled: stored.pendingSyncEnabled !== false // Default to true
  };
}

async function setApiKey(apiKey) {
  // Verify API key with Supabase backend
  const response = await supabaseApiRequest(apiKey, 'verify');
  
  if (response.success && response.cliente) {
    await chrome.storage.local.set({
      apiKey,
      clienteInfo: response.cliente,
      pendingSyncEnabled: true // Enable pending sync by default
    });
    
    // Trigger initial sync
    await syncMatches();
    
    return { success: true, cliente: response.cliente };
  }
  
  throw new Error('API Key inválida');
}

async function syncMatches() {
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
      
      // Check for new matches and notify
      if (settings?.notifications && oldMatches) {
        const newIds = new Set(newMatches.map(m => m.id_licitacion));
        const oldIds = new Set(oldMatches.map(m => m.id_licitacion));
        const brandNew = newMatches.filter(m => !oldIds.has(m.id_licitacion));
        
        if (brandNew.length > 0) {
          showNotification(
            'Nuevas oportunidades',
            `Se encontraron ${brandNew.length} nueva(s) licitación(es) que coinciden con tu perfil`
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

async function getStoredMatches() {
  const { matches, lastSync } = await chrome.storage.local.get(['matches', 'lastSync']);
  return {
    success: true,
    matches: matches || [],
    lastSync
  };
}

async function getOffer(data) {
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

async function submitResult(data) {
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

async function syncLicitacion(data) {
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

// Supabase API Request helper
async function supabaseApiRequest(apiKey, action, body = null) {
  const response = await fetch(`${EXTENSION_API_ENDPOINT}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  return await response.json();
}

// ============================================
// PENDING SYNC SERVER FUNCTIONS (new)
// ============================================

async function getApiKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return apiKey;
}

async function getPendingSyncStatus() {
  const { pendingSyncEnabled, lastPendingSyncCheck, pendingTasksProcessed } = 
    await chrome.storage.local.get(['pendingSyncEnabled', 'lastPendingSyncCheck', 'pendingTasksProcessed']);
  
  return {
    success: true,
    enabled: pendingSyncEnabled !== false,
    lastCheck: lastPendingSyncCheck,
    tasksProcessed: pendingTasksProcessed || 0
  };
}

async function checkPendingTasks() {
  // Prevent concurrent processing
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
    
    const response = await fetch(`${PENDING_SYNC_URL}/api/pending-sync?limit=5`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[PendingSync] Failed to fetch tasks:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const tasks = data.items || [];
    
    console.log(`[PendingSync] Found ${tasks.length} pending task(s)`);
    
    await chrome.storage.local.set({
      lastPendingSyncCheck: new Date().toISOString()
    });
    
    // Process each task
    let processed = 0;
    for (const task of tasks) {
      try {
        await processTask(task);
        processed++;
      } catch (error) {
        console.error(`[PendingSync] Error processing task ${task.id}:`, error);
      }
    }
    
    // Update processed count
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

async function processTask(task) {
  console.log(`[PendingSync] Processing task ${task.id}: ${task.kind} - ${task.url}`);
  
  let tab = null;
  
  try {
    // Open hidden tab
    tab = await chrome.tabs.create({
      url: task.url,
      active: false
    });
    
    console.log(`[PendingSync] Opened tab ${tab.id} for ${task.url}`);
    
    // Wait for page to load
    await waitForTabLoad(tab.id);
    
    console.log(`[PendingSync] Tab ${tab.id} loaded, injecting scraper...`);
    
    // Inject scraper based on task kind
    const scraperFile = getScraperForKind(task.kind);
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [scraperFile]
    });
    
    // Get scraped data from content script via message
    const scrapedData = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Scraper timeout'));
      }, 30000);
      
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
    
    // Close tab
    await chrome.tabs.remove(tab.id);
    tab = null;
    
    // Send results to server
    await sendComplete(task.id, scrapedData, task.kind);
    
    console.log(`[PendingSync] Task ${task.id} completed successfully`);
    
  } catch (error) {
    console.error(`[PendingSync] Task ${task.id} failed:`, error);
    
    // Close tab if still open
    if (tab) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        // Tab may already be closed
      }
    }
    
    // Report failure to server
    await sendFailed(task.id, error.message);
    
    throw error;
  }
}

function getScraperForKind(kind) {
  // All scraping is handled by the existing content.js + scraper.js
  // The content script will handle different kinds
  return 'scraper.js';
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, 60000);
    
    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Add small delay for JS execution
        setTimeout(resolve, 1000);
      }
    }
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendComplete(taskId, data, kind) {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    throw new Error('No API key for sendComplete');
  }
  
  // Normalize payload based on kind
  let payload = {};
  
  switch(kind) {
    case 'compra_agil_list':
      payload = {
        licitaciones: data.licitaciones || []
      };
      break;
      
    case 'compra_agil_detail':
      payload = {
        licitaciones: data.licitacion ? [data.licitacion] : [],
        items: data.items || []
      };
      
      // Sincronizar directamente a Supabase si hay API key
      try {
        const { apiKey } = await chrome.storage.local.get('apiKey');
        if (apiKey && payload.licitaciones && payload.licitaciones.length > 0) {
          const licitacion = payload.licitaciones[0];
          const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-compras-agiles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify({
              compras_agiles: [licitacion],
              items: payload.items || []
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('[FirmaVB] Compra ágil sincronizada a Supabase:', licitacion.codigo, result);
          } else {
            const error = await response.json();
            console.warn('[FirmaVB] Error sincronizando compra ágil a Supabase:', error);
          }
        }
      } catch (syncError) {
        console.error('[FirmaVB] Error en sync directo de compra ágil:', syncError);
        // Continuar con el flujo normal aunque falle el sync directo
      }
      break;
      
    case 'oc_detail':
      payload = {
        orden_compra: data.orden_compra || data.header,
        items: data.items || []
      };
      
      // Sincronizar directamente a Supabase si hay API key
      try {
        const { apiKey } = await chrome.storage.local.get('apiKey');
        if (apiKey && payload.orden_compra && payload.orden_compra.codigo) {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-ordenes-compra`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify({
              ordenes_compra: [payload.orden_compra],
              items: payload.items || []
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('[FirmaVB] Orden de compra sincronizada a Supabase:', payload.orden_compra.codigo, result);
          } else {
            const error = await response.json();
            console.warn('[FirmaVB] Error sincronizando OC a Supabase:', error);
          }
        }
      } catch (syncError) {
        console.error('[FirmaVB] Error en sync directo de OC:', syncError);
        // Continuar con el flujo normal aunque falle el sync directo
      }
      break;
      
    case 'licitacion_detail':
      payload = {
        licitacion: data.licitacion || data.row
      };
      break;
      
    default:
      payload = data;
  }
  
  console.log(`[PendingSync] Sending complete for task ${taskId}:`, { kind, payload });
  
  const response = await fetch(`${PENDING_SYNC_URL}/api/pending-sync/complete`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: taskId,
      payload: payload
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`sendComplete failed: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
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
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: taskId,
        status: 'failed',
        last_error: errorMsg
      })
    });
    
    if (!response.ok) {
      console.warn(`[PendingSync] sendFailed request failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[PendingSync] sendFailed error:', error);
  }
}

// Handle scraped data from content script
async function handleScrapedData(data, sender) {
  // Si es una orden de compra, sincronizarla directamente a Supabase
  if (data.orden_compra && data.orden_compra.codigo) {
    try {
      const { apiKey } = await chrome.storage.local.get('apiKey');
      if (apiKey) {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-ordenes-compra`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            ordenes_compra: [data.orden_compra],
            items: data.items || []
          })
        });
        
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
  
  // Para otros tipos de datos, usar el flujo existente
  console.log('[FirmaVB] Received scraped data from tab:', sender.tab?.id, data);
  
  // Store temporarily for processTask to retrieve
  await chrome.storage.local.set({
    [`scrapedData_${sender.tab?.id}`]: data
  });
  
  return { success: true };
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}

// ============================================
// TAB BADGE
// ============================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('mercadopublico.cl')) {
      chrome.action.setBadgeText({ text: '●', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
