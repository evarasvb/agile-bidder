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
    // La compra ágil vive en su propio subdominio: compra-agil.mercadopublico.cl/resumen-cotizacion/<código>
    const isFichaCompraAgil = RE_FICHA_CA.test(url);
    const isCompraAgil = isFichaCompraAgil || url.includes('/CompraAgil/') || url.includes('/Portal/Modules/Menu/');
    const isDetalle = url.includes('DetailsAcquisition.aspx') || url.includes('Details.aspx');
    const isListado = url.includes('/Procurement/') || url.includes('/StoreSearch/') || url.includes('/Search/');
    const isOferta = url.includes('/Offer/') || url.includes('/Postulacion/');
    const isPortal = url.includes('/Portal/');
    
    let codigoLicitacion = null;
    
    // Extraer código de la URL - múltiples patrones
    const urlPatterns = [
      RE_FICHA_CA,
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
    
    // La ficha de licitación redirige a ?qs=<cifrado>: eso no es un ID. Si lo que salió de
    // la URL no tiene forma de ID (1234-56-LE26), se busca el ID real en el texto de la página.
    if (codigoLicitacion && !/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/.test(codigoLicitacion) && document.body) {
      const enPagina = document.body.textContent.match(/\b\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}\b/);
      if (enPagina) codigoLicitacion = enPagina[0];
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
      isFichaCompraAgil,
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
    if (RE_FICHA_CA.test(url) || url.includes('/CompraAgil/')) return 'compra_agil';
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

      // Además de los precios, poblar los campos de la cotización que antes
      // quedaban vacíos (el usuario tenía que llenarlos a mano): "Detalle de la
      // cotización" y "Fecha de vigencia". Aprovechamos que ya estamos en la
      // página con la sesión activa.
      const buscarCampoPorTexto = (re, tags) => {
        const nodos = Array.from(document.querySelectorAll('label, span, p, legend'));
        for (const n of nodos) {
          if (!re.test(n.textContent || '')) continue;
          let c = n;
          for (let k = 0; k < 4 && c; k++) {
            c = c.parentElement;
            if (!c) break;
            for (const t of tags) { const el = c.querySelector(t); if (el) return el; }
          }
        }
        return null;
      };

      let extras = 0;

      // Detalle de la cotización (textarea, máx 255): usa las notas de la oferta
      // o arma una descripción breve. No pisa lo que el usuario ya haya escrito.
      const detalleTxt = (oferta.notas && String(oferta.notas).trim())
        || `Cotización vía FirmaVB — ${productos.length} producto(s).`;
      const detalleEl = buscarCampoPorTexto(/detalle\s*(de\s*la\s*)?cotiz/i, ['textarea', 'input']);
      if (detalleEl && !String(detalleEl.value || '').trim()) {
        setReactValue(detalleEl, detalleTxt.slice(0, 255));
        extras++;
      }

      // Fecha de vigencia: +30 días (dd/mm/aaaa) si está vacía. Best-effort:
      // algunos date-pickers de MP son quisquillosos; si no toma, se avisa que
      // se revise a mano.
      const vigEl = buscarCampoPorTexto(/fecha\s*de\s*vigencia|vigencia/i, ['input']);
      if (vigEl && !String(vigEl.value || '').trim()) {
        const d = new Date(); d.setDate(d.getDate() + 30);
        const s = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        setReactValue(vigEl, s);
        extras++;
      }

      if (filledFields > 0) {
        showMessage(
          'success',
          `✓ ${filledFields} precios${extras ? ` + ${extras} campo(s) (detalle/vigencia)` : ''} completados. ` +
          `Revisa los montos, adjunta tu documento si aplica, resuelve el captcha y presiona "Enviar cotización".`
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

  // ==========================================================================
  // EXTRACTOR: ficha + bases y anexos a FirmaVB
  // La sección "Adjuntos" de Mercado Público (donde van las bases en PDF) exige
  // reCAPTCHA, así que el robot de FirmaVB no puede bajarla. Aquí, en el navegador
  // del usuario (que ya pasó el captcha), se ofrece extraer la ficha y, al aceptar,
  // se abre la ventana de adjuntos y cada archivo se manda a FirmaVB.
  // ==========================================================================
  const BANNER_ID = 'firmavb-extractor-banner';
  const RE_FICHA_CA = /\/resumen-cotizacion\/([^/?#]+)/i;
  const RE_ARCHIVO = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|jpe?g|png|txt|csv)$/i;
  const RE_CODIGO_LIC = /\b\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}\b/;
  const TITULO_BANNER = 'FirmaVB Postulador';

  async function extensionConectada() {
    try {
      const r = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      return !!(r && r.hasApiKey);
    } catch (_) { return false; }
  }

  function cerrarBanner() {
    const b = document.getElementById(BANNER_ID);
    if (b) b.remove();
  }

  // Tarjeta fija abajo a la izquierda (el botón "Postular" ya usa la derecha). Solo DOM, sin innerHTML.
  function mostrarBanner({ texto, acciones = [] }) {
    cerrarBanner();
    const card = document.createElement('div');
    card.id = BANNER_ID;
    card.style.cssText = `
      position: fixed; bottom: 20px; left: 20px; z-index: 10001; max-width: 380px;
      padding: 14px 16px; background: #ffffff; color: #0f172a; border: 1px solid #dbeafe;
      border-left: 5px solid #2563eb; border-radius: 12px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.4;
    `;
    const titulo = document.createElement('div');
    titulo.textContent = TITULO_BANNER;
    titulo.style.cssText = 'font-weight: 700; color: #2563eb; margin-bottom: 4px; font-size: 13px;';
    const cuerpo = document.createElement('div');
    cuerpo.id = BANNER_ID + '-texto';
    cuerpo.textContent = texto;
    const fila = document.createElement('div');
    fila.id = BANNER_ID + '-acciones';
    fila.style.cssText = 'display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;';
    card.appendChild(titulo);
    card.appendChild(cuerpo);
    card.appendChild(fila);
    document.body.appendChild(card);
    setAccionesBanner(acciones);
  }

  function setAccionesBanner(acciones) {
    const fila = document.getElementById(BANNER_ID + '-acciones');
    if (!fila) return;
    while (fila.firstChild) fila.removeChild(fila.firstChild);
    acciones.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = a.label;
      btn.style.cssText = a.primary
        ? 'padding: 8px 14px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer;'
        : 'padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #334155; cursor: pointer;';
      btn.addEventListener('click', a.onClick);
      fila.appendChild(btn);
    });
  }

  function actualizarBanner(texto, acciones) {
    const cuerpo = document.getElementById(BANNER_ID + '-texto');
    if (!cuerpo) { mostrarBanner({ texto, acciones: acciones || [] }); return; }
    cuerpo.textContent = texto;
    if (acciones) setAccionesBanner(acciones);
  }

  // En la ficha de la licitación: preguntar apenas la extensión está conectada.
  async function ofrecerExtraccion(codigo) {
    if (!RE_CODIGO_LIC.test(codigo)) {
      const enPagina = (document.body.textContent.match(RE_CODIGO_LIC) || [])[0];
      if (!enPagina) { console.log('FirmaVB: sin ID de licitación reconocible para ofrecer extracción'); return; }
      codigo = enPagina;
    }
    if (sessionStorage.getItem('firmavb-extraer-no-' + codigo)) return;
    if (!(await extensionConectada())) {
      if (sessionStorage.getItem('firmavb-conectar-no')) return;
      mostrarBanner({
        texto: 'Para extraer las bases de esta licitación a FirmaVB, conecta la extensión: haz clic en el ícono de FirmaVB Postulador (arriba a la derecha) y pega tu API key. La generas en FirmaVB → Configuración → Extensión.',
        acciones: [{ label: 'Entendido', onClick: () => { sessionStorage.setItem('firmavb-conectar-no', '1'); cerrarBanner(); } }]
      });
      return;
    }
    mostrarBanner({
      texto: `¿Quieres extraer la información y las bases de la licitación ${codigo} a FirmaVB? Se abre la ventana de adjuntos de Mercado Público y se envían solos.`,
      acciones: [
        { label: 'Sí, extraer', primary: true, onClick: () => iniciarExtraccion(codigo) },
        { label: 'Ahora no', onClick: () => { sessionStorage.setItem('firmavb-extraer-no-' + codigo, '1'); cerrarBanner(); } }
      ]
    });
  }

  function iniciarExtraccion(codigo) {
    const img = document.getElementById('imgAdjuntos');
    // Se abre la ventana DENTRO del clic del usuario (si no, el navegador bloquea el popup).
    if (img) {
      chrome.storage.local.set({ firmavbExtraer: { codigo, ts: Date.now() } }).catch(() => {});
      img.click();
      actualizarBanner(`Ficha en camino a FirmaVB. Se abrió la ventana de adjuntos de ${codigo}: ahí mismo se envían las bases y anexos (si el navegador bloqueó la ventana emergente, permítela y vuelve a hacer clic).`, [
        { label: 'Cerrar', onClick: cerrarBanner }
      ]);
    } else {
      actualizarBanner('Ficha en camino a FirmaVB. Esta licitación no tiene sección de adjuntos en Mercado Público.', [
        { label: 'Cerrar', onClick: cerrarBanner }
      ]);
    }
    syncLicitacion();
  }

  // En la ventana de adjuntos: filas con un archivo y su botón de descarga (postback ASP.NET).
  function filasAdjuntos() {
    const out = [];
    const vistos = new Set();
    document.querySelectorAll('tr').forEach((tr) => {
      const btn = tr.querySelector('input[type="image"][name*="$"], input[type="submit"][name*="$"]');
      if (!btn || !btn.name) return;
      const textos = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const nombre = textos.find((t) => RE_ARCHIVO.test(t));
      if (!nombre || vistos.has(btn.name)) return;
      vistos.add(btn.name);
      out.push({ nombre, boton: btn.name, form: btn.form, descripcion: textos.filter((t) => t !== nombre && t.length < 120).slice(0, 2).join(' · ') || null });
    });
    return out;
  }

  function esperarAdjuntos(ms) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        const filas = filasAdjuntos();
        if (filas.length || Date.now() - t0 > ms) resolve(filas);
        else setTimeout(tick, 600);
      };
      tick();
    });
  }

  async function descargarFila(f) {
    const form = f.form || document.forms[0];
    if (!form) throw new Error('sin formulario');
    const datos = new URLSearchParams(new FormData(form));
    datos.set(f.boton + '.x', '1');
    datos.set(f.boton + '.y', '1');
    const r = await fetch(window.location.href, { method: 'POST', body: datos, credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || ct.includes('text/html')) throw new Error('Mercado Público no entregó el archivo');
    return { blob: await r.blob(), contentType: ct.split(';')[0] };
  }

  function blobABase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  async function enviarAdjuntos(codigo, filas, descargar = descargarFila) {
    let ok = 0, errores = 0, bases = 0;
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      actualizarBanner(`Enviando ${i + 1} de ${filas.length} a FirmaVB: ${f.nombre}`, []);
      try {
        const { blob, contentType } = await descargar(f);
        if (blob.size > 30 * 1024 * 1024) { errores++; continue; }
        const base64 = await blobABase64(blob);
        const r = await chrome.runtime.sendMessage({
          action: 'ENVIAR_ADJUNTO',
          data: { codigo, nombre: f.nombre, descripcion: f.descripcion, contentType, base64 }
        });
        if (r && r.success) { ok++; if (r.bases_pendiente) bases++; }
        else { errores++; console.warn('FirmaVB adjunto', f.nombre, r && r.error); }
      } catch (e) {
        errores++;
        console.warn('FirmaVB adjunto', f.nombre, e);
      }
    }
    const resumen = `Listo: ${ok} archivo${ok === 1 ? '' : 's'} enviado${ok === 1 ? '' : 's'} a FirmaVB` +
      (bases ? `; ${bases} PDF de bases que el Experto leerá en minutos` : '') +
      (errores ? ` · ${errores} con error` : '') + '.';
    actualizarBanner(resumen, [{ label: 'Cerrar', onClick: cerrarBanner }]);
  }

  // ==========================================================================
  // COMPRA ÁGIL (compra-agil.mercadopublico.cl): la ficha ya la trae el robot. Los documentos
  // (términos de referencia, fotos) se descargan por la misma ruta que usa la app de Mercado
  // Público, que exige la sesión del usuario: por eso lo hace la extensión, aquí en su navegador.
  // FirmaVB dice qué documentos existen (id + nombre) y cuáles faltan; cada uno se sube a
  // extension-adjuntos y el Experto lo lee. Además se ofrece una pasada en lote para los matches.
  // ==========================================================================
  const CA_DESCARGA = 'https://servicios-compra-agil.mercadopublico.cl/v1/compra-agil/comprador/descargar?id=';
  const CA_TOKEN = 'access_token_ccr';
  const TIPO_DOC_CA = 'Documentos de compra ágil (vía extensión)';

  // Token de sesión de la app de compras ágiles (cookie o storage, con el nombre que usa la app).
  function tokenCompraAgil() {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + CA_TOKEN + '=([^;]*)'));
    if (m && m[1]) { try { return decodeURIComponent(m[1]).replace(/^"|"$/g, ''); } catch (_) { return m[1]; } }
    for (const st of [window.localStorage, window.sessionStorage]) {
      try {
        for (const k of [CA_TOKEN, 'access_token', 'token']) {
          const v = st.getItem(k);
          if (v && v.length > 20) return v.replace(/^"|"$/g, '');
        }
      } catch (_) {}
    }
    return null;
  }

  // Enlaces directos a archivos, si la página los tuviera (respaldo).
  function enlacesAdjuntosCA() {
    const out = [];
    const vistos = new Set();
    document.querySelectorAll('a[href]').forEach((a) => {
      if (a.closest('#' + BANNER_ID)) return;
      const href = a.href || '';
      if (!/^https?:/i.test(href)) return;
      const texto = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const ruta = href.split('?')[0];
      if (!RE_ARCHIVO.test(texto) && !RE_ARCHIVO.test(ruta)) return;
      if (vistos.has(href)) return;
      vistos.add(href);
      let nombre = texto;
      if (!RE_ARCHIVO.test(nombre)) { try { nombre = decodeURIComponent(ruta.split('/').pop() || '') || texto; } catch (_) { nombre = texto; } }
      out.push({ nombre, href, descripcion: 'Adjunto de compra ágil' });
    });
    return out;
  }

  async function descargarBytes(url, headers) {
    try {
      const r = await fetch(url, { credentials: 'include', headers });
      const ct = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0];
      if (r.status === 401 || r.status === 403) throw new Error('sesion');
      if (!r.ok || ct.includes('text/html') || ct.includes('application/json')) throw new Error('Mercado Público no entregó el archivo (' + r.status + ')');
      return { blob: await r.blob(), contentType: ct };
    } catch (e) {
      if (e && e.message === 'sesion') throw e;
      const r = await chrome.runtime.sendMessage({ action: 'DESCARGAR_URL', data: { url, headers } });
      if (!r || !r.success) throw new Error((r && r.error) || 'no se pudo descargar');
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { blob: new Blob([bytes], { type: r.contentType }), contentType: r.contentType };
    }
  }

  // Un documento por id (ruta de la app de MP, con el token de sesión) o por enlace directo.
  async function descargarDocumentoCA(doc, token) {
    if (doc.href) return descargarBytes(doc.href, undefined);
    if (!token) throw new Error('sesion');
    return descargarBytes(CA_DESCARGA + encodeURIComponent(doc.id), { Authorization: 'Bearer ' + token, Accept: '*/*' });
  }

  // Sube los documentos de UNA compra ágil. Devuelve { ok, errores, bases, sesion }.
  async function enviarDocumentosCA(codigo, docs, token, progreso) {
    let ok = 0, errores = 0, bases = 0, sesion = false;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      if (progreso) progreso(i + 1, docs.length, d.nombre);
      try {
        const { blob, contentType } = await descargarDocumentoCA(d, token);
        if (blob.size > 30 * 1024 * 1024) { errores++; continue; }
        const base64 = await blobABase64(blob);
        const r = await chrome.runtime.sendMessage({
          action: 'ENVIAR_ADJUNTO',
          data: { codigo, nombre: d.nombre, descripcion: 'Documento de compra ágil', tipo: TIPO_DOC_CA, contentType, base64 }
        });
        if (r && r.success) { ok++; if (r.bases_pendiente) bases++; }
        else { errores++; console.warn('FirmaVB documento CA', d.nombre, r && r.error); }
      } catch (e) {
        if (e && e.message === 'sesion') { sesion = true; break; }
        errores++;
        console.warn('FirmaVB documento CA', d.nombre, e);
      }
    }
    return { ok, errores, bases, sesion };
  }

  const resumenEnvio = (r) =>
    `Listo: ${r.ok} archivo${r.ok === 1 ? '' : 's'} enviado${r.ok === 1 ? '' : 's'} a FirmaVB` +
    (r.bases ? `; ${r.bases} PDF que el Experto leerá en minutos` : '') +
    (r.errores ? ` · ${r.errores} con error` : '') + '.';

  const TEXTO_SESION = 'Mercado Público solo entrega los documentos con tu sesión iniciada. Inicia sesión en Mercado Público (arriba a la derecha) y vuelve a esta ficha.';

  // Lote: documentos pendientes de otras compras ágiles (matches primero) mientras hay sesión.
  async function extraerLoteCA(token) {
    const r = await chrome.runtime.sendMessage({ action: 'CA_PENDIENTES', data: { limit: 15 } });
    const lista = (r && r.success && r.pendientes) || [];
    if (!lista.length) { actualizarBanner('No quedan documentos pendientes en tus compras ágiles abiertas.', [{ label: 'Cerrar', onClick: cerrarBanner }]); return; }
    const total = lista.reduce((n, c) => n + c.documentos.length, 0);
    let ok = 0, errores = 0, bases = 0, hechos = 0;
    for (const c of lista) {
      const res = await enviarDocumentosCA(c.codigo, c.documentos, token, (i, n, nombre) => {
        hechos++;
        actualizarBanner(`Lote: ${hechos} de ${total} · ${c.codigo}: ${nombre}`, []);
      });
      ok += res.ok; errores += res.errores; bases += res.bases;
      if (res.sesion) { actualizarBanner(TEXTO_SESION, [{ label: 'Cerrar', onClick: cerrarBanner }]); return; }
    }
    sessionStorage.setItem('firmavb-lote-ca', '1');
    actualizarBanner(`Lote terminado: ${ok} documento${ok === 1 ? '' : 's'} de ${lista.length} compra${lista.length === 1 ? '' : 's'} ágil${lista.length === 1 ? '' : 'es'} enviado${ok === 1 ? '' : 's'} a FirmaVB` +
      (bases ? `; ${bases} PDF que el Experto leerá` : '') + (errores ? ` · ${errores} con error` : '') + '.', [{ label: 'Cerrar', onClick: cerrarBanner }]);
  }

  function ofrecerLoteCA(token, texto) {
    if (sessionStorage.getItem('firmavb-lote-ca')) { actualizarBanner(texto, [{ label: 'Cerrar', onClick: cerrarBanner }]); return; }
    actualizarBanner(texto + ' ¿Traigo también los documentos pendientes de tus otras compras ágiles (matches primero)?', [
      { label: 'Sí, traer en lote', primary: true, onClick: () => extraerLoteCA(token) },
      { label: 'Cerrar', onClick: () => { sessionStorage.setItem('firmavb-lote-ca', '1'); cerrarBanner(); } }
    ]);
  }

  // Match guardado por el panel (get-matches) para esta compra ágil, si lo hay.
  async function matchGuardado(codigo) {
    try {
      const { matches } = await chrome.storage.local.get('matches');
      return (matches || []).find((m) => (m.licitacion_id || m.id_licitacion) === codigo) || null;
    } catch (_) { return null; }
  }

  async function ofrecerExtraccionCompraAgil(codigo) {
    if (sessionStorage.getItem('firmavb-extraer-no-' + codigo)) return;
    if (!(await extensionConectada())) {
      if (sessionStorage.getItem('firmavb-conectar-no')) return;
      mostrarBanner({
        texto: 'Para extraer los documentos de esta compra ágil y postular con FirmaVB, conecta la extensión: haz clic en el ícono de FirmaVB Postulador (arriba a la derecha) y pega tu API key. La generas en FirmaVB → Configuración → Extensión.',
        acciones: [{ label: 'Entendido', onClick: () => { sessionStorage.setItem('firmavb-conectar-no', '1'); cerrarBanner(); } }]
      });
      return;
    }
    const [info, match] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'CA_DOCUMENTOS', data: { codigo } }).catch(() => null),
      matchGuardado(codigo)
    ]);
    const conocidos = (info && info.success && info.documentos) || [];
    const faltan = conocidos.filter((d) => !d.bajado);
    // Respaldo: enlaces directos en la página que FirmaVB no conozca.
    const enlaces = enlacesAdjuntosCA().filter((e) => !conocidos.some((d) => d.nombre === e.nombre));
    const docs = faltan.concat(enlaces);
    const token = tokenCompraAgil();
    const partes = [`Compra ágil ${codigo}.`];
    if (match && match.match_score != null) partes.push(`Está en tus matches de FirmaVB (${Math.round(Number(match.match_score))}%).`);
    if (conocidos.length && !faltan.length && !enlaces.length) partes.push(`Sus ${conocidos.length} documento${conocidos.length === 1 ? ' ya está' : 's ya están'} en FirmaVB.`);
    else if (docs.length) partes.push(`Tiene ${docs.length} documento${docs.length === 1 ? '' : 's'} por traer (términos de referencia, fotos, etc.).`);
    else partes.push('No tiene documentos adjuntos.');
    if (docs.length && !token && !enlaces.length) partes.push('Para bajarlos necesitas tener la sesión de Mercado Público iniciada.');
    partes.push('¿Qué quieres hacer?');
    const acciones = [];
    if (docs.length) acciones.push({
      label: `Extraer ${docs.length} documento${docs.length === 1 ? '' : 's'} a FirmaVB`, primary: true,
      onClick: async () => {
        const tk = tokenCompraAgil();
        const res = await enviarDocumentosCA(codigo, docs, tk, (i, n, nombre) => actualizarBanner(`Enviando ${i} de ${n} a FirmaVB: ${nombre}`, []));
        if (res.sesion) { actualizarBanner(TEXTO_SESION, [{ label: 'Cerrar', onClick: cerrarBanner }]); return; }
        ofrecerLoteCA(tk, resumenEnvio(res));
      }
    });
    else if (token) acciones.push({ label: 'Traer documentos de mis otras compras ágiles', primary: true, onClick: () => extraerLoteCA(token) });
    acciones.push({ label: 'Postular con FirmaVB', primary: !docs.length && !token, onClick: () => { cerrarBanner(); startAutofill(codigo); } });
    acciones.push({ label: 'Ahora no', onClick: () => { sessionStorage.setItem('firmavb-extraer-no-' + codigo, '1'); cerrarBanner(); } });
    mostrarBanner({ texto: partes.join(' '), acciones });
  }

  async function flujoAdjuntos() {
    if (!(await extensionConectada())) return;
    const filas = await esperarAdjuntos(25000);
    if (!filas.length) return;
    let pedido = null;
    try { pedido = (await chrome.storage.local.get('firmavbExtraer')).firmavbExtraer || null; } catch (_) {}
    const auto = !!(pedido && pedido.codigo && Date.now() - pedido.ts < 30 * 60 * 1000);
    const codigo = (auto && pedido.codigo) || (document.body.textContent.match(RE_CODIGO_LIC) || [])[0] || null;
    if (!codigo) {
      mostrarBanner({ texto: 'No pude identificar a qué licitación pertenecen estos adjuntos. Ábrelos desde la ficha de la licitación.', acciones: [{ label: 'Cerrar', onClick: cerrarBanner }] });
      return;
    }
    const enviar = () => {
      chrome.storage.local.remove('firmavbExtraer').catch(() => {});
      enviarAdjuntos(codigo, filas);
    };
    if (auto) {
      mostrarBanner({ texto: `Enviando ${filas.length} adjunto${filas.length === 1 ? '' : 's'} de ${codigo} a FirmaVB…`, acciones: [] });
      enviar();
    } else {
      mostrarBanner({
        texto: `Encontré ${filas.length} adjunto${filas.length === 1 ? '' : 's'} de la licitación ${codigo}. ¿Los envío a FirmaVB para que el Experto tenga las bases?`,
        acciones: [
          { label: 'Sí, enviar', primary: true, onClick: enviar },
          { label: 'Ahora no', onClick: cerrarBanner }
        ]
      });
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

      // Ventana de adjuntos (bases y anexos): solo el flujo de envío a FirmaVB.
      if (pageInfo.url.includes('ViewAttachment.aspx')) {
        flujoAdjuntos();
        return;
      }

      // Buscador de licitaciones: recordar (una vez por sesión) que la extracción se ofrece en la ficha.
      if (/BusquedaLicitacion/i.test(pageInfo.url) && !sessionStorage.getItem('firmavb-pista-busqueda')) {
        extensionConectada().then((ok) => {
          if (!ok) return;
          mostrarBanner({
            texto: 'Abre cualquier licitación de esta lista y te ofreceré extraer su información y sus bases a FirmaVB.',
            acciones: [{ label: 'Entendido', onClick: () => { sessionStorage.setItem('firmavb-pista-busqueda', '1'); cerrarBanner(); } }]
          });
        });
      }
      
      // Ficha de compra ágil: botón de postulación + oferta de extraer adjuntos. La ficha en sí
      // ya la trae el robot de FirmaVB, así que no se sincroniza desde aquí.
      if (pageInfo.isFichaCompraAgil) {
        if (pageInfo.codigoLicitacion) {
          injectButton(pageInfo.codigoLicitacion);
          setTimeout(() => ofrecerExtraccionCompraAgil(pageInfo.codigoLicitacion), 1200);
        }
        showConnectionIndicator();
        return;
      }

      // Mostrar botón si hay código de licitación
      if (pageInfo.codigoLicitacion) {
        injectButton(pageInfo.codigoLicitacion);
        setTimeout(() => syncLicitacion(), 1500);
        // Ficha de licitación: ofrecer extraer ficha + bases a FirmaVB.
        if (pageInfo.isDetalle) setTimeout(() => ofrecerExtraccion(pageInfo.codigoLicitacion), 800);
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
    // Sin API key la extensión no puede enviar nada: se dice claro.
    extensionConectada().then((ok) => {
      if (!ok) {
        indicator.textContent = '🟠 FirmaVB sin conectar (pega tu API key en el ícono)';
        indicator.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      }
    });
    
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
