// Content Script for FirmaVB Postulador
// Injected into mercadopublico.cl pages

import type { PageInfo, ExtractedItem, OfertaData, ExtensionMessage } from '../utils/types';

console.log('FirmaVB Postulador: Content script loaded');

// Detect page info
function detectPageInfo(): PageInfo {
  const pageUrl = window.location.href;
  const isCompraAgil = pageUrl.includes('/CompraAgil/') || 
                       pageUrl.includes('/Procurement/Modules/RFB/');
  
  // Try to extract licitacion code from URL or page content
  let codigoLicitacion: string | null = null;
  
  // Try URL patterns
  const urlMatch = pageUrl.match(/(?:Ficha|DetailsAcquisition)[\/\?].*?(\d{4,}-\d+-[A-Z0-9]+)/i);
  if (urlMatch) {
    codigoLicitacion = urlMatch[1];
  }
  
  // Try from page content if not found in URL
  if (!codigoLicitacion) {
    const codeElements = document.querySelectorAll('[id*="CodigoExterno"], [class*="codigo"], .licitacion-code');
    for (const el of codeElements) {
      const text = el.textContent?.trim();
      if (text && /^\d{4,}-\d+-[A-Z0-9]+$/i.test(text)) {
        codigoLicitacion = text;
        break;
      }
    }
  }

  // Extract items from the page
  const items = extractItems();

  // Check if user is logged in
  const isLoggedIn = checkLoginStatus();

  return {
    isCompraAgil,
    codigoLicitacion,
    items,
    isLoggedIn,
    pageUrl
  };
}

function extractItems(): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  
  // Try to find items table - common patterns in MercadoPúblico
  const tables = document.querySelectorAll('table');
  
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr, tr:first-child');
    if (!headerRow) continue;

    const headers = Array.from(headerRow.querySelectorAll('th, td'))
      .map(h => h.textContent?.toLowerCase().trim() || '');

    // Check if this looks like an items table
    const hasProductColumn = headers.some(h => 
      h.includes('producto') || h.includes('descripción') || h.includes('item')
    );
    const hasQuantityColumn = headers.some(h => 
      h.includes('cantidad') || h.includes('cant')
    );

    if (hasProductColumn && hasQuantityColumn) {
      const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          items.push({
            linea: index + 1,
            nombre: cells[0]?.textContent?.trim() || '',
            descripcion: cells[1]?.textContent?.trim() || '',
            cantidad: parseFloat(cells[2]?.textContent?.replace(/[^\d.,]/g, '') || '1'),
            unidad: cells[3]?.textContent?.trim() || 'UN'
          });
        }
      });
      
      if (items.length > 0) break;
    }
  }

  return items;
}

function checkLoginStatus(): boolean {
  // Check for common login indicators
  const logoutButton = document.querySelector('[id*="logout"], [id*="Logout"], .logout, a[href*="logout"]');
  const userMenu = document.querySelector('[id*="usuario"], [id*="user"], .user-menu, .user-info');
  
  return !!(logoutButton || userMenu);
}

// Inject FirmaVB button
function injectPostularButton(codigoLicitacion: string) {
  // Check if already injected
  if (document.getElementById('fvb-postular-btn')) return;

  // Find a good place to inject the button
  const targetSelectors = [
    '.ficha-actions',
    '.actions-container',
    '[id*="botones"]',
    '.detail-header',
    '#content-header'
  ];

  let container: Element | null = null;
  for (const selector of targetSelectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  // If no container found, create floating button
  if (!container) {
    container = document.createElement('div');
    container.id = 'fvb-floating-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
    `;
    document.body.appendChild(container);
  }

  // Create button
  const button = document.createElement('button');
  button.id = 'fvb-postular-btn';
  button.className = 'fvb-btn fvb-btn-primary';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <span>Postular con FirmaVB</span>
  `;
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    transition: all 0.2s ease;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
  });

  button.addEventListener('click', () => startAutofill(codigoLicitacion));

  container.appendChild(button);
}

// Start autofill process
async function startAutofill(codigoLicitacion: string) {
  const button = document.getElementById('fvb-postular-btn');
  if (button) {
    button.innerHTML = `
      <svg class="fvb-spinner" width="20" height="20" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <span>Cargando oferta...</span>
    `;
    (button as HTMLButtonElement).disabled = true;
  }

  try {
    // Request offer data from background
    const response = await chrome.runtime.sendMessage({
      action: 'GET_OFFER',
      payload: { licitacionId: codigoLicitacion }
    });

    if (!response.success) {
      showMessage('error', response.error || 'No se encontró oferta para esta licitación');
      resetButton();
      return;
    }

    const oferta: OfertaData = response.data.oferta;
    
    // Show confirmation modal
    showAutofillModal(oferta);

  } catch (error) {
    console.error('Error getting offer:', error);
    showMessage('error', 'Error al obtener datos de la oferta');
    resetButton();
  }
}

function resetButton() {
  const button = document.getElementById('fvb-postular-btn') as HTMLButtonElement;
  if (button) {
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>Postular con FirmaVB</span>
    `;
    button.disabled = false;
  }
}

// Show autofill confirmation modal
function showAutofillModal(oferta: OfertaData) {
  // Remove existing modal if any
  document.getElementById('fvb-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'fvb-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
  `;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    ">
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #1e293b;">
        ✅ Oferta Lista para Postular
      </h2>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Licitación</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">
          ${oferta.licitacion.titulo}
        </p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">
          ${oferta.licitacion.organismo}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: #ecfdf5; padding: 12px; border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #059669;">Valor Oferta</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #047857;">
            ${formatCurrency(oferta.valor_total)}
          </p>
        </div>
        <div style="background: #eff6ff; padding: 12px; border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #2563eb;">Margen</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #1d4ed8;">
            ${oferta.margen_total.toFixed(1)}%
          </p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e293b;">
          Productos a ofertar (${Array.isArray(oferta.productos) ? oferta.productos.length : 0})
        </p>
        <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          ${Array.isArray(oferta.productos) ? oferta.productos.map((p: any) => `
            <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span style="font-weight: 500;">${p.nombre || p.sku}</span>
              <span style="color: #64748b; margin-left: 8px;">x${p.cantidad}</span>
              <span style="float: right; color: #059669;">${formatCurrency(p.precio_ofertado || p.precio_unitario)}</span>
            </div>
          `).join('') : '<p style="padding: 12px; color: #64748b;">Sin productos</p>'}
        </div>
      </div>

      <div style="
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 20px;
      ">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          ⚠️ <strong>Importante:</strong> Se auto-rellenarán los campos del formulario. 
          Revisa los datos antes de hacer clic en "Enviar Oferta" en MercadoPúblico.
        </p>
      </div>

      <div style="display: flex; gap: 12px;">
        <button id="fvb-cancel-btn" style="
          flex: 1;
          padding: 12px;
          background: #f1f5f9;
          color: #475569;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Cancelar</button>
        <button id="fvb-confirm-btn" style="
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Auto-rellenar Formulario</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('fvb-cancel-btn')?.addEventListener('click', () => {
    modal.remove();
    resetButton();
  });

  document.getElementById('fvb-confirm-btn')?.addEventListener('click', () => {
    modal.remove();
    performAutofill(oferta);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      resetButton();
    }
  });
}

// Perform autofill
function performAutofill(oferta: OfertaData) {
  try {
    // Common field selectors in MercadoPúblico forms
    const fieldMappings = [
      { selectors: ['#NombreOferta', '[name*="NombreOferta"]', '[id*="txtNombre"]'], value: oferta.nombre_oferta },
      { selectors: ['#Observaciones', '[name*="Observaciones"]', 'textarea[id*="obs"]'], value: oferta.observaciones }
    ];

    let filledCount = 0;

    fieldMappings.forEach(({ selectors, value }) => {
      for (const selector of selectors) {
        const field = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
        if (field && value) {
          field.value = value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
          break;
        }
      }
    });

    // Try to fill price fields for each item
    if (Array.isArray(oferta.productos)) {
      oferta.productos.forEach((producto: any, index: number) => {
        const priceSelectors = [
          `#precio_${index}`,
          `[name*="precio"][data-line="${index}"]`,
          `tr:nth-child(${index + 1}) input[type="number"]`,
          `tr:nth-child(${index + 1}) input[name*="precio"]`
        ];

        for (const selector of priceSelectors) {
          const field = document.querySelector(selector) as HTMLInputElement;
          if (field) {
            field.value = String(producto.precio_ofertado || producto.precio_unitario);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            break;
          }
        }
      });
    }

    showMessage('success', `✅ Formulario auto-rellenado (${filledCount} campos). Revisa y envía manualmente.`);
    
    // Store oferta ID for result tracking
    sessionStorage.setItem('fvb_current_oferta', oferta.oferta_id);

    resetButton();

  } catch (error) {
    console.error('Autofill error:', error);
    showMessage('error', 'Error al auto-rellenar. Verifica manualmente.');
    resetButton();
  }
}

// Show message toast
function showMessage(type: 'success' | 'error' | 'info', message: string) {
  const existing = document.getElementById('fvb-toast');
  existing?.remove();

  const colors = {
    success: { bg: '#ecfdf5', border: '#10b981', text: '#047857' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' }
  };

  const toast = document.createElement('div');
  toast.id = 'fvb-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${colors[type].bg};
    border: 1px solid ${colors[type].border};
    border-radius: 8px;
    color: ${colors[type].text};
    font-size: 14px;
    font-weight: 500;
    z-index: 100001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    animation: fvb-slideIn 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fvb-slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes fvb-slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fvb-slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize
function init() {
  const pageInfo = detectPageInfo();
  console.log('FirmaVB Page Info:', pageInfo);

  if (pageInfo.isCompraAgil && pageInfo.codigoLicitacion) {
    injectPostularButton(pageInfo.codigoLicitacion);
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    if (message.action === 'PAGE_INFO') {
      sendResponse({ success: true, data: pageInfo });
    }
    return true;
  });
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
