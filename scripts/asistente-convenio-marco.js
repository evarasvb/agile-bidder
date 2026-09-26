/**
 * Asistente Convenio Marco (FirmaVB) — carga de ofertas con lógica "un peso menos".
 *
 * Se ejecuta en la consola (F12) del portal de proveedores de Mercado Público.
 * Cobra 1 crédito por producto cargado. El cobro es server-side (extension-api →
 * consumir_creditos): no se puede saltar desde el navegador. Cuando el cliente se
 * queda sin créditos, el asistente se frena solo (muro de pago).
 *
 * ANTES DE USAR: pega tu API key de FirmaVB en CFG.API_KEY (la obtienes en la app,
 * sección Extensión / Integraciones). Sin una key válida y con saldo, no corre.
 */
(async () => {
  const CFG = {
    API_KEY: '',            // ← pega aquí tu API key de FirmaVB (fvb_ext_...)
    API_URL: 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/extension-api',
    DRY_RUN: false,         // true = solo simula (no cobra créditos ni guarda)
    CATEGORIAS: [],         // [] = todas. Ej: ['BOLSA DE BASURA','ESCOBA']
    DESCUENTO: 1,           // pesos bajo el precio de referencia
    STOCK: '99999999',      // radio "Sí"
    PAUSA_MS: 500,
    TIMEOUT_MS: 45000,
    REINTENTOS: 3
  };
  const TIENDA = location.pathname.split('/')[1] || 'aseo3';
  const ROOT = `/${TIENDA}/mpassignproduct/product/`;
  const KEY = `colgarse_${TIENDA}_hechos`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const parse = h => new DOMParser().parseFromString(h, 'text/html');
  const num = s => +(String(s || '').replace(/\./g, '').replace(',', '.')) || 0;
  const cookie = n => (document.cookie.split('; ').find(c => c.startsWith(n + '=')) || '').split('=').slice(1).join('=');
  const formKey = () => decodeURIComponent(cookie('form_key')) || (document.querySelector('input[name="form_key"]') || {}).value || '';

  async function pedir(url, opts = {}) {
    for (let i = 1; i <= CFG.REINTENTOS; i++) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), CFG.TIMEOUT_MS);
      try { const r = await fetch(url, { credentials: 'include', ...opts, signal: ctl.signal }); r._txt = await r.text(); clearTimeout(t); return r; }
      catch (e) { clearTimeout(t); if (i === CFG.REINTENTOS) throw new Error('sin respuesta del sitio'); await sleep(3000 * i); }
    }
  }
  const get = async url => parse((await pedir(url))._txt);

  // ── FirmaVB: créditos ────────────────────────────────────────────────
  async function fvb(action, body) {
    const r = await fetch(`${CFG.API_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CFG.API_KEY },
      body: JSON.stringify(body || {}),
    });
    return r.json().catch(() => ({}));
  }
  // Cobra 1 crédito por producto. Devuelve { ok, saldo, motivo }.
  const cobrarCredito = (referencia) => fvb('cm-cobrar', { cantidad: 1, referencia });
  const verificarCreditos = () => fvb('cm-verificar', {});

  let hechos = {};
  try { hechos = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  const marcar = id => { if (CFG.DRY_RUN) return; hechos[id] = 1; try { localStorage.setItem(KEY, JSON.stringify(hechos)); } catch (e) {} };

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#1e2a3a;color:#fff;font:13px/1.45 sans-serif;padding:12px 14px;border-radius:8px;max-width:380px;box-shadow:0 4px 16px #0006';
  document.body.appendChild(box);
  let detener = false;
  let saldo = null;            // créditos restantes (null = ilimitado o desconocido)
  let ilimitado = false;
  const st = { cat: 0, cats: 0, revisados: 0, ok: 0, documento: 0, ya: 0, sinRef: 0, error: 0 };
  const log = [];
  const pintar = msg => {
    const saldoTxt = ilimitado ? 'Ilimitado' : (saldo === null ? '—' : `${saldo} cargas de tu plan`);
    box.innerHTML = `<b>${CFG.DRY_RUN ? 'SIMULACIÓN' : 'ASISTENTE CONVENIO MARCO'}</b> · FirmaVB<br>
      Saldo: <b>${saldoTxt}</b> · Categoría ${st.cat}/${st.cats}<br>${msg}<br>
      Revisados: ${st.revisados} · <b>Subidos: ${st.ok}</b><br>
      Saltados documento: ${st.documento} · Ya ofertados: ${st.ya} · Sin precio ref: ${st.sinRef} · Errores: ${st.error}<br>
      <button id="cm-stop" style="margin-top:6px">Detener</button> <button id="cm-csv" style="margin-top:6px">Descargar informe</button>`;
    const stop = box.querySelector('#cm-stop'); if (stop) stop.onclick = () => { detener = true; };
    const csv = box.querySelector('#cm-csv'); if (csv) csv.onclick = descargar;
  };
  const pintarMuro = () => {
    box.innerHTML = `<b>Llegaste al límite de tu plan</b><br>
      El Asistente Convenio Marco se detuvo. Alcanzaste a subir <b>${st.ok}</b> productos.<br>
      Sube a FirmaVB ERP y sigue cargando sin frenar 👉 ingresa a FirmaVB.<br>
      <button id="cm-csv" style="margin-top:6px">Descargar informe</button>`;
    const csv = box.querySelector('#cm-csv'); if (csv) csv.onclick = descargar;
  };
  function descargar() {
    const cols = ['id', 'categoria', 'marca', 'nombre', 'estado', 'regiones', 'detalle'];
    const csv = [cols.join(';')].concat(log.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `convenio_marco_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function procesar(prod) {
    st.revisados++;
    const reg = { ...prod, estado: '', regiones: 0, detalle: '' };
    try {
      if (prod.pideCarta) { reg.estado = 'SALTADO: pide carta de autorización'; st.documento++; marcar(prod.id); return log.push(reg); }
      const d = await get(`${ROOT}add/id/${prod.id}`);
      document.cookie = 'mage-messages=; path=/; max-age=0';
      const form = d.querySelector('form[action*="product/save"]');
      if (!form) { reg.estado = 'SALTADO: ya asignado'; st.ya++; marcar(prod.id); return log.push(reg); }
      const filas = [...form.querySelectorAll('.wk-associated-table tbody tr')];
      if (filas.some(f => f.querySelector('input[type="file"]'))) { reg.estado = 'SALTADO: pide documento'; st.documento++; marcar(prod.id); return log.push(reg); }
      const det = []; let ya = 0;
      for (const f of filas) {
        const precio = f.querySelector('input.wk-associate-price'), chk = f.querySelector('input.wk-associate-chkbox');
        if (!precio || !chk) continue;
        if (num(precio.getAttribute('data-base')) > 0) { ya++; continue; }
        const ref = parseFloat(precio.getAttribute('data-control')) || 0;
        if (ref <= CFG.DESCUENTO) continue;
        const nuevo = Math.floor(ref - CFG.DESCUENTO);
        chk.checked = true;
        f.querySelectorAll('input[type="radio"][name$="[qty]"]').forEach(r => { r.checked = (r.value === CFG.STOCK); });
        precio.value = String(nuevo);
        det.push(`${(f.querySelector('input[name$="[region]"]') || {}).value || ''}: ${ref}→${nuevo}`);
      }
      reg.regiones = det.length; reg.detalle = det.join(' | ');
      if (!det.length) { reg.estado = ya ? 'SALTADO: ya ofertado' : 'SALTADO: sin precio de referencia'; ya ? st.ya++ : st.sinRef++; marcar(prod.id); return log.push(reg); }
      if (CFG.DRY_RUN) { reg.estado = 'SIMULADO'; return log.push(reg); }

      // ── COBRO DE CRÉDITO (antes de guardar) ──────────────────────────
      const cobro = await cobrarCredito(prod.id);
      if (!cobro.ok && cobro.motivo === 'sin_creditos') {
        reg.estado = 'DETENIDO: límite del plan';
        log.push(reg);
        saldo = cobro.saldo ?? 0;
        detener = true;
        return;
      }
      if (typeof cobro.saldo === 'number') saldo = cobro.saldo;
      if (cobro.motivo === 'ilimitado') ilimitado = true;

      const fd = new FormData(form); fd.set('form_key', formKey());
      const resp = await pedir(form.getAttribute('action'), { method: 'POST', body: fd });
      let msgs = '';
      try { msgs = JSON.parse(decodeURIComponent(cookie('mage-messages')) || '[]').map(x => `${x.type}: ${x.text}`).join(' / '); } catch (e) {}
      document.cookie = 'mage-messages=; path=/; max-age=0';
      if (!resp.ok || /error/i.test(msgs)) { reg.estado = 'ERROR al guardar'; reg.detalle += ' || ' + msgs; st.error++; }
      else { reg.estado = 'SUBIDO'; st.ok++; marcar(prod.id); }
      log.push(reg);
    } catch (e) { reg.estado = 'ERROR: ' + e.message; st.error++; log.push(reg); }
  }

  try {
    // ── Verificación de créditos al iniciar ────────────────────────────
    if (!CFG.API_KEY) {
      box.innerHTML = '<b>Falta tu API key de FirmaVB</b><br>Pégala en CFG.API_KEY (la obtienes en la app, sección Extensión) y vuelve a lanzar.';
      return;
    }
    if (!CFG.DRY_RUN) {
      pintar('Verificando tu plan FirmaVB…');
      const chk = await verificarCreditos();
      if (!chk.success) {
        box.innerHTML = `<b>No pude validar tu cuenta FirmaVB</b><br>${chk.error || 'API key inválida o desactivada.'}`;
        return;
      }
      ilimitado = !!chk.ilimitado;
      saldo = chk.saldo ?? 0;
      if (!ilimitado && saldo <= 0) { pintarMuro(); return; }
    }

    pintar('Leyendo categorías…');
    let d0 = document;
    if (!d0.querySelector('#atribute_set_id option')) d0 = await get(ROOT + 'view/?query=cloro');
    let cats = [...d0.querySelectorAll('#atribute_set_id option')].filter(o => o.value).map(o => ({ id: o.value, nombre: o.textContent.trim() }));
    if (CFG.CATEGORIAS.length) { const w = CFG.CATEGORIAS.map(x => x.trim().toUpperCase()); cats = cats.filter(c => w.includes(c.nombre.toUpperCase())); }
    st.cats = cats.length;
    const vistos = new Set();

    for (const c of cats) {
      if (detener) break;
      st.cat++;
      for (let p = 1; p < 200 && !detener; p++) {
        pintar(`${c.nombre} · leyendo página ${p}…`);
        let d;
        try { d = await get(`${ROOT}view/?query=&atribute_set_id=${c.id}&limit=50&p=${p}`); }
        catch (e) { log.push({ categoria: c.nombre, estado: `ERROR listando pág. ${p}: ${e.message}` }); st.error++; break; }
        const btns = [...d.querySelectorAll('.wk-ap-btn[data-brand]')];
        const pagina = [];
        for (const b of btns) {
          if (vistos.has(b.id)) continue; vistos.add(b.id);
          const tds = b.closest('tr') ? b.closest('tr').querySelectorAll('td') : [];
          pagina.push({ id: b.id, categoria: c.nombre, marca: b.dataset.brand, nombre: tds[1] ? tds[1].textContent.trim() : '',
            pideCarta: b.dataset.authproduct === '1' && b.dataset.isbrandseller !== '1' });
        }
        let i = 0;
        for (const prod of pagina) {
          if (detener) break; i++;
          if (hechos[prod.id]) continue;
          pintar(`${c.nombre} · pág. ${p} · ${i}/${pagina.length}<br>${prod.nombre.slice(0, 55)}`);
          await procesar(prod);
          if (detener) break;
          await sleep(CFG.PAUSA_MS);
        }
        const m = ((d.querySelector('.toolbar-amount') || {}).textContent || '').match(/al\s+([\d.]+)\s+de\s+([\d.]+)/);
        if (!btns.length || !pagina.length || !m || num(m[1]) >= num(m[2])) break;
      }
    }
    window.__colgarseLog = log;
    if (detener && !ilimitado && saldo !== null && saldo <= 0) pintarMuro();
    else pintar(detener ? 'Detenido por el usuario.' : '<b>¡Terminado!</b> Descarga el informe.');
  } catch (e) { pintar('Se detuvo por un error: ' + e.message + '. Vuelve a lanzarlo, sigue donde quedó.'); }
  console.table(log);
})();
