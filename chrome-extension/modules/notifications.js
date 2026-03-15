// FirmaVB Postulador - Notifications & Badge Module
// ==================================================
// Handles Chrome notifications and browser action badge.

export function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  });
}

export function updateBadge(tabId, url) {
  if (url && url.includes('mercadopublico.cl')) {
    chrome.action.setBadgeText({ text: '●', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}
