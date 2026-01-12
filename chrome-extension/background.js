// FirmaVB Postulador - Background Service Worker
const SUPABASE_URL = 'https://euzqadopjvdszcdjegmo.supabase.co';
const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;
const SYNC_ALARM_NAME = 'firmavb-sync';
const SYNC_INTERVAL_MINUTES = 30;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('FirmaVB Postulador installed');
  
  // Set up periodic sync alarm
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('Running scheduled sync...');
    await syncMatches();
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  // Return true to indicate async response
  return true;
});

async function handleMessage(message) {
  const { action, data } = message;
  
  switch (action) {
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
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function getConfig() {
  const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'settings']);
  return {
    success: true,
    hasApiKey: !!stored.apiKey,
    clienteInfo: stored.clienteInfo || null,
    settings: stored.settings || { notifications: true, autoSync: true }
  };
}

async function setApiKey(apiKey) {
  // Verify API key with backend
  const response = await apiRequest(apiKey, 'verify');
  
  if (response.success && response.cliente) {
    await chrome.storage.local.set({
      apiKey,
      clienteInfo: response.cliente
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
    
    const response = await apiRequest(apiKey, 'get-matches');
    
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
    console.error('Sync error:', error);
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
  
  const response = await apiRequest(apiKey, 'get-offer', body);
  
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
  
  const response = await apiRequest(apiKey, 'submit-result', {
    oferta_id: data.ofertaId,
    exito: data.exito,
    mensaje: data.mensaje,
    datos_adicionales: data.datosAdicionales
  });
  
  if (response.success) {
    // Refresh matches after submission
    await syncMatches();
    return { success: true, estado: response.estado };
  }
  
  throw new Error(response.error || 'Failed to submit result');
}

// Sync licitacion from MercadoPúblico page
async function syncLicitacion(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  
  if (!apiKey) {
    console.log('No API key, skipping licitacion sync');
    return { success: false, error: 'No API key configured' };
  }
  
  const { licitacion, items } = data;
  
  console.log('Syncing licitacion:', licitacion?.id_licitacion, 'items:', items?.length);
  
  const response = await apiRequest(apiKey, 'sync-licitacion', { licitacion, items });
  
  if (response.success) {
    console.log('Licitacion synced successfully');
    return { success: true, message: response.message };
  }
  
  console.warn('Licitacion sync failed:', response.error);
  return { success: false, error: response.error };
}

// API Request helper
async function apiRequest(apiKey, action, body = null) {
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

// Notifications
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}

// Update badge when on MercadoPúblico
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
