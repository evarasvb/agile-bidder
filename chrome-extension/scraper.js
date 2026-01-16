// FirmaVB Postulador - Scraper Script
// ====================================
// Injected into MercadoPúblico pages to extract data for pending_sync tasks

(function() {
  'use strict';
  
  console.log('[FirmaVB Scraper] Loaded');
  
  // Listen for scrape requests from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'EXECUTE_SCRAPE') {
      console.log('[FirmaVB Scraper] Executing scrape for kind:', message.kind);
      
      try {
        const data = scrapeByKind(message.kind);
        console.log('[FirmaVB Scraper] Scraped data:', data);
        sendResponse(data);
      } catch (error) {
        console.error('[FirmaVB Scraper] Error:', error);
        sendResponse({ error: error.message });
      }
    }
    return true;
  });
  
  function scrapeByKind(kind) {
    switch (kind) {
      case 'compra_agil_list':
        return scrapeCompraAgilList();
      case 'compra_agil_detail':
        return scrapeCompraAgilDetail();
      case 'oc_detail':
        return scrapeOrdenCompraDetail();
      case 'licitacion_detail':
        return scrapeLicitacionDetail();
      default:
        return scrapeGeneric();
    }
  }
  
  // ============================================
  // COMPRA AGIL LIST - Lista de compras ágiles
  // ============================================
  
  function scrapeCompraAgilList() {
    const licitaciones = [];
    
    // Buscar filas de tabla o cards de licitaciones
    const rows = document.querySelectorAll('table tbody tr, .licitacion-item, .opportunity-card, [class*="grid"] > div');
    
    rows.forEach((row, index) => {
      try {
        // Extraer código
        const codigoEl = row.querySelector('[class*="codigo"], a[href*="idLicitacion"], td:first-child');
        const codigo = extractCode(codigoEl?.textContent || codigoEl?.href || '');
        
        if (!codigo) return;
        
        // Extraer otros campos
        const tituloEl = row.querySelector('[class*="titulo"], [class*="nombre"], td:nth-child(2)');
        const organismoEl = row.querySelector('[class*="organismo"], [class*="entidad"], td:nth-child(3)');
        const montoEl = row.querySelector('[class*="monto"], [class*="presupuesto"], td:nth-child(4)');
        const fechaEl = row.querySelector('[class*="fecha"], [class*="cierre"], td:nth-child(5)');
        const estadoEl = row.querySelector('[class*="estado"], .badge, td:last-child');
        
        licitaciones.push({
          codigo: codigo,
          nombre: tituloEl?.textContent?.trim()?.slice(0, 500) || `Compra Ágil ${codigo}`,
          institucion_nombre: organismoEl?.textContent?.trim()?.slice(0, 200) || '',
          presupuesto_estimado: parseAmount(montoEl?.textContent),
          fecha_cierre: parseDate(fechaEl?.textContent),
          estado: estadoEl?.textContent?.trim()?.toLowerCase() || 'publicada',
          tipo: 'compra_agil'
        });
      } catch (e) {
        console.warn('[FirmaVB Scraper] Error parsing row:', e);
      }
    });
    
    return { licitaciones };
  }
  
  // ============================================
  // COMPRA AGIL DETAIL - Detalle de compra ágil
  // ============================================
  
  function scrapeCompraAgilDetail() {
    const licitacion = {
      codigo: '',
      nombre: '',
      descripcion: '',
      institucion_nombre: '',
      institucion_rut: '',
      presupuesto_estimado: null,
      fecha_publicacion: null,
      fecha_cierre: null,
      estado: 'publicada',
      tipo: 'compra_agil'
    };
    
    // Extraer código de URL o página
    const urlMatch = window.location.href.match(/idLicitacion=([^&]+)/i) ||
                     window.location.href.match(/CodigoExterno=([^&]+)/i);
    if (urlMatch) {
      licitacion.codigo = decodeURIComponent(urlMatch[1]);
    }
    
    // Buscar código en la página
    if (!licitacion.codigo) {
      const codePatterns = [/(\d{4,}-\d+-[A-Z]+\d+)/, /(\d{7,})/];
      const codeElements = document.querySelectorAll('[id*="codigo"], .codigo, h1, h2');
      for (const el of codeElements) {
        for (const pattern of codePatterns) {
          const match = el.textContent.match(pattern);
          if (match) {
            licitacion.codigo = match[1];
            break;
          }
        }
        if (licitacion.codigo) break;
      }
    }
    
    // Título
    const tituloSelectors = ['h1', '.titulo', '[id*="Titulo"]', '.nombre-licitacion'];
    for (const sel of tituloSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 10) {
        licitacion.nombre = el.textContent.trim().slice(0, 500);
        break;
      }
    }
    
    // Descripción
    const descSelectors = ['.descripcion', '[id*="descripcion"]', '.detalle'];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        licitacion.descripcion = el.textContent.trim().slice(0, 2000);
        break;
      }
    }
    
    // Organismo
    const orgSelectors = ['.organismo', '[id*="Organismo"]', '.entidad', '.institucion'];
    for (const sel of orgSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        licitacion.institucion_nombre = el.textContent.replace(/Organismo:?/i, '').trim().slice(0, 200);
        break;
      }
    }
    
    // Presupuesto
    const presupuestoMatch = document.body.textContent.match(/presupuesto[:\s]*\$?\s*([\d.,]+)/i);
    if (presupuestoMatch) {
      licitacion.presupuesto_estimado = parseAmount(presupuestoMatch[1]);
    }
    
    // Fechas
    const fechaCierreMatch = document.body.textContent.match(/cierre[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i);
    if (fechaCierreMatch) {
      licitacion.fecha_cierre = parseDate(fechaCierreMatch[1]);
    }
    
    // Extraer items
    const items = scrapeItems();
    
    return { licitacion, items };
  }
  
  // ============================================
  // ORDEN COMPRA DETAIL - Detalle de OC
  // ============================================
  
  function scrapeOrdenCompraDetail() {
    const orden_compra = {
      codigo: '',
      nombre: '',
      descripcion: '',
      institucion_nombre: '',
      institucion_rut: '',
      proveedor_nombre: '',
      proveedor_rut: '',
      total_neto: null,
      total: null,
      fecha_creacion: null,
      fecha_envio: null,
      estado: ''
    };
    
    // Extraer código de OC
    const urlMatch = window.location.href.match(/idOrdenCompra=([^&]+)/i) ||
                     window.location.href.match(/codigo=([^&]+)/i);
    if (urlMatch) {
      orden_compra.codigo = decodeURIComponent(urlMatch[1]);
    }
    
    // Buscar código en página
    const codigoEl = document.querySelector('[id*="CodigoOC"], .codigo-oc, h1');
    if (codigoEl && !orden_compra.codigo) {
      const match = codigoEl.textContent.match(/(\d+-\d+-\w+\d*)/);
      if (match) orden_compra.codigo = match[1];
    }
    
    // Nombre/descripción
    const nombreEl = document.querySelector('.nombre-oc, [id*="NombreOC"], .descripcion-oc');
    if (nombreEl) {
      orden_compra.nombre = nombreEl.textContent.trim().slice(0, 500);
    }
    
    // Proveedor
    const proveedorEl = document.querySelector('.proveedor, [id*="Proveedor"]');
    if (proveedorEl) {
      orden_compra.proveedor_nombre = proveedorEl.textContent.replace(/Proveedor:?/i, '').trim();
    }
    
    // Monto total
    const totalMatch = document.body.textContent.match(/total[:\s]*\$?\s*([\d.,]+)/i);
    if (totalMatch) {
      orden_compra.total = parseAmount(totalMatch[1]);
    }
    
    // Items
    const items = scrapeOCItems();
    
    return { orden_compra, items };
  }
  
  // ============================================
  // LICITACION DETAIL - Detalle de licitación grande
  // ============================================
  
  function scrapeLicitacionDetail() {
    const licitacion = {
      codigo: '',
      nombre: '',
      descripcion: '',
      institucion_nombre: '',
      institucion_rut: '',
      presupuesto_estimado: null,
      fecha_publicacion: null,
      fecha_cierre: null,
      estado: '',
      tipo: 'licitacion'
    };
    
    // Similar a compra ágil pero adaptado para licitaciones grandes
    const urlMatch = window.location.href.match(/idLicitacion=([^&]+)/i);
    if (urlMatch) {
      licitacion.codigo = decodeURIComponent(urlMatch[1]);
    }
    
    // Título
    const tituloEl = document.querySelector('h1, .titulo-licitacion, [id*="Titulo"]');
    if (tituloEl) {
      licitacion.nombre = tituloEl.textContent.trim().slice(0, 500);
    }
    
    // Descripción
    const descEl = document.querySelector('.descripcion, [id*="Descripcion"]');
    if (descEl) {
      licitacion.descripcion = descEl.textContent.trim().slice(0, 2000);
    }
    
    // Organismo
    const orgEl = document.querySelector('.organismo, [id*="Organismo"], .entidad');
    if (orgEl) {
      licitacion.institucion_nombre = orgEl.textContent.replace(/Organismo:?/i, '').trim();
    }
    
    // Estado
    const estadoEl = document.querySelector('.estado, [id*="Estado"], .badge');
    if (estadoEl) {
      licitacion.estado = estadoEl.textContent.trim().toLowerCase();
    }
    
    return { licitacion };
  }
  
  // ============================================
  // GENERIC SCRAPE - Fallback
  // ============================================
  
  function scrapeGeneric() {
    return {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    };
  }
  
  // ============================================
  // ITEM SCRAPERS
  // ============================================
  
  function scrapeItems() {
    const items = [];
    
    // Buscar tablas de productos - múltiples estrategias
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const nombre = cells[0]?.textContent?.trim() || cells[1]?.textContent?.trim();
          if (nombre && nombre.length > 2 && !nombre.match(/^(item|producto|descripción|cantidad|unidad|precio)$/i)) {
            // Intentar extraer cantidad de diferentes columnas
            let cantidad = 1;
            let unidad = 'UN';
            let descripcion = '';
            
            // Buscar cantidad en diferentes posiciones
            for (let i = 0; i < cells.length; i++) {
              const cellText = cells[i]?.textContent?.trim() || '';
              // Si parece una cantidad (número)
              if (cellText.match(/^\d+([.,]\d+)?$/)) {
                cantidad = parseFloat(cellText.replace(/[^\d.,]/g, '').replace(',', '.')) || 1;
              }
              // Si parece una unidad (texto corto)
              if (cellText.match(/^(UN|KG|M|M2|M3|LT|PZA|CAJ|PAR|SET)$/i)) {
                unidad = cellText.toUpperCase();
              }
              // Si es una descripción (texto largo)
              if (i > 0 && cellText.length > 20 && cellText.length < 500) {
                descripcion = cellText;
              }
            }
            
            // Si no encontramos cantidad en las celdas, buscar en el texto completo de la fila
            if (cantidad === 1) {
              const cantidadMatch = row.textContent.match(/(?:cantidad|qty|qty\.)[:\s]*(\d+([.,]\d+)?)/i);
              if (cantidadMatch) {
                cantidad = parseFloat(cantidadMatch[1].replace(',', '.')) || 1;
              }
            }
            
            items.push({
              correlativo: index + 1,
              item_index: index + 1,
              nombre_producto: nombre.slice(0, 500),
              descripcion: descripcion || cells[1]?.textContent?.trim()?.slice(0, 1000) || '',
              cantidad: cantidad,
              unidad: unidad || cells[3]?.textContent?.trim() || 'UN'
            });
          }
        }
      });
    });
    
    // Si no encontramos items en tablas, buscar en listas o divs
    if (items.length === 0) {
      const itemSelectors = [
        '.item-producto', '.producto-item', '.item-licitacion',
        '[class*="item"]', '[class*="producto"]', '[class*="product"]'
      ];
      
      itemSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
          const nombre = el.querySelector('[class*="nombre"], [class*="titulo"], strong, b')?.textContent?.trim();
          if (nombre && nombre.length > 2) {
            const descripcion = el.querySelector('[class*="descripcion"], p')?.textContent?.trim() || '';
            const cantidadMatch = el.textContent.match(/(?:cantidad|qty)[:\s]*(\d+)/i);
            const cantidad = cantidadMatch ? parseFloat(cantidadMatch[1]) : 1;
            
            items.push({
              correlativo: index + 1,
              item_index: index + 1,
              nombre_producto: nombre.slice(0, 500),
              descripcion: descripcion.slice(0, 1000),
              cantidad: cantidad,
              unidad: 'UN'
            });
          }
        });
      });
    }
    
    return items;
  }
  
  function scrapeOCItems() {
    const items = [];
    
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const nombre = cells[0]?.textContent?.trim() || cells[1]?.textContent?.trim();
          if (nombre && nombre.length > 2) {
            items.push({
              correlativo: index + 1,
              nombre_producto: nombre.slice(0, 500),
              cantidad: parseFloat(cells[1]?.textContent?.replace(/[^\d.,]/g, '').replace(',', '.')) || 1,
              unidad: cells[2]?.textContent?.trim() || 'UN',
              precio_unitario_neto: parseAmount(cells[3]?.textContent),
              total_neto: parseAmount(cells[4]?.textContent)
            });
          }
        }
      });
    });
    
    return items;
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  function extractCode(text) {
    if (!text) return null;
    
    // Patrones de códigos de licitación
    const patterns = [
      /(\d{4,}-\d+-[A-Z]+\d+)/,  // 1234-56-LP21
      /idLicitacion=([^&]+)/i,
      /CodigoExterno=([^&]+)/i,
      /(\d{7,})/  // Solo números largos
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    
    return null;
  }
  
  function parseAmount(text) {
    if (!text) return null;
    
    // Limpiar y parsear monto
    const cleaned = text.replace(/[^\d.,]/g, '');
    
    // Manejar formato chileno (1.234.567,89)
    let number;
    if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // Formato: 1.234.567,89
      number = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // Formato: 1,234,567.89 o 1234567
      number = parseFloat(cleaned.replace(/,/g, ''));
    }
    
    return isNaN(number) ? null : number;
  }
  
  function parseDate(text) {
    if (!text) return null;
    
    // Intentar parsear diferentes formatos de fecha
    const patterns = [
      /(\d{2})[-/](\d{2})[-/](\d{4})/,  // DD/MM/YYYY
      /(\d{4})[-/](\d{2})[-/](\d{2})/   // YYYY-MM-DD
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let year, month, day;
        if (match[1].length === 4) {
          // YYYY-MM-DD
          [, year, month, day] = match;
        } else {
          // DD/MM/YYYY
          [, day, month, year] = match;
        }
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    return null;
  }
  
  console.log('[FirmaVB Scraper] Ready');
})();
