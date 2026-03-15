/**
 * Script de seed CSV para compras ágiles.
 *
 * Descarga CSVs históricos de datos-abiertos.chilecompra.cl llamando a la
 * edge function `sync-compras-agiles-csv` con el parámetro `months=N`.
 *
 * Uso:
 *   npx tsx scripts/seed-csv.ts
 *
 * Variables de entorno:
 *   SUPABASE_URL             - URL del proyecto Supabase (requerido)
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (requerido)
 *   MESES_CSV                - Meses hacia atrás a importar (default: 12)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MESES_CSV = parseInt(process.env.MESES_CSV || '12', 10);

interface CsvSyncStats {
  months_processed?: string[];
  compras_synced?: number;
  records_skipped?: number;
  errors_count?: number;
}

interface CsvSyncResult {
  success: boolean;
  message?: string;
  data_source?: string;
  stats?: CsvSyncStats;
  errors?: string[];
  timestamp?: string;
}

async function main(): Promise<void> {
  // Validar variables de entorno requeridas
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    console.error(`❌ Faltan variables de entorno requeridas: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('\n🚀 Iniciando seed CSV de compras ágiles');
  console.log(`📅 Meses a importar: ${MESES_CSV}`);
  console.log(`🔗 Endpoint: ${SUPABASE_URL}/functions/v1/sync-compras-agiles-csv\n`);

  const url = `${SUPABASE_URL}/functions/v1/sync-compras-agiles-csv?months=${MESES_CSV}`;

  console.log(`📥 Llamando a edge function (esto puede tardar varios minutos)...`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json() as CsvSyncResult;

    console.log('\n==============================');
    console.log('RESULTADO SEED CSV');
    console.log('==============================');
    console.log(`✅ Success        : ${result.success}`);
    console.log(`📊 Mensaje        : ${result.message || 'N/A'}`);
    console.log(`🔗 Fuente         : ${result.data_source || 'csv_datos_abiertos'}`);

    if (result.stats) {
      const { months_processed, compras_synced, records_skipped, errors_count } = result.stats;
      console.log('\n📈 Estadísticas:');
      console.log(`  Meses procesados    : ${months_processed?.join(', ') || 'N/A'}`);
      console.log(`  Compras sincronizadas: ${compras_synced ?? 0}`);
      console.log(`  Registros omitidos   : ${records_skipped ?? 0}`);
      console.log(`  Errores              : ${errors_count ?? 0}`);
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errores encontrados:');
      result.errors.forEach((err: string) => console.log(`  - ${err}`));
    }

    console.log('==============================\n');

    if (!result.success) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
