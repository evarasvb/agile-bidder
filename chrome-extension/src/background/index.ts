// Background Service Worker for FirmaVB Postulador
import { api } from '../utils/api';
import { storage } from '../utils/storage';
import type { ExtensionMessage, ExtensionResponse, MatchOportunidad } from '../utils/types';

const SYNC_ALARM_NAME = 'fvb-sync-matches';

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('FirmaVB Postulador installed');
  
  // Set up periodic sync alarm
  const settings = await storage.getSettings();
  if (settings.autoSync) {
    chrome.alarms.create(SYNC_ALARM_NAME, {
      periodInMinutes: settings.syncInterval
    });
  }
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    await syncMatches();
  }
});

// Sync matches from API
async function syncMatches(): Promise<MatchOportunidad[]> {
  try {
    const apiKey = await storage.getApiKey();
    if (!apiKey) {
      console.log('No API key configured, skipping sync');
      return [];
    }

    api.setApiKey(apiKey);
    
    const oldMatches = await storage.getMatches();
    const newMatches = await api.getMatches();
    
    await storage.setMatches(newMatches);

    // Check for new matches and notify
    const settings = await storage.getSettings();
    if (settings.notifications) {
      const newItems = newMatches.filter(
        m => !oldMatches.some(om => om.oferta_id === m.oferta_id)
      );

      if (newItems.length > 0) {
        showNotification(
          'Nuevas Oportunidades',
          `Tienes ${newItems.length} nueva(s) oportunidad(es) con match`
        );
      }
    }

    console.log(`Synced ${newMatches.length} matches`);
    return newMatches;
  } catch (error) {
    console.error('Error syncing matches:', error);
    return [];
  }
}

// Show notification
function showNotification(title: string, message: string) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: `FirmaVB: ${title}`,
    message
  });
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse: (response: ExtensionResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
);

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.action) {
    case 'GET_CONFIG': {
      const [apiKey, clienteInfo, settings] = await Promise.all([
        storage.getApiKey(),
        storage.getClienteInfo(),
        storage.getSettings()
      ]);
      return {
        success: true,
        data: { apiKey, clienteInfo, settings }
      };
    }

    case 'SET_CONFIG': {
      const { apiKey } = message.payload;
      
      api.setApiKey(apiKey);
      
      try {
        // Verify API key and get cliente info
        const clienteInfo = await api.verifyApiKey();
        
        await Promise.all([
          storage.setApiKey(apiKey),
          storage.setClienteInfo(clienteInfo)
        ]);

        // Trigger initial sync
        await syncMatches();

        return { success: true, data: { clienteInfo } };
      } catch (error) {
        return { success: false, error: 'API key inválida' };
      }
    }

    case 'SYNC_MATCHES': {
      const matches = await syncMatches();
      return { success: true, data: { matches } };
    }

    case 'GET_MATCHES': {
      const matches = await storage.getMatches();
      const lastSync = await storage.getLastSync();
      return { success: true, data: { matches, lastSync } };
    }

    case 'GET_OFFER': {
      const { ofertaId, licitacionId } = message.payload;
      
      const apiKey = await storage.getApiKey();
      if (!apiKey) {
        return { success: false, error: 'No configurado' };
      }

      api.setApiKey(apiKey);

      try {
        const oferta = ofertaId 
          ? await api.getOfferData(ofertaId)
          : await api.getOfferByLicitacion(licitacionId);
        
        return { success: true, data: { oferta } };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    case 'SUBMIT_RESULT': {
      const { ofertaId, result } = message.payload;
      
      const apiKey = await storage.getApiKey();
      if (!apiKey) {
        return { success: false, error: 'No configurado' };
      }

      api.setApiKey(apiKey);

      try {
        const response = await api.submitResult(ofertaId, result);
        
        // Refresh matches after submit
        await syncMatches();

        return { success: true, data: response };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    default:
      return { success: false, error: 'Acción no reconocida' };
  }
}

// Listen for tab updates to detect MercadoPúblico pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('mercadopublico.cl')) {
    // Badge to show extension is active on this page
    chrome.action.setBadgeText({ text: 'MP', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId });
  }
});
