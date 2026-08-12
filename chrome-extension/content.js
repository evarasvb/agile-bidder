// FirmaVB Postulador - Content Script
// Se inyecta en páginas de MercadoPúblico.cl

(function() {
  'use strict';

  const BUTTON_ID = 'firmavb-postular-btn';
  const MODAL_ID = 'firmavb-modal';

  // Detectar información de la página
  function detectPageInfo() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    
    // Verificar que estamos en MercadoPúblico
    const isMercadoPublico = hostname.includes('mercadopublico.cl');
    const isCompraAgil = url.includes('/CompraAgil/') || url.includes('/Portal/Modules/Menu/');
    const isDetalle = url.includes('DetailsAcquisition.aspx') || url.includes('Details.aspx');
    const isListado = url.includes('/Procurement/') || url.includes('/StoreSearch/') || url.includes('/Search/');
    const isOferta = url.includes('/Offer/') || url.includes('/Postulacion/');
    const isPortal = url.includes('/Portal/');
    
    let codigoLicitacion = null;
    
    // Extraer código de la URL - múltiples patrones
    const urlPatterns = [
      /idLicitacion=([^&]+)/i,
      /CodigoExterno=([^&]+)/i,
      /idAdquisicion=([^&]+)/i,
      /qs=([^&]+)/i,
      /id=([^&]+)/i
    ];
    
    for (const pattern of urlPatterns) {
      const match = url.match(pattern);
      if (match) {
        codigoLicitacion = decodeURIComponent(match[1]);
        break;
      }
    }
    
    // Si no está en la URL, buscar en la página
    if (!codigoLicitacion) {
      const codePatterns = [
        /(\d{4,}-\d+-[A-Z]+\d+)/,  // Patrón estándar: 1234-56-LP21
        /(\d{7,})/                  // Solo números largos
      ];
      
      const codeElements = document.querySelectorAll('[id*="codigo"], [id*="Codigo"], .codigo-licitacion, [class*="codigo"], h1, h2, .titulo');
      for (const el of codeElements) {
        for (const pattern of codePatterns) {
          const match = el.textContent.match(pattern);
          if (match) {
            codigoLicitacion = match[1];
            break;
          }
        }
        if (codigoLicitacion) break;
      }
    }
    
    return {
      isMercadoPublico,
      isCompraAgil,
      isDetalle,
      isListado,
      isOferta,
      isPortal,
      codigoLicitacion,
      url,
      isLoggedIn: checkLoginStatus(),
      pageType: getPageType(url)
    };
  }

  function getPageType(url) {
    if (url.includes('/CompraAgil/')) return 'compra_agil';
    if (url.includes('DetailsAcquisition.aspx')) return 'detalle_licitacion';
    if (url.includes('/Offer/')) return 'formulario_oferta';
    if (url.includes('/Portal/Modules/Menu/')) return 'menu_principal';
    if (url.includes('/Procurement/')) return 'listado';
    if (url.includes('/StoreSearch/')) return 'busqueda';
    return 'otra';
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

  // SECURITY FIX: Inyectar botón de postulación usando DOM methods
  function injectButton(codigoLicitacion) {
    if (document.getElementById(BUTTON_ID)) return;
    
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = '🏢 Postular con FirmaVB';
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
    const originalText = button.textContent;
    
    button.textContent = '⏳ Cargando oferta...';
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
      button.textContent = originalText;
      button.disabled = false;
    }
  }

  // SECURITY FIX: Modal de confirmación usando DOM methods instead of innerHTML
  function showAutofillModal(oferta, codigoLicitacion) {
    // Remover modal existente
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) existingModal.remove();
    
    const productos = oferta.productos || oferta.productos_ofertados || [];
    const valorTotal = oferta.valor_total || productos.reduce((sum, p) => sum + (p.precio_total || 0), 0);
    
    // Create modal overlay
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
    
    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 28px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    // Create header
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
    
    const title = document.createElement('h2');
    title.style.cssText = 'margin: 0; font-size: 20px; color: #1e293b;';
    title.textContent = '🏢 Confirmar Postulación';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'firmavb-modal-close';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => modal.remove());
    
    headerDiv.appendChild(title);
    headerDiv.appendChild(closeBtn);
    
    // Create licitacion info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = 'background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 20px;';
    
    const infoLabel = document.createElement('p');
    infoLabel.style.cssText = 'margin: 0 0 8px; font-size: 13px; color: #64748b;';
    infoLabel.textContent = 'Licitación';
    
    const infoValue = document.createElement('p');
    infoValue.style.cssText = 'margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;';
    infoValue.textContent = codigoLicitacion;
    
    infoSection.appendChild(infoLabel);
    infoSection.appendChild(infoValue);
    
    // Create products section
    const productsSection = document.createElement('div');
    productsSection.style.cssText = 'margin-bottom: 20px;';
    
    const conMatch = productos.filter(p => p.nombre_producto && (p.precio_unitario || 0) > 0).length;
    const productsTitle = document.createElement('h3');
    productsTitle.style.cssText = 'font-size: 14px; color: #374151; margin-bottom: 12px;';
    productsTitle.textContent = `Match por producto (${conMatch}/${productos.length} desde tu inventario)`;

    const productsList = document.createElement('div');
    productsList.style.cssText = 'max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;';

    // Cada ítem muestra: lo solicitado → el producto de tu inventario que hizo match → precio
    productos.forEach(p => {
      const tieneMatch = !!p.nombre_producto && (p.precio_unitario || 0) > 0;

      const productItem = document.createElement('div');
      productItem.style.cssText = `background: white; border: 1px solid #e2e8f0; border-left: 4px solid ${tieneMatch ? '#22c55e' : '#f59e0b'}; border-radius: 8px; padding: 10px 12px;`;

      // Lo que pide Mercado Público
      const solicitado = document.createElement('div');
      solicitado.style.cssText = 'font-size: 12px; color: #64748b; margin-bottom: 3px;';
      solicitado.textContent = `Solicitado: ${p.nombre_solicitado || 'Producto'}`;
      productItem.appendChild(solicitado);

      // El match de tu inventario (o aviso si no hubo)
      const matchLine = document.createElement('div');
      matchLine.style.cssText = 'font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;';
      if (tieneMatch) {
        matchLine.style.color = '#1e293b';
        const name = document.createElement('span');
        name.textContent = `→ ${p.nombre_producto}${p.sku ? ' · ' + p.sku : ''}`;
        matchLine.appendChild(name);
        if (p.match_score != null) {
          const score = p.match_score;
          const badge = document.createElement('span');
          const c = score >= 60 ? ['#dcfce7', '#166534'] : ['#fef9c3', '#854d0e'];
          badge.style.cssText = `font-size: 11px; padding: 1px 7px; border-radius: 8px; background: ${c[0]}; color: ${c[1]}; font-weight: 600;`;
          badge.textContent = `match ${score}%`;
          matchLine.appendChild(badge);
        }
      } else {
        matchLine.style.color = '#b45309';
        matchLine.textContent = '⚠ Sin coincidencia en tu inventario — ponle precio en el portal';
      }
      productItem.appendChild(matchLine);

      // Cantidad × precio unitario = subtotal
      const precios = document.createElement('div');
      precios.style.cssText = 'display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-top: 5px;';
      const cant = document.createElement('span');
      cant.textContent = `${p.cantidad || 1} × $${(p.precio_unitario || 0).toLocaleString('es-CL')}`;
      const tot = document.createElement('span');
      tot.style.cssText = 'color: #059669; font-weight: 700;';
      tot.textContent = `$${(p.precio_total || 0).toLocaleString('es-CL')}`;
      precios.appendChild(cant);
      precios.appendChild(tot);
      productItem.appendChild(precios);

      productsList.appendChild(productItem);
    });
    
    productsSection.appendChild(productsTitle);
    productsSection.appendChild(productsList);
    
    // Create total section
    const totalSection = document.createElement('div');
    totalSection.style.cssText = `
      background: linear-gradient(135deg, #ecfdf5, #d1fae5);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
    `;
    
    const totalLabel = document.createElement('p');
    totalLabel.style.cssText = 'margin: 0 0 4px; font-size: 13px; color: #059669;';
    totalLabel.textContent = 'Valor Total de la Oferta';
    
    const totalValue = document.createElement('p');
    totalValue.style.cssText = 'margin: 0; font-size: 24px; font-weight: 700; color: #047857;';
    totalValue.textContent = `$${valorTotal.toLocaleString('es-CL')}`;
    
    totalSection.appendChild(totalLabel);
    totalSection.appendChild(totalValue);
    
    // Create buttons section
    const buttonsSection = document.createElement('div');
    buttonsSection.style.cssText = 'display: flex; gap: 12px;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'firmavb-cancel';
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 12px;
      background: #f1f5f9;
      color: #475569;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    `;
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.addEventListener('click', () => modal.remove());
    
    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'firmavb-confirm';
    confirmBtn.style.cssText = `
      flex: 1;
      padding: 12px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    `;
    confirmBtn.textContent = 'Autocompletar Formulario';
    confirmBtn.addEventListener('click', () => {
      modal.remove();
      performAutofill(oferta);
    });
    
    buttonsSection.appendChild(cancelBtn);
    buttonsSection.appendChild(confirmBtn);
    
    // Assemble modal
    modalContent.appendChild(headerDiv);
    modalContent.appendChild(infoSection);
    modalContent.appendChild(productsSection);
    modalContent.appendChild(totalSection);
    modalContent.appendChild(buttonsSection);
    
    modal.appendChild(modalContent);
    
    // Click fuera del modal para cerrar
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
  }

  // Ejecutar autofill en el formulario (formulario React/MUI de Compra Ágil)
  function performAutofill(oferta) {
    try {
      const productos = oferta.productos || oferta.productos_ofertados || [];
      if (!productos.length) {
        showMessage('error', 'La oferta no tiene productos con precio.');
        return;
      }

      // Los inputs de MUI son controlados por React: asignar .value directo NO
      // actualiza el estado. Hay que usar el setter nativo y luego disparar 'input'.
      const setReactValue = (el, value) => {
        const proto = el.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, String(value));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      };

      // Índice de precio por código de producto (probamos varios nombres de campo).
      const precioPorCodigo = new Map();
      productos.forEach((p) => {
        const codigo = String(
          p.codigo_producto ?? p.codigo ?? p.id_producto ?? p.item_id ?? p.id ?? ''
        ).trim();
        const precio = p.precio_unitario ?? p.precio ?? p.valor_unitario ?? p.precioUnitario;
        if (codigo && precio != null && precio !== '') precioPorCodigo.set(codigo, precio);
      });

      // Ubicar cada casilla "Valor unitario": es el <input> que sigue a un
      // <label>Valor unitario</label> dentro de la tarjeta del producto.
      const labels = Array.from(document.querySelectorAll('label'))
        .filter((l) => /valor\s*unitario/i.test(l.textContent || ''));

      let filledFields = 0;

      labels.forEach((label, index) => {
        const container = label.parentElement;
        const input = container ? container.querySelector('input') : null;
        if (!input) return;

        // Código del producto de esta tarjeta: buscar "ID: <numero>" en ancestros.
        let codigo = '';
        let node = label;
        for (let k = 0; k < 14 && node; k++) {
          node = node.parentElement;
          const m = node && (node.textContent || '').match(/ID:\s*(\d+)/);
          if (m) { codigo = m[1]; break; }
        }

        // Precio: por código si lo tenemos; si no, por posición (mismo orden).
        let precio;
        if (codigo && precioPorCodigo.has(codigo)) {
          precio = precioPorCodigo.get(codigo);
        } else if (productos[index]) {
          const p = productos[index];
          precio = p.precio_unitario ?? p.precio ?? p.valor_unitario ?? p.precioUnitario;
        }
        if (precio == null || precio === '') return;

        setReactValue(input, precio);
        filledFields++;
      });

      if (filledFields > 0) {
        showMessage(
          'success',
          `✓ ${filledFields} precios completados. Revisa los montos, adjunta tu documento, resuelve el captcha y presiona "Enviar cotización".`
        );
      } else {
        showMessage(
          'info',
          'No se encontraron las casillas de "Valor unitario". El formulario pudo haber cambiado; complétalo manualmente.'
        );
      }
      // Nota: NO se marca la oferta como "enviada" automáticamente. El formulario
      // tiene reCAPTCHA y adjunto obligatorio, así que el envío final lo realiza la
      // persona; de este modo el estado de la oferta refleja la realidad.
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

  // Extraer información completa de la licitación
  function extractLicitacionInfo() {
    const pageInfo = detectPageInfo();
    
    // Extraer título
    const tituloSelectors = [
      '.titulo-licitacion', 
      '#titulo', 
      'h1', 
      '.detalle-titulo',
      '[id*="TituloLicitacion"]'
    ];
    let titulo = '';
    for (const sel of tituloSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 10) {
        titulo = el.textContent.trim().slice(0, 500);
        break;
      }
    }

    // Extraer organismo
    const organismoSelectors = [
      '.organismo', 
      '[id*="Organismo"]', 
      '.entidad-compradora',
      'span:contains("Organismo")'
    ];
    let organismo = '';
    for (const sel of organismoSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        organismo = el.textContent.replace(/Organismo:?/i, '').trim().slice(0, 200);
        if (organismo) break;
      }
    }

    // Extraer presupuesto
    let presupuesto = null;
    const presupuestoMatch = document.body.textContent.match(/\$\s*([\d.,]+)/);
    if (presupuestoMatch) {
      presupuesto = parseFloat(presupuestoMatch[1].replace(/\./g, '').replace(',', '.'));
    }

    // Extraer fecha de cierre
    let fechaCierre = null;
    const fechaMatch = document.body.textContent.match(/(\d{2}[-/]\d{2}[-/]\d{4})\s*(\d{2}:\d{2})?/);
    if (fechaMatch) {
      const [, fecha, hora] = fechaMatch;
      fechaCierre = new Date(fecha.replace(/[-/]/g, '/')).toISOString();
    }

    return {
      id_licitacion: pageInfo.codigoLicitacion,
      titulo: titulo || `Licitación ${pageInfo.codigoLicitacion}`,
      organismo: organismo || 'MercadoPúblico',
      presupuesto,
      fecha_cierre: fechaCierre,
      link_oficial: window.location.href,
      estado: 'publicada'
    };
  }

  // Sincronizar licitación con el backend
  async function syncLicitacion() {
    const licitacion = extractLicitacionInfo();
    const items = extractItems();
    
    if (!licitacion.id_licitacion) {
      console.log('FirmaVB: No se pudo detectar código de licitación');
      return;
    }

    console.log('FirmaVB: Sincronizando licitación', licitacion.id_licitacion, 'con', items.length, 'items');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'SYNC_LICITACION',
        data: { licitacion, items }
      });
      
      if (response?.success) {
        console.log('FirmaVB: Licitación sincronizada exitosamente');
      } else {
        console.warn('FirmaVB: Error sincronizando:', response?.error);
      }
    } catch (error) {
      console.error('FirmaVB: Error en sync:', error);
    }
  }

  // Inicialización
  function init() {
    const pageInfo = detectPageInfo();
    console.log('FirmaVB: Page detected', pageInfo);
    
    // Notificar al background que estamos en MercadoPúblico
    if (pageInfo.isMercadoPublico) {
      chrome.runtime.sendMessage({
        action: 'PAGE_DETECTED',
        data: pageInfo
      }).catch(() => {});
      
      // Mostrar botón si hay código de licitación
      if (pageInfo.codigoLicitacion) {
        injectButton(pageInfo.codigoLicitacion);
        setTimeout(() => syncLicitacion(), 1500);
      }
      
      // Mostrar indicador de conexión
      showConnectionIndicator();
    }
  }

  // SECURITY FIX: Use textContent instead of innerHTML
  function showConnectionIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'firmavb-connection-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      z-index: 9999;
      padding: 8px 12px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(34, 197, 94, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    indicator.textContent = '🟢 FirmaVB Conectada';
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      indicator.style.opacity = '0.7';
    }, 3000);
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
