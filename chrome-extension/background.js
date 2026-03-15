// FirmaVB Postulador - Background Service Worker
// ===============================================
// Orchestration file: lifecycle, alarms, and message routing.
// Business logic is split into modules under ./modules/.

import {
  SYNC_ALARM_NAME,
  PENDING_SYNC_ALARM_NAME,
  SYNC_INTERVAL_MINUTES,
  PENDING_SYNC_INTERVAL_MINUTES
} from './config.js';

import {
  getConfig,
  setApiKey,
  syncMatches,
  getStoredMatches,
  getOffer,
  submitResult,
  syncLicitacion,
  handleScrapedData
} from './modules/supabase-api.js';

import {
  checkPendingTasks,
  getPendingSyncStatus
} from './modules/pending-sync.js';

import { updateBadge } from './modules/notifications.js';

// ============================================
// EXTENSION LIFECYCLE
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FirmaVB] Extension installed');
  ensureAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[FirmaVB] Browser started, verifying alarms...');
  ensureAlarms();
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('[FirmaVB] Service worker suspending — state is persisted in chrome.storage');
});

function ensureAlarms() {
  chrome.alarms.get(SYNC_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MINUTES });
    }
  });

  chrome.alarms.get(PENDING_SYNC_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(PENDING_SYNC_ALARM_NAME, { periodInMinutes: PENDING_SYNC_INTERVAL_MINUTES });
    }
  });
}

// ============================================
// ALARM HANDLING
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[FirmaVB] Alarm triggered:', alarm.name);

  if (alarm.name === SYNC_ALARM_NAME) {
    await syncMatches();
  }

  if (alarm.name === PENDING_SYNC_ALARM_NAME) {
    await checkPendingTasks();
  }
});

// ============================================
// MESSAGE HANDLING
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { action, data } = message;

  switch (action) {
    case 'GET_CONFIG':              return getConfig();
    case 'SET_API_KEY':             return setApiKey(data.apiKey);
    case 'SYNC_MATCHES':            return syncMatches();
    case 'GET_MATCHES':             return getStoredMatches();
    case 'GET_OFFER':               return getOffer(data);
    case 'SUBMIT_RESULT':           return submitResult(data);
    case 'SYNC_LICITACION':         return syncLicitacion(data);
    case 'CHECK_PENDING_TASKS':     return checkPendingTasks();
    case 'GET_PENDING_SYNC_STATUS': return getPendingSyncStatus();
    case 'SCRAPED_DATA':            return handleScrapedData(data, sender);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================
// TAB BADGE
// ============================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tabId, tab.url);
  }
});
