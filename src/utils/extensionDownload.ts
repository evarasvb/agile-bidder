import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Extension files content - embedded for download
const extensionFiles = {
  'manifest.json': `{
  "manifest_version": 3,
  "name": "FirmaVB Postulador",
  "version": "1.0.0",
  "description": "Automatiza postulaciones a Compras Ágiles en MercadoPúblico.cl - Conectado con FirmaVB",
  "author": "FirmaVB",
  
  "permissions": [
    "activeTab",
    "storage",
    "notifications",
    "alarms"
  ],
  
  "host_permissions": [
    "*://www.mercadopublico.cl/*",
    "*://*.supabase.co/*"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": [
        "*://www.mercadopublico.cl/CompraAgil/*",
        "*://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx*"
      ],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "FirmaVB Postulador"
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": ["icons/*"],
      "matches": ["*://www.mercadopublico.cl/*"]
    }
  ]
}`,

  'popup.html': `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FirmaVB Postulador</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <div id="loading-view" class="view">
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Cargando...</p>
      </div>
    </div>
    <div id="login-view" class="view hidden">
      <div class="header">
        <h1>🏢 FirmaVB</h1>
        <p class="subtitle">Postulador de Compras Ágiles</p>
      </div>
      <div class="login-form">
        <label for="api-key">API Key</label>
        <input type="password" id="api-key" placeholder="Ingresa tu API Key">
        <p class="help-text">Obtén tu API Key desde el panel de FirmaVB</p>
        <button id="login-btn" class="btn-primary">Conectar</button>
        <p id="login-error" class="error-text hidden"></p>
      </div>
    </div>
    <div id="main-view" class="view hidden">
      <div class="header">
        <div class="header-top">
          <h1>🏢 FirmaVB</h1>
          <button id="settings-btn" class="btn-icon" title="Configuración">⚙️</button>
        </div>
        <div class="client-info">
          <span id="client-name"></span>
          <span id="client-plan" class="badge"></span>
        </div>
      </div>
      <div class="sync-bar">
        <span id="last-sync">Última sincronización: --</span>
        <button id="sync-btn" class="btn-secondary">🔄 Sincronizar</button>
      </div>
      <div class="matches-section">
        <h2>Oportunidades Detectadas</h2>
        <div id="matches-list"></div>
        <p id="no-matches" class="empty-state hidden">No hay oportunidades pendientes</p>
      </div>
    </div>
    <div id="settings-view" class="view hidden">
      <div class="header">
        <div class="header-top">
          <button id="back-btn" class="btn-icon">←</button>
          <h1>Configuración</h1>
        </div>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <h3>Cuenta</h3>
          <p><strong>Empresa:</strong> <span id="settings-empresa"></span></p>
          <p><strong>RUT:</strong> <span id="settings-rut"></span></p>
          <p><strong>Plan:</strong> <span id="settings-plan"></span></p>
        </div>
        <div class="setting-group">
          <h3>Notificaciones</h3>
          <label class="checkbox-label">
            <input type="checkbox" id="notifications-enabled" checked>
            <span>Recibir notificaciones de nuevas oportunidades</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="auto-sync-enabled" checked>
            <span>Sincronización automática cada 30 minutos</span>
          </label>
        </div>
        <button id="logout-btn" class="btn-danger">Cerrar Sesión</button>
      </div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>`,

  'popup.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 380px; min-height: 400px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }
.hidden { display: none !important; }
.view { padding: 16px; }
.header { margin-bottom: 16px; }
.header h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
.header-top { display: flex; justify-content: space-between; align-items: center; }
.subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
.client-info { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; }
.badge { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.login-form { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.login-form label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
.login-form input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
.login-form input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.help-text { font-size: 12px; color: #64748b; margin-top: 6px; }
.error-text { font-size: 12px; color: #dc2626; margin-top: 8px; }
.btn-primary { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
.btn-secondary { padding: 6px 12px; background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; }
.btn-secondary:hover { background: #f9fafb; }
.btn-icon { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 4px; }
.btn-icon:hover { background: #e2e8f0; }
.btn-danger { width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-danger:hover { background: #b91c1c; }
.sync-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: white; border-radius: 8px; margin-bottom: 16px; font-size: 12px; color: #64748b; }
.matches-section h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #374151; }
#matches-list { display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto; }
.match-card { background: white; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); cursor: pointer; border-left: 4px solid #3b82f6; }
.match-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-1px); }
.match-card.high-score { border-left-color: #22c55e; }
.match-card.medium-score { border-left-color: #eab308; }
.match-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.match-code { font-size: 11px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 2px 6px; border-radius: 4px; }
.match-score { font-size: 12px; font-weight: 700; color: #22c55e; }
.match-title { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.4; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.match-org { font-size: 11px; color: #64748b; margin-bottom: 8px; }
.match-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
.match-budget { font-weight: 600; color: #059669; }
.match-deadline { color: #64748b; }
.match-deadline.urgent { color: #dc2626; font-weight: 600; }
.empty-state { text-align: center; padding: 40px 20px; color: #64748b; font-size: 14px; }
.settings-content { display: flex; flex-direction: column; gap: 20px; }
.setting-group { background: white; padding: 16px; border-radius: 10px; }
.setting-group h3 { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; }
.setting-group p { font-size: 13px; color: #64748b; margin-bottom: 6px; }
.setting-group p strong { color: #1e293b; }
.checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #374151; margin-bottom: 10px; cursor: pointer; }
.checkbox-label input { width: 16px; height: 16px; cursor: pointer; }`,

  // SECURITY FIX: popup.js now uses DOM methods instead of innerHTML to prevent XSS
  'popup.js': `const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const EXTENSION_API_ENDPOINT = SUPABASE_URL + '/functions/v1/extension-api';
let currentView = 'loading';
let clienteInfo = null;
let matches = [];
let lastSync = null;

const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  main: document.getElementById('main-view'),
  settings: document.getElementById('settings-view')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  await loadConfig();
}

function bindEvents() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('api-key').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('sync-btn').addEventListener('click', handleSync);
  document.getElementById('settings-btn').addEventListener('click', () => showView('settings'));
  document.getElementById('back-btn').addEventListener('click', () => showView('main'));
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('notifications-enabled').addEventListener('change', saveSettings);
  document.getElementById('auto-sync-enabled').addEventListener('change', saveSettings);
}

function showView(viewName) {
  Object.keys(views).forEach(key => { views[key].classList.toggle('hidden', key !== viewName); });
  currentView = viewName;
}

async function apiRequest(action, body = null) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('API key no configurada');
  const response = await fetch(EXTENSION_API_ENDPOINT + '?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

async function loadConfig() {
  try {
    const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'matches', 'lastSync', 'settings']);
    if (stored.apiKey && stored.clienteInfo) {
      clienteInfo = stored.clienteInfo;
      matches = stored.matches || [];
      lastSync = stored.lastSync;
      updateMainView();
      showView('main');
      const settings = stored.settings || { autoSync: true };
      if (settings.autoSync) handleSync();
    } else {
      showView('login');
    }
  } catch (error) {
    console.error('Error loading config:', error);
    showView('login');
  }
}

async function handleLogin() {
  const apiKeyInput = document.getElementById('api-key');
  const loginBtn = document.getElementById('login-btn');
  const errorText = document.getElementById('login-error');
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) { showError(errorText, 'Ingresa tu API Key'); return; }
  loginBtn.disabled = true;
  loginBtn.textContent = 'Conectando...';
  errorText.classList.add('hidden');
  try {
    await chrome.storage.local.set({ apiKey });
    const response = await apiRequest('verify');
    if (response.success && response.cliente) {
      clienteInfo = response.cliente;
      await chrome.storage.local.set({ clienteInfo });
      await handleSync();
      updateMainView();
      showView('main');
    } else {
      throw new Error('API Key inválida');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError(errorText, error.message || 'Error al conectar');
    await chrome.storage.local.remove(['apiKey']);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Conectar';
  }
}

async function handleSync() {
  const syncBtn = document.getElementById('sync-btn');
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Sincronizando...';
  try {
    const response = await apiRequest('get-matches');
    if (response.success) {
      matches = response.matches || [];
      lastSync = new Date().toISOString();
      await chrome.storage.local.set({ matches, lastSync });
      renderMatches();
      updateLastSync();
    }
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 Sincronizar';
  }
}

async function handleLogout() {
  await chrome.storage.local.clear();
  clienteInfo = null;
  matches = [];
  lastSync = null;
  document.getElementById('api-key').value = '';
  showView('login');
}

async function saveSettings() {
  const settings = {
    notifications: document.getElementById('notifications-enabled').checked,
    autoSync: document.getElementById('auto-sync-enabled').checked
  };
  await chrome.storage.local.set({ settings });
}

function updateMainView() {
  if (!clienteInfo) return;
  document.getElementById('client-name').textContent = clienteInfo.empresa_nombre || 'Empresa';
  document.getElementById('client-plan').textContent = clienteInfo.plan || 'Básico';
  document.getElementById('settings-empresa').textContent = clienteInfo.empresa_nombre || '-';
  document.getElementById('settings-rut').textContent = clienteInfo.rut || '-';
  document.getElementById('settings-plan').textContent = clienteInfo.plan || 'Básico';
  renderMatches();
  updateLastSync();
}

// SECURITY FIX: Use DOM methods instead of innerHTML to prevent XSS
function renderMatches() {
  const container = document.getElementById('matches-list');
  const emptyState = document.getElementById('no-matches');
  container.innerHTML = '';
  if (!matches || matches.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  matches.forEach(function(match) {
    var score = match.match_score || 0;
    var scoreClass = score >= 80 ? 'high-score' : score >= 60 ? 'medium-score' : '';
    var card = document.createElement('div');
    card.className = 'match-card ' + scoreClass;
    card.addEventListener('click', function() { openLicitacion(match.link_oficial || ''); });
    var header = document.createElement('div');
    header.className = 'match-header';
    var codeSpan = document.createElement('span');
    codeSpan.className = 'match-code';
    codeSpan.textContent = match.id_licitacion || 'N/A';
    var scoreSpan = document.createElement('span');
    scoreSpan.className = 'match-score';
    scoreSpan.textContent = score + '% match';
    header.appendChild(codeSpan);
    header.appendChild(scoreSpan);
    var titleDiv = document.createElement('div');
    titleDiv.className = 'match-title';
    titleDiv.textContent = match.titulo || 'Sin título';
    var orgDiv = document.createElement('div');
    orgDiv.className = 'match-org';
    orgDiv.textContent = match.organismo || 'Organismo no especificado';
    var footer = document.createElement('div');
    footer.className = 'match-footer';
    var budgetSpan = document.createElement('span');
    budgetSpan.className = 'match-budget';
    budgetSpan.textContent = formatCurrency(match.presupuesto);
    var deadlineSpan = document.createElement('span');
    deadlineSpan.className = 'match-deadline';
    deadlineSpan.textContent = formatDeadline(match.fecha_cierre);
    footer.appendChild(budgetSpan);
    footer.appendChild(deadlineSpan);
    card.appendChild(header);
    card.appendChild(titleDiv);
    card.appendChild(orgDiv);
    card.appendChild(footer);
    container.appendChild(card);
  });
}

function updateLastSync() {
  var element = document.getElementById('last-sync');
  if (lastSync) {
    var date = new Date(lastSync);
    element.textContent = 'Última sincronización: ' + date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } else {
    element.textContent = 'Última sincronización: --';
  }
}

function showError(element, message) { element.textContent = message; element.classList.remove('hidden'); }

function formatCurrency(amount) {
  if (!amount) return 'Sin presupuesto';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

function formatDeadline(dateStr) {
  if (!dateStr) return 'Sin fecha';
  var date = new Date(dateStr);
  var now = new Date();
  var diffHours = Math.floor((date - now) / (1000 * 60 * 60));
  if (diffHours < 0) return 'Vencida';
  if (diffHours < 24) return diffHours + 'h restantes';
  var diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Mañana';
  if (diffDays <= 7) return diffDays + ' días';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function openLicitacion(url) { if (url) chrome.tabs.create({ url: url }); }`,

  'background.js': `const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const EXTENSION_API_ENDPOINT = SUPABASE_URL + '/functions/v1/extension-api';
const SYNC_ALARM_NAME = 'firmavb-sync';

chrome.runtime.onInstalled.addListener(() => {
  console.log('FirmaVB Postulador installed');
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) await syncMatches();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  const { action, data } = message;
  switch (action) {
    case 'GET_CONFIG': return await getConfig();
    case 'SET_API_KEY': return await setApiKey(data.apiKey);
    case 'SYNC_MATCHES': return await syncMatches();
    case 'GET_MATCHES': return await getStoredMatches();
    case 'GET_OFFER': return await getOffer(data);
    case 'SUBMIT_RESULT': return await submitResult(data);
    default: throw new Error('Unknown action: ' + action);
  }
}

async function getConfig() {
  const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'settings']);
  return { success: true, hasApiKey: !!stored.apiKey, clienteInfo: stored.clienteInfo || null, settings: stored.settings || { notifications: true, autoSync: true } };
}

async function setApiKey(apiKey) {
  const response = await apiRequest(apiKey, 'verify');
  if (response.success && response.cliente) {
    await chrome.storage.local.set({ apiKey, clienteInfo: response.cliente });
    await syncMatches();
    return { success: true, cliente: response.cliente };
  }
  throw new Error('API Key inválida');
}

async function syncMatches() {
  try {
    const { apiKey, settings } = await chrome.storage.local.get(['apiKey', 'settings']);
    if (!apiKey) return { success: false, error: 'No API key configured' };
    const response = await apiRequest(apiKey, 'get-matches');
    if (response.success) {
      const { matches: oldMatches } = await chrome.storage.local.get('matches');
      const newMatches = response.matches || [];
      await chrome.storage.local.set({ matches: newMatches, lastSync: new Date().toISOString() });
      if (settings?.notifications && oldMatches) {
        const oldIds = new Set(oldMatches.map(m => m.id_licitacion));
        const brandNew = newMatches.filter(m => !oldIds.has(m.id_licitacion));
        if (brandNew.length > 0) showNotification('Nuevas oportunidades', 'Se encontraron ' + brandNew.length + ' nueva(s) licitación(es)');
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
  return { success: true, matches: matches || [], lastSync };
}

async function getOffer(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('No API key configured');
  const body = data.ofertaId ? { oferta_id: data.ofertaId } : { licitacion_id: data.licitacionId };
  const response = await apiRequest(apiKey, 'get-offer', body);
  if (response.success) return { success: true, oferta: response.oferta };
  throw new Error(response.error || 'Failed to get offer');
}

async function submitResult(data) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('No API key configured');
  const response = await apiRequest(apiKey, 'submit-result', { oferta_id: data.ofertaId, exito: data.exito, mensaje: data.mensaje, datos_adicionales: data.datosAdicionales });
  if (response.success) { await syncMatches(); return { success: true, estado: response.estado }; }
  throw new Error(response.error || 'Failed to submit result');
}

async function apiRequest(apiKey, action, body = null) {
  const response = await fetch(EXTENSION_API_ENDPOINT + '?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: body ? JSON.stringify(body) : undefined
  });
  return await response.json();
}

function showNotification(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title, message });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('mercadopublico.cl')) {
    chrome.action.setBadgeText({ text: '●', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  }
});`,

  // SECURITY FIX: content.js now uses DOM methods instead of innerHTML to prevent XSS
  'content.js': `(function() {
  'use strict';
  var BUTTON_ID = 'firmavb-postular-btn';
  var MODAL_ID = 'firmavb-modal';

  function detectPageInfo() {
    var url = window.location.href;
    var isCompraAgil = url.includes('/CompraAgil/');
    var isDetalle = url.includes('DetailsAcquisition.aspx');
    var codigoLicitacion = null;
    var urlMatch = url.match(/idLicitacion=([^&]+)/i) || url.match(/CodigoExterno=([^&]+)/i);
    if (urlMatch) codigoLicitacion = urlMatch[1];
    if (!codigoLicitacion) {
      var codeElements = document.querySelectorAll('[id*="codigo"], [id*="Codigo"], .codigo-licitacion');
      for (var i = 0; i < codeElements.length; i++) {
        var match = codeElements[i].textContent.match(/\\d{4,}-\\d+-[A-Z]+\\d+/);
        if (match) { codigoLicitacion = match[0]; break; }
      }
    }
    return { isCompraAgil: isCompraAgil, isDetalle: isDetalle, codigoLicitacion: codigoLicitacion, url: url };
  }

  function injectButton(codigoLicitacion) {
    if (document.getElementById(BUTTON_ID)) return;
    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = '🏢 Postular con FirmaVB';
    button.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;padding:14px 24px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(59,130,246,0.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
    button.addEventListener('click', function() { startAutofill(codigoLicitacion); });
    document.body.appendChild(button);
  }

  async function startAutofill(codigoLicitacion) {
    var button = document.getElementById(BUTTON_ID);
    var originalText = button.textContent;
    button.textContent = '⏳ Cargando oferta...';
    button.disabled = true;
    try {
      var response = await chrome.runtime.sendMessage({ action: 'GET_OFFER', data: { licitacionId: codigoLicitacion } });
      if (response.success && response.oferta) {
        showAutofillModal(response.oferta, codigoLicitacion);
      } else {
        showMessage('error', response.error || 'No se encontró oferta');
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('error', 'Error al obtener datos');
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  // SECURITY FIX: Use DOM methods instead of innerHTML to prevent XSS
  function showAutofillModal(oferta, codigoLicitacion) {
    var existingModal = document.getElementById(MODAL_ID);
    if (existingModal) existingModal.remove();
    var productos = oferta.productos_ofertados || [];
    var valorTotal = oferta.valor_total || productos.reduce(function(sum, p) { return sum + (p.precio_total || 0); }, 0);
    
    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;';
    
    var modalContent = document.createElement('div');
    modalContent.style.cssText = 'background:white;border-radius:16px;padding:28px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;';
    
    var headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:20px;';
    var title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:20px;';
    title.textContent = '🏢 Confirmar Postulación';
    var closeBtn = document.createElement('button');
    closeBtn.id = 'firmavb-modal-close';
    closeBtn.style.cssText = 'background:none;border:none;font-size:24px;cursor:pointer;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() { modal.remove(); });
    headerDiv.appendChild(title);
    headerDiv.appendChild(closeBtn);
    
    var infoSection = document.createElement('div');
    infoSection.style.cssText = 'background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:20px;';
    var infoLabel = document.createElement('p');
    infoLabel.style.cssText = 'margin:0 0 8px;font-size:13px;color:#64748b;';
    infoLabel.textContent = 'Licitación';
    var infoValue = document.createElement('p');
    infoValue.style.cssText = 'margin:0;font-size:15px;font-weight:600;';
    infoValue.textContent = codigoLicitacion;
    infoSection.appendChild(infoLabel);
    infoSection.appendChild(infoValue);
    
    var totalSection = document.createElement('div');
    totalSection.style.cssText = 'background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;';
    var totalLabel = document.createElement('p');
    totalLabel.style.cssText = 'margin:0 0 4px;font-size:13px;color:#059669;';
    totalLabel.textContent = 'Valor Total';
    var totalValue = document.createElement('p');
    totalValue.style.cssText = 'margin:0;font-size:24px;font-weight:700;color:#047857;';
    totalValue.textContent = '$' + valorTotal.toLocaleString('es-CL');
    totalSection.appendChild(totalLabel);
    totalSection.appendChild(totalValue);
    
    var buttonsSection = document.createElement('div');
    buttonsSection.style.cssText = 'display:flex;gap:12px;';
    var cancelBtn = document.createElement('button');
    cancelBtn.id = 'firmavb-cancel';
    cancelBtn.style.cssText = 'flex:1;padding:12px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-weight:600;cursor:pointer;';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', function() { modal.remove(); });
    var confirmBtn = document.createElement('button');
    confirmBtn.id = 'firmavb-confirm';
    confirmBtn.style.cssText = 'flex:1;padding:12px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;';
    confirmBtn.textContent = 'Autocompletar';
    confirmBtn.addEventListener('click', function() { modal.remove(); performAutofill(oferta); });
    buttonsSection.appendChild(cancelBtn);
    buttonsSection.appendChild(confirmBtn);
    
    modalContent.appendChild(headerDiv);
    modalContent.appendChild(infoSection);
    modalContent.appendChild(totalSection);
    modalContent.appendChild(buttonsSection);
    modal.appendChild(modalContent);
    
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function performAutofill(oferta) {
    try {
      var productos = oferta.productos_ofertados || [];
      var filledFields = 0;
      productos.forEach(function(producto, index) {
        var selectors = ['input[name*="precio"][name*="' + index + '"]', 'tr:nth-child(' + (index + 2) + ') input[type="text"]'];
        for (var i = 0; i < selectors.length; i++) {
          var input = document.querySelector(selectors[i]);
          if (input) { input.value = producto.precio_unitario || ''; input.dispatchEvent(new Event('input', { bubbles: true })); filledFields++; break; }
        }
      });
      if (filledFields > 0) {
        showMessage('success', '✓ Se completaron ' + filledFields + ' campos');
        chrome.runtime.sendMessage({ action: 'SUBMIT_RESULT', data: { ofertaId: oferta.id, exito: true, mensaje: 'Autofill: ' + filledFields + ' campos' } });
      } else {
        showMessage('info', 'No se encontraron campos para completar');
      }
    } catch (error) {
      console.error('Autofill error:', error);
      showMessage('error', 'Error al completar formulario');
    }
  }

  function showMessage(type, text) {
    var colors = { success: { bg: '#dcfce7', border: '#22c55e', text: '#166534' }, error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }, info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' } };
    var style = colors[type] || colors.info;
    var message = document.createElement('div');
    message.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10002;padding:14px 20px;background:' + style.bg + ';border-left:4px solid ' + style.border + ';color:' + style.text + ';border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 15px rgba(0,0,0,0.1);';
    message.textContent = text;
    document.body.appendChild(message);
    setTimeout(function() { message.remove(); }, 4000);
  }

  function init() {
    var pageInfo = detectPageInfo();
    if (pageInfo.codigoLicitacion && (pageInfo.isCompraAgil || pageInfo.isDetalle)) {
      injectButton(pageInfo.codigoLicitacion);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'CHECK_PAGE') sendResponse({ success: true, pageInfo: detectPageInfo() });
    return true;
  });
})();`,

  'content.css': `#firmavb-postular-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.4); }
#firmavb-postular-btn:active { transform: scale(0.98); }
#firmavb-postular-btn:disabled { opacity: 0.7; cursor: not-allowed; }`,

  'README.md': `# FirmaVB Postulador - Chrome Extension

## Instalación

1. Descomprime este archivo ZIP
2. Abre Chrome y navega a chrome://extensions/
3. Activa el "Modo desarrollador" (esquina superior derecha)
4. Haz clic en "Cargar descomprimida"
5. Selecciona la carpeta descomprimida
6. ¡Listo! La extensión aparecerá en tu barra de herramientas

## Configuración

1. Haz clic en el icono de FirmaVB en Chrome
2. Ingresa tu API Key (obtenla desde el panel de FirmaVB)
3. Haz clic en "Conectar"

## Uso

1. Navega a una licitación en MercadoPúblico.cl
2. Verás el botón "Postular con FirmaVB" en la esquina inferior derecha
3. Haz clic para autocompletar el formulario con los datos de tu oferta

## Soporte

Si tienes problemas, contacta a soporte@firmavb.cl`
};

// Generate placeholder icon as base64 PNG
function generateIconDataUrl(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Background
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();
  
  // Letter F
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.05);
  
  return canvas.toDataURL('image/png');
}

export async function downloadExtension(): Promise<void> {
  const zip = new JSZip();
  
  // Add all text files
  for (const [filename, content] of Object.entries(extensionFiles)) {
    zip.file(filename, content);
  }
  
  // Create icons folder with generated icons
  const iconsFolder = zip.folder('icons');
  
  if (iconsFolder) {
    // Generate icons at different sizes
    const sizes = [16, 48, 128];
    
    for (const size of sizes) {
      const dataUrl = generateIconDataUrl(size);
      if (dataUrl) {
        // Convert data URL to blob
        const base64 = dataUrl.split(',')[1];
        iconsFolder.file(`icon${size}.png`, base64, { base64: true });
      }
    }
  }
  
  // Generate ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Download
  saveAs(blob, 'firmavb-extension.zip');
}
