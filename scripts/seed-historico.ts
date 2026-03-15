/**
 * Script de seed histórico para licitaciones y órdenes de compra.
 *
 * Puebla la BD con datos históricos desde MercadoPúblico iterando día a día
 * y llamando a la edge function `mercadopublico-api` con rate limiting.
 *
 * Uso:
 *   npx tsx scripts/seed-historico.ts
 *
 * Variables de entorno:
 *   SUPABASE_URL             - URL del proyecto Supabase (requerido)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (requerido)
 *   MP_API_TICKET            - Ticket de la API de MercadoPúblico (requerido)
 *   MESES_ATRAS              - Meses a importar hacia atrás (default: 6)
 *   TIPO                     - licitaciones | ordenes | ambos (default: ambos)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MP_API_TICKET = process.env.MP_API_TICKET || '';
const MESES_ATRAS = parseInt(process.env.MESES_ATRAS || '6', 10);
const TIPO = (process.env.TIPO || 'ambos') as 'licitaciones' | 'ordenes' | 'ambos';

/** Milisegundos entre llamadas a la API (rate limit: 1 req / 2 s) */
const RATE_LIMIT_MS = 2000;

/** Convierte un Date a formato ddmmaaaa requerido por la API de MercadoPúblico */
function formatFecha(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface EdgeFunctionResult {
  success: boolean;
  synced?: number;
  errors?: unknown[];
  message?: string;
}

/** Llama a la edge function mercadopublico-api con la acción y fecha indicadas */
async function callEdgeFunction(action: string, fecha: string): Promise<EdgeFunctionResult> {
  const url = `${SUPABASE_URL}/functions/v1/mercadopublico-api`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, fecha, ticket: MP_API_TICKET }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json() as Promise<EdgeFunctionResult>;
}

async function main(): Promise<void> {
  // Validar variables de entorno requeridas
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!MP_API_TICKET) missing.push('MP_API_TICKET');
  if (missing.length > 0) {
    console.error(`❌ Faltan variables de entorno requeridas: ${missing.join(', ')}`);
    process.exit(1);
  }

  const now = new Date();
  // Fecha de inicio: primer día del mes N meses atrás
  const startDate = new Date(now.getFullYear(), now.getMonth() - MESES_ATRAS, 1);

  // Construir lista de fechas a procesar (día a día)
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= now) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  console.log('\n🚀 Iniciando seed histórico de MercadoPúblico');
  console.log(`📅 Período: ${startDate.toISOString().split('T')[0]} → ${now.toISOString().split('T')[0]}`);
  console.log(`📊 Total días a procesar: ${dates.length}`);
  console.log(`🔄 Tipo: ${TIPO}`);
  console.log(`⏱  Rate limit: ${RATE_LIMIT_MS} ms entre llamadas\n`);

  let totalLicitacionesSynced = 0;
  let totalOrdenesSynced = 0;
  let totalErrors = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const fecha = formatFecha(date);
    const progress = `[${String(i + 1).padStart(String(dates.length).length, ' ')}/${dates.length}]`;

    // --- Licitaciones ---
    if (TIPO === 'licitaciones' || TIPO === 'ambos') {
      try {
        const result = await callEdgeFunction('sync-licitaciones', fecha);
        const synced = result.synced ?? 0;
        const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
        totalLicitacionesSynced += synced;
        if (errCount > 0) totalErrors += errCount;
        console.log(
          `${progress} ✓ Licitaciones ${fecha}: ${synced} sync` +
          (errCount > 0 ? `, ${errCount} errores` : '')
        );
      } catch (err) {
        totalErrors++;
        console.error(
          `${progress} ✗ Licitaciones ${fecha}: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // Esperar entre licitaciones y órdenes del mismo día
      if (TIPO === 'ambos') {
        await sleep(RATE_LIMIT_MS);
      }
    }

    // --- Órdenes de compra ---
    if (TIPO === 'ordenes' || TIPO === 'ambos') {
      try {
        const result = await callEdgeFunction('sync-ordenes', fecha);
        const synced = result.synced ?? 0;
        const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
        totalOrdenesSynced += synced;
        if (errCount > 0) totalErrors += errCount;
        console.log(
          `${progress} ✓ Órdenes     ${fecha}: ${synced} sync` +
          (errCount > 0 ? `, ${errCount} errores` : '')
        );
      } catch (err) {
        totalErrors++;
        console.error(
          `${progress} ✗ Órdenes     ${fecha}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Rate limit entre días (excepto el último)
    if (i < dates.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log('\n==============================');
  console.log('RESUMEN SEED HISTÓRICO');
  console.log('==============================');
  console.log(`✅ Licitaciones sincronizadas : ${totalLicitacionesSynced}`);
  console.log(`✅ Órdenes sincronizadas      : ${totalOrdenesSynced}`);
  console.log(`⚠️  Errores                   : ${totalErrors}`);
  console.log(`📅 Días procesados            : ${dates.length}`);
  console.log('==============================\n');

  // Salir con error sólo si no se importó nada y hubo errores
  if (totalErrors > 0 && totalLicitacionesSynced === 0 && totalOrdenesSynced === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
