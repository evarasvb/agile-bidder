// FirmaVB Postulador - Content Script
// Se inyecta en páginas de MercadoPúblico.cl

(function() {
  'use strict';

  const BUTTON_ID = 'firmavb-postular-btn';
  const MODAL_ID = 'firmavb-modal';

  // Detectar información de la página
  function detectPageInfo() {
    const url = window.location.href;
    const isCompraAgil = url.includes('/CompraAgil/');
    const isDetalle = url.includes('DetailsAcquisition.aspx');
    
    let codigoLicitacion = null;
    
    // Extraer código de la URL
    const urlMatch = url.match(/idLicitacion=([^&]+)/i) || 
                     url.match(/CodigoExterno=([^&]+)/i);
    if (urlMatch) {
      codigoLicitacion = urlMatch[1];
    }
    
    // Si no está en la URL, buscar en la página
    if (!codigoLicitacion) {
      const codeElements = document.querySelectorAll('[id*="codigo"], [id*="Codigo"], .codigo-licitacion');
      for (const el of codeElements) {
        const match = el.textContent.match(/\d{4,}-\d+-[A-Z]+\d+/);
        if (match) {
          codigoLicitacion = match[0];
          break;
        }
      }
    }
    
    return {
      isCompraAgil,
      isDetalle,
      codigoLicitacion,
      url,
      isLoggedIn: checkLoginStatus()
    };
  }

  function checkLoginStatus() {
    // Verificar si el usuario está logueado en MercadoPúblico
    const logoutBtn = document.querySelector('[href*="logout"], [onclick*="logout"], .cerrar-sesion');
    const userMenu = document.querySelector('.usuario-menu, .user-menu, [id*="usuario"]');
    return !!(logoutBtn || userMenu);
  }

  // Extraer items de la licitación
  function extractItems() {
    const items = [];
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const nombre = cells[0]?.textContent?.trim();
          const cantidad = cells[1]?.textContent?.trim();
          const unidad = cells[2]?.textContent?.trim();
          
          if (nombre && nombre.length > 3) {
            items.push({
              nombre,
              cantidad: parseFloat(cantidad) || 1,
              unidad: unidad || 'UN'
            });
          }
        }
      });
    });
    
    return items;
  }

  // Inyectar botón de postulación
  function injectButton(codigoLicitacion) {
    if (document.getElementById(BUTTON_ID)) return;
    
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.innerHTML = '🏢 Postular con FirmaVB';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      padding: 14px 24px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 25px rgba(59, 130, 246, 0.5)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
    });
    
    button.addEventListener('click', () => startAutofill(codigoLicitacion));
    
    document.body.appendChild(button);
  }

  // Iniciar proceso de autofill
  async function startAutofill(codigoLicitacion) {
    const button = document.getElementById(BUTTON_ID);
    const originalText = button.innerHTML;
    
    button.innerHTML = '⏳ Cargando oferta...';
    button.disabled = true;
    
    try {
      // Solicitar datos de oferta al background
      const response = await chrome.runtime.sendMessage({
        action: 'GET_OFFER',
        data: { licitacionId: codigoLicitacion }
      });
      
      if (response.success && response.oferta) {
        showAutofillModal(response.oferta, codigoLicitacion);
      } else {
        showMessage('error', response.error || 'No se encontró oferta para esta licitación');
      }
    } catch (error) {
      console.error('Error getting offer:', error);
      showMessage('error', 'Error al obtener datos de la oferta');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  // Modal de confirmación de autofill
  function showAutofillModal(oferta, codigoLicitacion) {
    // Remover modal existente
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) existingModal.remove();
    
    const productos = oferta.productos_ofertados || [];
    const valorTotal = oferta.valor_total || productos.reduce((sum, p) => sum + (p.precio_total || 0), 0);
    
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 28px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px; color: #1e293b;">🏢 Confirmar Postulación</h2>
          <button id="firmavb-modal-close" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #94a3b8;
          ">×</button>
        </div>
        
        <div style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Licitación</p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">${codigoLicitacion}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 14px; color: #374151; margin-bottom: 12px;">Productos a Ofertar (${productos.length})</h3>
          <div style="max-height: 200px; overflow-y: auto;">
            ${productos.map(p => `
              <div style="
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
              ">
                <div style="font-weight: 600; font-size: 13px; color: #1e293b; margin-bottom: 4px;">${p.nombre || p.sku}</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                  <span>${p.cantidad || 1} ${p.unidad || 'UN'}</span>
                  <span style="color: #059669; font-weight: 600;">$${(p.precio_total || 0).toLocaleString('es-CL')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="
          background: linear-gradient(135deg, #ecfdf5, #d1fae5);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
        ">
          <p style="margin: 0 0 4px; font-size: 13px; color: #059669;">Valor Total de la Oferta</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: #047857;">$${valorTotal.toLocaleString('es-CL')}</p>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="firmavb-cancel" style="
            flex: 1;
            padding: 12px;
            background: #f1f5f9;
            color: #475569;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">Cancelar</button>
          <button id="firmavb-confirm" style="
            flex: 1;
            padding: 12px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">Autocompletar Formulario</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('firmavb-modal-close').onclick = () => modal.remove();
    document.getElementById('firmavb-cancel').onclick = () => modal.remove();
    document.getElementById('firmavb-confirm').onclick = () => {
      modal.remove();
      performAutofill(oferta);
    };
    
    // Click fuera del modal para cerrar
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Ejecutar autofill en el formulario
  function performAutofill(oferta) {
    try {
      const productos = oferta.productos_ofertados || [];
      let filledFields = 0;
      
      // Buscar y llenar campos de precio
      productos.forEach((producto, index) => {
        // Buscar campos de precio por diferentes selectores
        const priceSelectors = [
          `input[name*="precio"][name*="${index}"]`,
          `input[id*="precio"][id*="${index}"]`,
          `input[name*="price"][name*="${index}"]`,
          `.item-precio:nth-child(${index + 1}) input`,
          `tr:nth-child(${index + 2}) input[type="text"]`,
          `tr:nth-child(${index + 2}) input[type="number"]`
        ];
        
        for (const selector of priceSelectors) {
          const input = document.querySelector(selector);
          if (input) {
            input.value = producto.precio_unitario || '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filledFields++;
            break;
          }
        }
      });
      
      // Buscar y llenar campo de observaciones
      const obsSelectors = [
        'textarea[name*="observ"]',
        'textarea[id*="observ"]',
        'textarea[name*="notas"]',
        '#observaciones',
        '.observaciones textarea'
      ];
      
      for (const selector of obsSelectors) {
        const textarea = document.querySelector(selector);
        if (textarea) {
          textarea.value = oferta.notas || 'Oferta generada con FirmaVB';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          filledFields++;
          break;
        }
      }
      
      if (filledFields > 0) {
        showMessage('success', `✓ Se completaron ${filledFields} campos automáticamente`);
        
        // Registrar resultado exitoso
        chrome.runtime.sendMessage({
          action: 'SUBMIT_RESULT',
          data: {
            ofertaId: oferta.id,
            exito: true,
            mensaje: `Autofill completado: ${filledFields} campos`,
            datosAdicionales: { filledFields }
          }
        });
      } else {
        showMessage('info', 'No se encontraron campos para completar. Completa el formulario manualmente.');
      }
      
    } catch (error) {
      console.error('Autofill error:', error);
      showMessage('error', 'Error al completar el formulario');
    }
  }

  // Mostrar mensaje temporal
  function showMessage(type, text) {
    const colors = {
      success: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
      error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
      info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
    };
    
    const style = colors[type] || colors.info;
    
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10002;
      padding: 14px 20px;
      background: ${style.bg};
      border-left: 4px solid ${style.border};
      color: ${style.text};
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    message.textContent = text;
    
    // Agregar animación CSS
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);
    
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => message.remove(), 300);
    }, 4000);
  }

  // Inicialización
  function init() {
    const pageInfo = detectPageInfo();
    console.log('FirmaVB: Page detected', pageInfo);
    
    if (pageInfo.codigoLicitacion && (pageInfo.isCompraAgil || pageInfo.isDetalle)) {
      injectButton(pageInfo.codigoLicitacion);
    }
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Escuchar mensajes del background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'CHECK_PAGE') {
      const pageInfo = detectPageInfo();
      sendResponse({ success: true, pageInfo });
    }
    return true;
  });

})();
