// FirmaVB Postulador - Convenio Marco Publisher
// ================================================
// Content script inyectado en conveniomarco.mercadopublico.cl.
// La ficha de "Asignación de producto" (mpassignproduct/product/add) trae una tabla con una
// fila por región: cada fila tiene su propio precio de referencia (disponible directo en el
// atributo data-control del input de precio, sin necesidad de adivinarlo del texto) y un radio
// "Stock Disponible: Sí/No". Por cada región configurada, deja el precio en referencial − $1 y
// marca "Sí". Si el producto no coincide con ninguna marca configurada, o exige subir un
// documento (PDF/Word), lo salta sin tocar nada.
//
// Por defecto NO hace clic en Guardar: deja todo listo para que el usuario revise y confirme.
// Si una ficha no trae la tabla esperada (otro tipo de producto), cae a un modo genérico
// basado en texto — y lo informa en el panel para poder ajustar los selectores con una captura.

(() => {
  if (window.__firmavbCmPublisherCargado) return;
  window.__firmavbCmPublisherCargado = true;

  const REGIONES_CHILE = [
    'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
    'Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble',
    'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
  ];

  const REGEX_DOCUMENTO = /adjunt|documento|certificad|ficha t[eé]cnica|\.pdf|\.docx?\b/i;
  const REGEX_OBLIGATORIO = /obligatori|requerid|\*/;
  const REGEX_GUARDAR = /^\s*(guardar|publicar|confirmar)\b/i;
  const REGEX_CANCELAR = /cancelar|volver|siguiente producto|lista de productos/i;
  const REGEX_PRECIO_LABEL = /precio|valor\s*unitario|valor\s*oferta|monto/i;
  const REGEX_EXCLUIR_LABEL = /referencial/i;
  const REGEX_REFERENCIAL = /referencial/i;

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

  function normalizar(texto) {
    return (texto || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '')
      .toLowerCase();
  }

  function extraerMonto(texto) {
    const m = texto.replace(/\s/g, ' ').match(/\$?\s?([\d]{1,3}(?:[.,]\d{3})*|\d+)(?:[.,](\d{2}))?/);
    if (!m) return null;
    const entero = m[1].replace(/[.,]/g, '');
    const n = parseInt(entero, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Ancla al texto "referencia" para no confundir el monto con cantidades u otros números
  // sueltos en la fila (ej. "ESTUCHE 12 COLORES").
  function extraerMontoReferencial(texto) {
    const m = texto.replace(/\s/g, ' ').match(/referencia\s*:?\s*\$?\s*([\d]{1,3}(?:[.,]\d{3})*|\d+)/i);
    if (!m) return null;
    const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

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

  function setValorInput(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(valor));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function marcarRadio(radio) {
    if (!radio || radio.checked) return false;
    radio.click();
    return true;
  }

  function requiereDocumento(raiz) {
    const fileInputs = Array.from((raiz || document).querySelectorAll('input[type="file"]')).filter(elementoVisible);
    if (fileInputs.length === 0) return false;
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

  function nombreProducto() {
    const h1 = document.querySelector('h1');
    return (h1 ? textoVisible(h1) : '') || document.title || '';
  }

  function productoCoincideConMarcas(marcas) {
    if (!marcas || marcas.length === 0) return true;
    const nombre = normalizar(nombreProducto());
    return marcas.some((m) => nombre.includes(normalizar(m)));
  }

  // ---------- modo tabla (ficha real "Asignación de producto", una fila por región) ----------

  function buscarFormularioAsignacion() {
    return document.querySelector('#wk_mpassignproduct_form')
      || document.querySelector('form[action*="mpassignproduct/product/save"]')
      || null;
  }

  function filasAsociadas(form) {
    return Array.from(form.querySelectorAll('table.wk-associated-table tbody tr'))
      .filter((fila) => fila.querySelector('input[name*="[price]"]'));
  }

  function inputPrecioDeFila(fila) {
    return fila.querySelector('input.wk-associate-price') || fila.querySelector('input[name*="[price]"]');
  }

  function referencialDeFila(fila, inputPrecio) {
    const dataControl = inputPrecio && inputPrecio.dataset ? inputPrecio.dataset.control : null;
    if (dataControl != null && dataControl !== '') {
      const n = parseInt(dataControl, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return extraerMontoReferencial(textoVisible(fila));
  }

  function radioOfertaDeFila(fila) {
    return fila.querySelector('input[type="radio"][title="Sí"]')
      || fila.querySelector('input[type="radio"][value="99999999"]')
      || null;
  }

  function regionDeFila(fila) {
    const texto = normalizar(textoVisible(fila));
    return REGIONES_CHILE.find((r) => texto.includes(normalizar(r))) || null;
  }

  function procesarFilasAsignacion(form, config) {
    const filas = filasAsociadas(form);
    const resumen = { total: filas.length, actualizadas: [], sinReferencial: [], fueraDeConfig: 0 };

    filas.forEach((fila) => {
      const region = regionDeFila(fila);
      const dentroDeConfig = !config.regiones || config.regiones.length === 0
        || (region && config.regiones.includes(region));
      if (!dentroDeConfig) {
        resumen.fueraDeConfig++;
        return;
      }

      const inputPrecio = inputPrecioDeFila(fila);
      if (!inputPrecio) return;
      const referencial = referencialDeFila(fila, inputPrecio);
      if (referencial == null) {
        resumen.sinReferencial.push(region || '(región sin identificar)');
        return;
      }

      const nuevoPrecio = referencial - 1;
      setValorInput(inputPrecio, nuevoPrecio);
      marcarRadio(radioOfertaDeFila(fila));
      resumen.actualizadas.push({ region: region || '(sin identificar)', referencial, nuevoPrecio });
    });

    return resumen;
  }

  // ---------- modo genérico (respaldo si una ficha no trae la tabla esperada) ----------

  function buscarPrecioReferencialGenerico() {
    const candidatos = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (el.children.length > 2) return false;
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

  function buscarInputPrecioEditableGenerico() {
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
    for (const input of inputs) {
      if (input.disabled || input.readOnly || !elementoVisible(input)) continue;
      const etiqueta = etiquetaDe(input);
      if (REGEX_EXCLUIR_LABEL.test(etiqueta)) continue;
      if (REGEX_PRECIO_LABEL.test(etiqueta)) return input;
    }
    return null;
  }

  function marcarRegionesGenerico(regiones) {
    if (!regiones || regiones.length === 0) return 0;
    let marcadas = 0;
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(elementoVisible);
    checkboxes.forEach((cb) => {
      const etiqueta = normalizar(etiquetaDe(cb));
      if (regiones.some((r) => etiqueta.includes(normalizar(r))) && !cb.checked) {
        cb.click();
        marcadas++;
      }
    });
    return marcadas;
  }

  // ---------- navegación: ficha vs lista de productos ----------

  const RE_FICHA = /\/mpassignproduct\/product\/(?:add|edit)\/id\/(\d+)/i;
  const RE_LISTA = /\/mpassignproduct\/product\/productlist/i;

  function idFichaActual() { const m = location.href.match(RE_FICHA); return m ? m[1] : null; }
  function esFicha() { return RE_FICHA.test(location.href); }
  function esLista() { return RE_LISTA.test(location.href); }

  // Enlaces a fichas de producto presentes en la lista (columna acción / menú).
  function enlacesFichasEnLista() {
    const out = []; const vistos = new Set();
    document.querySelectorAll('a[href*="/mpassignproduct/product/"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(RE_FICHA);
      if (m && !vistos.has(m[1])) { vistos.add(m[1]); out.push({ id: m[1], href: a.href }); }
    });
    return out;
  }

  // Control de "página siguiente" en la paginación de la lista (best-effort).
  function botonPaginaSiguiente() {
    const cands = Array.from(document.querySelectorAll('a, button, li')).filter(elementoVisible);
    return cands.find((el) => {
      const dis = el.disabled || el.getAttribute('aria-disabled') === 'true' || /disabled/.test(el.className || '');
      if (dis) return false;
      const t = (el.getAttribute('aria-label') || el.title || textoVisible(el) || '').toLowerCase().trim();
      return el.getAttribute('rel') === 'next' || t === 'next' || t === 'siguiente' || t === '›' || t === '>' || /p[aá]gina siguiente|next page/.test(t);
    }) || null;
  }

  // ---------- panel flotante (movible + minimizable) ----------

  function crearPanel() {
    if (document.getElementById('firmavb-cm-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'firmavb-cm-panel';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '16px', left: '16px', zIndex: 2147483647,
      width: '300px', background: '#fff', border: '2px solid #4657A2',
      borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#0F0F0F',
    });
    panel.innerHTML = `
      <div id="firmavb-cm-head" style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;border-bottom:1px solid #eef;border-radius:12px 12px 0 0;background:#f7f8fc;">
        <strong style="color:#4657A2;font-size:14px;flex:1;">FirmaVB · Convenio Marco</strong>
        <button id="firmavb-cm-min" title="Minimizar" style="background:none;border:none;cursor:pointer;font-size:16px;line-height:1;color:#64748b;">–</button>
      </div>
      <div id="firmavb-cm-body" style="padding:12px;max-height:60vh;overflow-y:auto;">
        <div id="firmavb-cm-status" style="color:#475569;margin-bottom:10px;line-height:1.4;">
          Listo. Abre la ficha del producto y presiona el botón.
        </div>
        <label style="display:flex;align-items:center;gap:6px;margin-bottom:10px;color:#334155;cursor:pointer;">
          <input type="checkbox" id="firmavb-cm-autoguardar"> Guardar automáticamente al procesar
        </label>
        <button id="firmavb-cm-procesar" style="width:100%;background:#4657A2;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;margin-bottom:8px;">
          Procesar este producto
        </button>
        <button id="firmavb-cm-lote" style="width:100%;background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;">
          Procesar TODO (continuo)
        </button>
        <button id="firmavb-cm-detener" style="display:none;width:100%;background:#ef4444;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;margin-top:8px;">
          Detener
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('firmavb-cm-procesar').addEventListener('click', () => procesarProducto());
    document.getElementById('firmavb-cm-lote').addEventListener('click', iniciarLote);
    document.getElementById('firmavb-cm-detener').addEventListener('click', () => detenerLote('Detenido por ti.'));
    document.getElementById('firmavb-cm-min').addEventListener('click', () => {
      const body = document.getElementById('firmavb-cm-body');
      const min = document.getElementById('firmavb-cm-min');
      const oculto = body.style.display === 'none';
      body.style.display = oculto ? 'block' : 'none';
      min.textContent = oculto ? '–' : '+';
    });
    hacerArrastrable(panel, document.getElementById('firmavb-cm-head'));
  }

  // El panel tapaba la columna de precios y no se podía correr: ahora se arrastra
  // desde su cabecera y se puede minimizar.
  function hacerArrastrable(panel, asa) {
    let sx = 0, sy = 0, ox = 0, oy = 0, mov = false;
    asa.addEventListener('mousedown', (e) => {
      if (e.target && e.target.id === 'firmavb-cm-min') return;
      mov = true;
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!mov) return;
      let x = ox + (e.clientX - sx), y = oy + (e.clientY - sy);
      x = Math.max(0, Math.min(x, window.innerWidth - 60));
      y = Math.max(0, Math.min(y, window.innerHeight - 40));
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { mov = false; });
  }

  function setEstado(html) {
    const el = document.getElementById('firmavb-cm-status');
    if (el) el.innerHTML = html;
  }
  function mostrarDetener(activo) {
    const d = document.getElementById('firmavb-cm-detener');
    const p = document.getElementById('firmavb-cm-procesar');
    const l = document.getElementById('firmavb-cm-lote');
    if (d) d.style.display = activo ? 'block' : 'none';
    if (p) p.style.display = activo ? 'none' : 'block';
    if (l) l.style.display = activo ? 'none' : 'block';
  }

  function formatoCLP(n) { return `$${n.toLocaleString('es-CL')}`; }

  async function leerConfig() {
    const { cmConfig } = await chrome.storage.local.get('cmConfig');
    const config = cmConfig || { regiones: [], marcas: [], autoPublicar: false };
    // La casilla del panel manda por sobre la config guardada, para el turno actual.
    const chk = document.getElementById('firmavb-cm-autoguardar');
    if (chk) config.autoGuardarTurno = chk.checked;
    return config;
  }

  // ---------- procesar una ficha ----------
  // Devuelve { estado: 'guardado'|'sin-guardar'|'saltado'|'sin-cambios'|'vacio', cambios }
  async function procesarProducto(opts = {}) {
    const config = opts.config || await leerConfig();
    const forzarGuardar = opts.forzarGuardar || config.autoPublicar || config.autoGuardarTurno;
    const pasos = [];
    let resultado = { estado: 'sin-cambios', cambios: 0 };

    if (!productoCoincideConMarcas(config.marcas)) {
      pasos.push(`⏭️ "${nombreProducto()}" no coincide con ninguna marca configurada. Lo salto.`);
      if (!opts.silencioso) setEstado(pasos.join('<br>'));
      return { estado: 'saltado', cambios: 0, mensaje: pasos.join('<br>') };
    }

    const form = buscarFormularioAsignacion();

    if (requiereDocumento(form || document)) {
      pasos.push('⚠️ Este producto pide subir un PDF/Word. Lo salto (no toco precio ni guardo).');
      if (!opts.silencioso) setEstado(pasos.join('<br>'));
      return { estado: 'saltado', cambios: 0, mensaje: pasos.join('<br>') };
    }

    if (form && filasAsociadas(form).length > 0) {
      const resumen = procesarFilasAsignacion(form, config);
      resultado.cambios = resumen.actualizadas.length;
      if (resumen.actualizadas.length === 0 && resumen.sinReferencial.length === 0) {
        pasos.push(config.regiones && config.regiones.length > 0
          ? 'Ninguna fila coincide con las regiones configuradas.'
          : 'No encontré filas de región con precio en esta ficha.');
        resultado.estado = 'vacio';
      } else {
        resumen.actualizadas.forEach((r) => {
          pasos.push(`${r.region}: ref ${formatoCLP(r.referencial)} → ${formatoCLP(r.nuevoPrecio)}`);
        });
        if (resumen.sinReferencial.length > 0) pasos.push(`Sin referencial (no tocadas): ${resumen.sinReferencial.join(', ')}`);
        if (resumen.fueraDeConfig > 0) pasos.push(`${resumen.fueraDeConfig} fila(s) fuera de config.`);
      }
    } else {
      pasos.push('Sin la tabla de regiones — modo genérico.');
      const referencial = buscarPrecioReferencialGenerico();
      const inputPrecio = referencial != null ? buscarInputPrecioEditableGenerico() : null;
      if (referencial == null || !inputPrecio) {
        pasos.push('No encontré precio referencial o el campo editable. Avísale a Claude con una captura.');
        if (!opts.silencioso) setEstado(pasos.join('<br>'));
        return { estado: 'vacio', cambios: 0, mensaje: pasos.join('<br>') };
      }
      const nuevoPrecio = referencial - 1;
      setValorInput(inputPrecio, nuevoPrecio);
      resultado.cambios = 1;
      pasos.push(`Ref ${formatoCLP(referencial)} → ${formatoCLP(nuevoPrecio)}`);
      const marcadas = marcarRegionesGenerico(config.regiones);
      if (marcadas > 0) pasos.push(`Marqué ${marcadas} región(es).`);
    }

    if (resultado.cambios > 0 && forzarGuardar) {
      const botonGuardar = buscarBoton(REGEX_GUARDAR, REGEX_CANCELAR);
      if (botonGuardar) {
        botonGuardar.click();
        pasos.push('✅ Guardado.');
        resultado.estado = 'guardado';
      } else {
        pasos.push('No encontré el botón Guardar/Publicar — guárdalo tú mismo.');
        resultado.estado = 'sin-guardar';
      }
    } else if (resultado.cambios > 0) {
      pasos.push('Revisa y presiona Guardar/Publicar (o activa el guardado automático).');
      resultado.estado = 'sin-guardar';
    }

    resultado.mensaje = pasos.join('<br>');
    if (!opts.silencioso) setEstado(resultado.mensaje);
    return resultado;
  }

  // ---------- modo continuo (producto tras producto) ----------

  async function guardarLote(lote) { await chrome.storage.local.set({ cmBatch: lote }); }
  async function leerLote() { const { cmBatch } = await chrome.storage.local.get('cmBatch'); return cmBatch || null; }

  async function iniciarLote() {
    if (!esLista()) {
      setEstado('Para el modo continuo, ábrelo desde la <b>lista de productos</b> (Mis productos / Assigned Product List) y vuelve a darle.');
      return;
    }
    const enlaces = enlacesFichasEnLista();
    if (enlaces.length === 0) {
      setEstado('No pude leer los enlaces de las fichas en esta lista. Abre el menú "SELECCIONE" de una fila para ver si trae el enlace, o avísale a Claude con una captura.');
      return;
    }
    const ok = window.confirm(
      `Modo continuo: la extensión abrirá cada producto, pondrá el precio (referencial − $1) y GUARDARÁ, uno tras otro.\n\n` +
      `Se GUARDAN/PUBLICAN precios de verdad en Mercado Público. Puedes Detener cuando quieras.\n\n¿Empezar?`
    );
    if (!ok) return;

    const lote = { activo: true, listaUrl: location.href, procesados: [], stats: { guardados: 0, saltados: 0, sinRef: 0 }, ts: Date.now() };
    await guardarLote(lote);
    mostrarDetener(true);
    setEstado('Modo continuo iniciado…');
    // Ir a la primera ficha no procesada.
    location.href = enlaces[0].href;
  }

  async function detenerLote(msg) {
    const lote = await leerLote();
    await chrome.storage.local.set({ cmBatch: { ...(lote || {}), activo: false } });
    mostrarDetener(false);
    const s = lote ? ` (${lote.stats.guardados} guardados, ${lote.stats.saltados} saltados)` : '';
    setEstado(`${msg || 'Detenido.'}${s}`);
  }

  function resumenLote(lote) {
    return `Continuo: ${lote.stats.guardados} guardados · ${lote.stats.saltados} saltados · ${lote.stats.sinRef} sin referencial. ` +
      `<button id="firmavb-cm-detener2" style="margin-top:6px;background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">Detener</button>`;
  }
  function cablearDetener2() {
    const b = document.getElementById('firmavb-cm-detener2');
    if (b) b.addEventListener('click', () => detenerLote('Detenido por ti.'));
  }

  // En la ficha, dentro del modo continuo: procesar + (si hay cambios) guardar.
  async function loteEnFicha(lote) {
    mostrarDetener(true);
    const id = idFichaActual();
    if (id && !lote.procesados.includes(id)) lote.procesados.push(id);
    const config = await leerConfig();
    const r = await procesarProducto({ config, forzarGuardar: true, silencioso: true });

    if (r.estado === 'guardado') lote.stats.guardados++;
    else if (r.estado === 'saltado') lote.stats.saltados++;
    else if (r.estado === 'vacio') lote.stats.sinRef++;
    else lote.stats.saltados++;
    await guardarLote(lote);
    setEstado(`${r.mensaje || ''}<br><br>${resumenLote(lote)}`);
    cablearDetener2();

    if (r.estado === 'guardado') {
      // Guardar redirige solo a la lista; si en 5 s no navegó, volvemos nosotros.
      setTimeout(() => { if (esFicha()) location.href = lote.listaUrl; }, 5000);
    } else {
      // No hubo guardado (saltado/sin cambios) → volver a la lista para el siguiente.
      setTimeout(() => { location.href = lote.listaUrl; }, 900);
    }
  }

  // En la lista, dentro del modo continuo: elegir la siguiente ficha no procesada.
  async function loteEnLista(lote) {
    mostrarDetener(true);
    const enlaces = enlacesFichasEnLista();
    const siguiente = enlaces.find((e) => !lote.procesados.includes(e.id));
    if (siguiente) {
      setEstado(`${resumenLote(lote)}<br>Abriendo siguiente producto…`);
      cablearDetener2();
      setTimeout(() => { location.href = siguiente.href; }, 700);
      return;
    }
    // Ningún pendiente en esta página → intentar la página siguiente.
    const next = botonPaginaSiguiente();
    if (next) {
      setEstado(`${resumenLote(lote)}<br>Pasando a la página siguiente…`);
      cablearDetener2();
      lote.listaUrl = location.href; // por si la paginación no cambia la URL
      await guardarLote(lote);
      next.click();
      // Si es paginación AJAX (no recarga), reintentar tras un momento.
      setTimeout(() => { leerLote().then((l) => { if (l && l.activo && esLista()) loteEnLista(l); }); }, 2500);
      return;
    }
    await detenerLote('✅ Modo continuo terminado.');
  }

  async function reanudarSiActivo() {
    const lote = await leerLote();
    if (!lote || !lote.activo) return;
    if (esFicha()) loteEnFicha(lote);
    else if (esLista()) loteEnLista(lote);
  }

  // ---------- init ----------
  function init() { crearPanel(); reanudarSiActivo(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
