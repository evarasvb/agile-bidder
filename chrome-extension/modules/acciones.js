// FirmaVB Postulador - Acciones de Don Evaristo
// ==============================================
// Don Evaristo (el asistente de FirmaVB) deja acciones en cola; la extensión las toma
// cada minuto, abre la página de Mercado Público que corresponde en una pestaña y el
// content script de esa página hace el trabajo con la sesión del usuario. Al terminar,
// el content script reporta el resultado y la acción se cierra.
//
// Se ejecuta UNA acción a la vez. Si la pestaña se cierra o pasan 20 minutos sin
// reporte, la acción se marca fallida para que el chat no quede "en curso" para siempre.

import { accionesPendientes, accionResultado } from './supabase-api.js';
import { showNotification } from './notifications.js';

const URL_FICHA_LIC = (c) => `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${encodeURIComponent(c)}`;
const URL_FICHA_CA = (c) => `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${encodeURIComponent(c)}`;
const URL_LISTA_CM = 'https://conveniomarco.mercadopublico.cl/mpassignproduct/product/productlist';
const EXPIRA_MS = 20 * 60000;

const NOMBRE_TIPO = {
  sincronizar_licitacion: 'Sincronizar licitación',
  sincronizar_ca: 'Traer documentos de compra ágil',
  preparar_oferta: 'Dejar la oferta lista',
  publicar_cm: 'Publicar en Convenio Marco',
};

let procesando = false;

async function tabViva(tabId) {
  if (!tabId) return false;
  try { await chrome.tabs.get(tabId); return true; } catch { return false; }
}

// Llamado por la alarma de cada minuto (y a mano desde el popup).
export async function procesarAcciones() {
  if (procesando) return { success: false, error: 'ocupado' };
  procesando = true;
  try {
    const { apiKey, firmavbAccion } = await chrome.storage.local.get(['apiKey', 'firmavbAccion']);
    if (!apiKey) return { success: false, error: 'No API key configured' };

    if (firmavbAccion) {
      // Un reporte final que no se pudo mandar la vez pasada (offline, 5xx del servidor):
      // se reintenta antes que nada, sin tocar pestañas ni marcar por pestaña cerrada.
      if (firmavbAccion.pendingReport) {
        const rr = await accionResultado(firmavbAccion.pendingReport);
        if (rr && rr.success) {
          if (firmavbAccion.pendingReport.cerrarPestanas && firmavbAccion.tabId) {
            chrome.tabs.remove(firmavbAccion.tabId).catch(() => {});
          }
          await chrome.storage.local.remove('firmavbAccion');
        }
        return { success: true, esperando: firmavbAccion.id };
      }
      const vigente = Date.now() - (firmavbAccion.ts || 0) < EXPIRA_MS;
      if (vigente && (await tabViva(firmavbAccion.tabId))) {
        return { success: true, esperando: firmavbAccion.id };
      }
      const rr = await accionResultado({
        accion_id: firmavbAccion.id,
        success: false,
        error: vigente ? 'Se cerró la pestaña antes de terminar.' : 'Pasaron 20 minutos sin terminar. Revisa que tu sesión de Mercado Público esté iniciada y vuelve a pedirla.',
      });
      // Si tampoco esto se pudo mandar, queda para reintentar en el próximo ciclo en vez
      // de perderse (la fila del servidor igual se marcará fallida sola a los 15 min).
      if (rr && rr.success) await chrome.storage.local.remove('firmavbAccion');
    }

    const r = await accionesPendientes();
    const lista = (r && r.success && r.acciones) || [];
    if (!lista.length) return { success: true, procesadas: 0 };
    return ejecutar(lista[0]);
  } catch (error) {
    console.error('[Acciones] Error:', error);
    return { success: false, error: error.message };
  } finally {
    procesando = false;
  }
}

async function ejecutar(a) {
  const payload = a.payload || {};
  let url = null;
  let active = false;
  switch (a.tipo) {
    case 'sincronizar_licitacion':
      url = a.codigo ? URL_FICHA_LIC(a.codigo) : null;
      break;
    case 'sincronizar_ca':
      url = a.codigo ? URL_FICHA_CA(a.codigo) : null;
      break;
    case 'preparar_oferta':
      url = a.codigo ? (/-COT\d+$/i.test(a.codigo) ? URL_FICHA_CA(a.codigo) : URL_FICHA_LIC(a.codigo)) : null;
      active = true; // el usuario tiene que revisar y enviar
      break;
    case 'publicar_cm':
      url = payload.url || URL_LISTA_CM;
      active = true; // publica precios reales: que se vea
      break;
    default:
      await accionResultado({ accion_id: a.id, success: false, error: `Tipo de acción desconocido: ${a.tipo}` });
      return { success: false, error: 'tipo desconocido' };
  }
  if (!url) {
    await accionResultado({ accion_id: a.id, success: false, error: 'La acción no trae el código de la licitación o compra ágil.' });
    return { success: false, error: 'sin código' };
  }

  const tab = await chrome.tabs.create({ url, active });
  await chrome.storage.local.set({
    firmavbAccion: { id: a.id, tipo: a.tipo, codigo: a.codigo || null, payload, tabId: tab.id, ts: Date.now() },
  });
  await accionResultado({ accion_id: a.id, parcial: true, resultado: { paso: 'abriendo', url } });
  try { showNotification('Don Evaristo', `${NOMBRE_TIPO[a.tipo] || a.tipo}${a.codigo ? ` · ${a.codigo}` : ''}`); } catch {}
  console.log('[Acciones] Ejecutando', a.tipo, a.codigo, 'en pestaña', tab.id);
  return { success: true, procesadas: 1, accion: a.id };
}

// Los content scripts reportan por aquí. `parcial: true` solo refresca el avance.
export async function reportarResultado(data, sender) {
  const r = await accionResultado(data);
  if (!data.parcial) {
    const { firmavbAccion } = await chrome.storage.local.get('firmavbAccion');
    if (r && r.success) {
      if (firmavbAccion && firmavbAccion.id === data.accion_id) {
        await chrome.storage.local.remove('firmavbAccion');
        // Las acciones silenciosas (sincronizar) cierran sus pestañas al terminar.
        if (data.cerrarPestanas) {
          const ids = new Set([firmavbAccion.tabId, sender && sender.tab && sender.tab.id].filter(Boolean));
          for (const id of ids) chrome.tabs.remove(id).catch(() => {});
        }
      }
      try {
        showNotification('Don Evaristo', data.success ? `Listo: ${data.resumen || NOMBRE_TIPO[firmavbAccion && firmavbAccion.tipo] || 'acción terminada'}` : `No pude: ${data.error || 'error'}`);
      } catch {}
    } else if (firmavbAccion && firmavbAccion.id === data.accion_id) {
      // El servidor no confirmó el resultado (sin red, 5xx…): se guarda para reintentar en
      // el próximo ciclo en vez de cerrar la pestaña y perder el único intento de reportarlo.
      console.warn('[Acciones] No se pudo reportar el resultado, reintento en el próximo ciclo', data.accion_id, r && r.error);
      await chrome.storage.local.set({ firmavbAccion: { ...firmavbAccion, pendingReport: data } }).catch(() => {});
    }
  }
  return r;
}

// El content script pregunta si la página en la que está corresponde a una acción en curso.
export async function accionActiva() {
  const { firmavbAccion } = await chrome.storage.local.get('firmavbAccion');
  if (!firmavbAccion || Date.now() - (firmavbAccion.ts || 0) > EXPIRA_MS) return { success: true, accion: null };
  return { success: true, accion: firmavbAccion };
}

// Abrir una pestaña desde un content script (window.open sin clic del usuario se bloquea).
export async function abrirTab({ url, active = false }) {
  const tab = await chrome.tabs.create({ url, active: !!active });
  return { success: true, tabId: tab.id };
}
