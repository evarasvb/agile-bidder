// FirmaVB Postulador - Convenio Marco Publisher
// ================================================
// Content script inyectado en conveniomarco.mercadopublico.cl (escritorio del proveedor).
// Ayuda a publicar un producto ya cargado: dejar el precio $1 bajo el referencial, marcar
// las regiones de cobertura configuradas, y saltar el producto si pide subir un PDF/Word.
//
// IMPORTANTE: esta es una primera versión "a ciegas" (nunca vimos el HTML real de este
// escritorio, porque requiere tu sesión). Por eso:
//  - Por defecto NO hace clic en Guardar/Publicar: deja todo listo y tú revisas y confirmas.
//  - Si algo no lo encuentra, lo dice en el panel en vez de fallar en silencio.
//  - Si el panel no aparece o no encuentra los campos, avísale a Claude con una captura de
//    pantalla de esta página para ajustar los selectores exactos.

(() => {
  if (window.__firmavbCmPublisherCargado) return;
  window.__firmavbCmPublisherCargado = true;

  const REGEX_REFERENCIAL = /referencial/i;
  const REGEX_PRECIO_LABEL = /precio|valor\s*unitario|valor\s*oferta|monto/i;
  const REGEX_EXCLUIR_LABEL = /referencial/i;
  const REGEX_DOCUMENTO = /adjunt|documento|certificad|ficha t[eé]cnica|\.pdf|\.docx?\b/i;
  const REGEX_OBLIGATORIO = /obligatori|requerid|\*/;
  const REGEX_GUARDAR = /^\s*(guardar|publicar|confirmar)\b/i;
  const REGEX_CANCELAR = /cancelar|volver|siguiente producto|lista de productos/i;

  // ---------- utilidades genéricas ----------

  function textoVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return '';
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
    return (el.innerText || el.textContent || '').trim();
  }

  function elementoVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Extrae el primer número tipo "$1.234" o "1234" de un texto.
  function extraerMonto(texto) {
    const m = texto.replace(/\s/g, ' ').match(/\$?\s?([\d]{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d{2}))?/);
    if (!m) return null;
    const entero = m[1].replace(/[.,]/g, '');
    const n = parseInt(entero, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Busca, entre todos los elementos "pequeños" de la página, el primero cuyo texto
  // mencione "referencial" y devuelve el monto más cercano (en el mismo texto o en el
  // contenedor padre/hermano siguiente).
  function buscarPrecioReferencial() {
    const candidatos = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (el.children.length > 2) return false; // preferimos nodos "hoja" (label, span, td)
      const t = textoVisible(el);
      return t && REGEX_REFERENCIAL.test(t) && t.length < 200;
    });
    for (const el of candidatos) {
      const propio = extraerMonto(textoVisible(el));
      if (propio) return propio;
      const hermano = el.nextElementSibling;
      if (hermano) {
        const m = extraerMonto(textoVisible(hermano));
        if (m) return m;
      }
      const padre = el.parentElement;
      if (padre) {
        const m = extraerMonto(textoVisible(padre).replace(textoVisible(el), ''));
        if (m) return m;
      }
    }
    return null;
  }

  // Etiqueta asociada a un input: label[for], aria-label, placeholder, o el texto
  // del elemento hermano/padre más cercano.
  function etiquetaDe(input) {
    if (input.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (lbl) return textoVisible(lbl);
    }
    if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
    if (input.placeholder) return input.placeholder;
    const contenedor = input.closest('div, td, mat-form-field, .form-group, .field');
    if (contenedor) return textoVisible(contenedor).slice(0, 120);
    return '';
  }

  function buscarInputPrecioEditable() {
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
    for (const input of inputs) {
      if (input.disabled || input.readOnly || !elementoVisible(input)) continue;
      const etiqueta = etiquetaDe(input);
      if (REGEX_EXCLUIR_LABEL.test(etiqueta)) continue;
      if (REGEX_PRECIO_LABEL.test(etiqueta)) return input;
    }
    return null;
  }

  // Dispara los eventos que frameworks como Angular/React necesitan para notar el cambio.
  function setValorInput(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(valor));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function requiereDocumento() {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(elementoVisible);
    if (fileInputs.length === 0) return false;
    // Si el campo de archivo no parece obligatorio, no lo consideramos bloqueante.
    return fileInputs.some((input) => {
      if (input.required) return true;
      const etiqueta = etiquetaDe(input) + ' ' + textoVisible(input.closest('div, td, .form-group') || document.body).slice(0, 300);
      return REGEX_DOCUMENTO.test(etiqueta) && REGEX_OBLIGATORIO.test(etiqueta);
    });
  }

  function buscarBoton(regex, excluirRegex) {
    const candidatos = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]')).filter(elementoVisible);
    return candidatos.find((el) => {
      const t = textoVisible(el) || el.value || '';
      return regex.test(t) && !(excluirRegex && excluirRegex.test(t));
    }) || null;
  }

  // Marca (sin desmarcar las demás) los checkboxes cuya etiqueta coincida con alguna región configurada.
  function marcarRegiones(regiones) {
    if (!regiones || regiones.length === 0) return 0;
    let marcadas = 0;
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(elementoVisible);
    checkboxes.forEach((cb) => {
      const etiqueta = etiquetaDe(cb);
      if (regiones.some((r) => etiqueta.toLowerCase().includes(r.toLowerCase())) && !cb.checked) {
        cb.click();
        marcadas++;
      }
    });
    return marcadas;
  }

  // ---------- panel flotante ----------

  function crearPanel() {
    const panel = document.createElement('div');
    panel.id = 'firmavb-cm-panel';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 999999,
      width: '300px', background: '#fff', border: '2px solid #4657A2',
      borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#0F0F0F',
      padding: '14px',
    });
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <strong style="color:#4657A2;font-size:14px;">FirmaVB · Convenio Marco</strong>
      </div>
      <div id="firmavb-cm-status" style="color:#475569;margin-bottom:10px;line-height:1.4;">
        Listo. Abre la ficha del producto y presiona el botón.
      </div>
      <button id="firmavb-cm-procesar" style="width:100%;background:#4657A2;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;">
        Procesar este producto
      </button>
    `;
    document.body.appendChild(panel);
    document.getElementById('firmavb-cm-procesar').addEventListener('click', procesarProducto);
  }

  function setEstado(html) {
    const el = document.getElementById('firmavb-cm-status');
    if (el) el.innerHTML = html;
  }

  // ---------- flujo principal ----------

  async function procesarProducto() {
    const { cmConfig } = await chrome.storage.local.get('cmConfig');
    const config = cmConfig || { regiones: [], marcas: [], autoPublicar: false };
    const pasos = [];

    if (requiereDocumento()) {
      pasos.push('⚠️ Este producto pide subir un PDF/Word. Lo salto (no toco precio ni guardo).');
      const boton = buscarBoton(REGEX_CANCELAR);
      if (config.autoPublicar && boton) {
        boton.click();
        pasos.push('Volví a la lista de productos.');
      } else {
        pasos.push('Ciérralo o vuelve a la lista tú mismo.');
      }
      setEstado(pasos.join('<br>'));
      return;
    }

    const referencial = buscarPrecioReferencial();
    if (referencial == null) {
      pasos.push('No encontré un "precio referencial" en esta página.');
      pasos.push('Avísale a Claude con una captura de esta pantalla para ajustarlo.');
      setEstado(pasos.join('<br>'));
      return;
    }
    pasos.push(`Precio referencial detectado: $${referencial.toLocaleString('es-CL')}`);

    const inputPrecio = buscarInputPrecioEditable();
    if (!inputPrecio) {
      pasos.push('No encontré el campo de precio editable. Avísale a Claude con una captura.');
      setEstado(pasos.join('<br>'));
      return;
    }
    const nuevoPrecio = referencial - 1;
    setValorInput(inputPrecio, nuevoPrecio);
    pasos.push(`Precio dejado en: $${nuevoPrecio.toLocaleString('es-CL')} (referencial − 1)`);

    const marcadas = marcarRegiones(config.regiones);
    if (marcadas > 0) pasos.push(`Marqué ${marcadas} región(es) de cobertura.`);

    if (config.autoPublicar) {
      const botonGuardar = buscarBoton(REGEX_GUARDAR, REGEX_CANCELAR);
      if (botonGuardar) {
        botonGuardar.click();
        pasos.push('✅ Publicado automáticamente.');
      } else {
        pasos.push('No encontré el botón de Guardar/Publicar — guárdalo tú mismo.');
      }
    } else {
      pasos.push('Revisa el precio y presiona tú el botón de Guardar/Publicar de la página.');
    }

    setEstado(pasos.join('<br>'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crearPanel);
  } else {
    crearPanel();
  }
})();
