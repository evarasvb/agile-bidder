// FirmaVB Postulador - Popup Script
// Configuración de Supabase
const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;

// Estado de la aplicación
let currentView = 'loading';
let clienteInfo = null;
let matches = [];
let lastSync = null;

// Elementos del DOM
const views = {
  loading: document.getElementById('loading-view'),
  login: document.getElementById('login-view'),
  main: document.getElementById('main-view'),
  settings: document.getElementById('settings-view')
};

// Inicialización
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  await loadConfig();
}

function bindEvents() {
  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('api-key').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Main view
  document.getElementById('sync-btn').addEventListener('click', handleSync);
  document.getElementById('settings-btn').addEventListener('click', () => showView('settings'));

  // Settings
  document.getElementById('back-btn').addEventListener('click', () => showView('main'));
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Settings checkboxes
  document.getElementById('notifications-enabled').addEventListener('change', saveSettings);
  document.getElementById('auto-sync-enabled').addEventListener('change', saveSettings);
}

function showView(viewName) {
  Object.keys(views).forEach(key => {
    views[key].classList.toggle('hidden', key !== viewName);
  });
  currentView = viewName;
}

// API Functions
async function apiRequest(action, body = null) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  
  if (!apiKey) {
    throw new Error('API key no configurada');
  }

  const response = await fetch(`${EXTENSION_API_ENDPOINT}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// Config Management
async function loadConfig() {
  try {
    const stored = await chrome.storage.local.get(['apiKey', 'clienteInfo', 'matches', 'lastSync', 'settings']);
    
    if (stored.apiKey && stored.clienteInfo) {
      clienteInfo = stored.clienteInfo;
      matches = stored.matches || [];
      lastSync = stored.lastSync;
      
      updateMainView();
      showView('main');
      
      // Auto-sync if enabled
      const settings = stored.settings || { autoSync: true };
      if (settings.autoSync) {
        handleSync();
      }
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
  
  if (!apiKey) {
    showError(errorText, 'Ingresa tu API Key');
    return;
  }
  
  loginBtn.disabled = true;
  loginBtn.textContent = 'Conectando...';
  errorText.classList.add('hidden');
  
  try {
    // Save API key temporarily to make the request
    await chrome.storage.local.set({ apiKey });
    
    // Verify API key
    const response = await apiRequest('verify');
    
    if (response.success && response.cliente) {
      clienteInfo = response.cliente;
      await chrome.storage.local.set({ clienteInfo });
      
      // Fetch initial matches
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

// UI Updates
function updateMainView() {
  if (!clienteInfo) return;
  
  document.getElementById('client-name').textContent = clienteInfo.empresa_nombre || 'Empresa';
  document.getElementById('client-plan').textContent = clienteInfo.plan || 'Básico';
  
  // Settings view
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
  
  // Clear container safely
  container.innerHTML = '';
  
  if (!matches || matches.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Build DOM elements safely using textContent instead of innerHTML
  matches.forEach(match => {
    const score = match.match_score || 0;
    const scoreClass = score >= 80 ? 'high-score' : score >= 60 ? 'medium-score' : '';
    const deadline = formatDeadline(match.fecha_cierre);
    const isUrgent = isDeadlineUrgent(match.fecha_cierre);
    
    // Create card element
    const card = document.createElement('div');
    card.className = `match-card ${scoreClass}`;
    card.addEventListener('click', () => openLicitacion(match.link_oficial || ''));
    
    // Create header
    const header = document.createElement('div');
    header.className = 'match-header';
    
    const codeSpan = document.createElement('span');
    codeSpan.className = 'match-code';
    codeSpan.textContent = match.id_licitacion || 'N/A';
    
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'match-score';
    scoreSpan.textContent = `${score}% match`;
    
    header.appendChild(codeSpan);
    header.appendChild(scoreSpan);
    
    // Create title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'match-title';
    titleDiv.textContent = match.titulo || 'Sin título';
    
    // Create org
    const orgDiv = document.createElement('div');
    orgDiv.className = 'match-org';
    orgDiv.textContent = match.organismo || 'Organismo no especificado';
    
    // Create footer
    const footer = document.createElement('div');
    footer.className = 'match-footer';
    
    const budgetSpan = document.createElement('span');
    budgetSpan.className = 'match-budget';
    budgetSpan.textContent = formatCurrency(match.presupuesto);
    
    const deadlineSpan = document.createElement('span');
    deadlineSpan.className = `match-deadline ${isUrgent ? 'urgent' : ''}`;
    deadlineSpan.textContent = deadline;
    
    footer.appendChild(budgetSpan);
    footer.appendChild(deadlineSpan);
    
    // Assemble card
    card.appendChild(header);
    card.appendChild(titleDiv);
    card.appendChild(orgDiv);
    card.appendChild(footer);
    
    container.appendChild(card);
  });
}

function updateLastSync() {
  const element = document.getElementById('last-sync');
  
  if (lastSync) {
    const date = new Date(lastSync);
    element.textContent = `Última sincronización: ${formatTime(date)}`;
  } else {
    element.textContent = 'Última sincronización: --';
  }
}

// Utility Functions
function showError(element, message) {
  element.textContent = message;
  element.classList.remove('hidden');
}

function formatCurrency(amount) {
  if (!amount) return 'Sin presupuesto';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatTime(date) {
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDeadline(dateStr) {
  if (!dateStr) return 'Sin fecha';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMs < 0) return 'Vencida';
  if (diffHours < 24) return `${diffHours}h restantes`;
  if (diffDays === 1) return 'Mañana';
  if (diffDays <= 7) return `${diffDays} días`;
  
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short'
  });
}

function isDeadlineUrgent(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (date - now) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours < 48;
}

function openLicitacion(url) {
  if (url) {
    chrome.tabs.create({ url });
  }
}
