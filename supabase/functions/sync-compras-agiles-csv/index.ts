// =============================================================================
// SYNC COMPRAS AGILES CSV - Datos Abiertos ChileCompra
// Edge Function que descarga el CSV mensual de compras ágiles como backup
// URL: https://datos-abiertos.chilecompra.cl/descargas/compra-agil
// Diseñada para ejecutarse mensualmente o manualmente como fallback
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const CSV_BASE = 'https://datos-abiertos.chilecompra.cl/descargas/compra-agil';

/** Parsea una línea CSV respetando comillas y delimitadores ; o , */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ';' || ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parsea CSV completo en array de objetos */
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      record[headers[j]] = values[j];
    }
    records.push(record);
  }

  return records;
}

/** Mapea un registro CSV al formato de la tabla compras_agiles */
function mapCSVToCompra(record: Record<string, string>) {
  // Mapear campos comunes del CSV de datos-abiertos ChileCompra
  const codigo = record['Codigo'] || record['codigo'] || record['CodigoExterno'] || record['CODIGO'] || '';
  if (!codigo) return null;

  const monto = parseFloat(record['MontoEstimado'] || record['monto_estimado'] || record['Monto'] || record['MONTO'] || '0') || null;
  const nombre = record['Nombre'] || record['nombre'] || record['NombreLicitacion'] || record['NOMBRE'] || `Compra Ágil ${codigo}`;
  const organismo = record['NombreOrganismo'] || record['Organismo'] || record['organismo'] || record['ORGANISMO'] || 'No especificado';

  return {
    codigo,
    nombre,
    descripcion: record['Descripcion'] || record['descripcion'] || record['DESCRIPCION'] || nombre,
    estado: record['Estado'] || record['estado'] || record['ESTADO'] || 'activa',
    fecha_publicacion: record['FechaPublicacion'] || record['fecha_publicacion'] || null,
    fecha_cierre: record['FechaCierre'] || record['fecha_cierre'] || null,
    monto_estimado: monto,
    moneda: record['Moneda'] || record['moneda'] || 'CLP',
    nombre_organismo: organismo,
    region: record['Region'] || record['region'] || record['RegionUnidad'] || null,
    datos_json: {
      source: 'csv_datos_abiertos',
      synced_at: new Date().toISOString(),
      raw: record,
    },
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determinar qué meses descargar
    // Por defecto: mes actual y anterior. Se puede pasar ?months=3 para más
    const url = new URL(req.url);
    const monthsBack = parseInt(url.searchParams.get('months') || '2', 10);
    const now = new Date();

    let totalSynced = 0;
    let totalSkipped = 0;
    const errors: string[] = [];
    const monthsProcessed: string[] = [];

    for (let m = 0; m < monthsBack; m++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const csvUrl = `${CSV_BASE}/${year}-${month}.csv`;

      console.log(`[CSV] Descargando: ${csvUrl}`);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);

        const res = await fetch(csvUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/csv, application/csv, text/plain, */*',
          },
        });

        clearTimeout(timeout);

        if (!res.ok) {
          console.warn(`[CSV] ${csvUrl} retornó ${res.status}`);
          errors.push(`${year}-${month}: HTTP ${res.status}`);
          continue;
        }

        const text = await res.text();
        const records = parseCSV(text);

        if (records.length === 0) {
          console.warn(`[CSV] ${year}-${month}: sin registros`);
          errors.push(`${year}-${month}: CSV vacío`);
          continue;
        }

        console.log(`[CSV] ${year}-${month}: ${records.length} registros encontrados`);

        // Procesar en batches de 50 para evitar timeout
        const BATCH_SIZE = 50;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          const upsertData = batch
            .map(mapCSVToCompra)
            .filter((d): d is NonNullable<typeof d> => d !== null);

          if (upsertData.length === 0) {
            totalSkipped += batch.length;
            continue;
          }

          const { error: batchError } = await supabase
            .from('compras_agiles')
            .upsert(upsertData, { onConflict: 'codigo' });

          if (batchError) {
            errors.push(`Batch ${i}-${i + BATCH_SIZE} de ${year}-${month}: ${batchError.message}`);
          } else {
            totalSynced += upsertData.length;
          }

          totalSkipped += batch.length - upsertData.length;
        }

        monthsProcessed.push(`${year}-${month}`);
      } catch (fetchErr) {
        const message = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error(`[CSV] Error ${year}-${month}: ${message}`);
        errors.push(`${year}-${month}: ${message}`);
      }
    }

    const result = {
      success: totalSynced > 0 || errors.length === 0,
      message: `CSV sync completado: ${totalSynced} compras sincronizadas`,
      data_source: 'csv_datos_abiertos',
      stats: {
        months_processed: monthsProcessed,
        compras_synced: totalSynced,
        records_skipped: totalSkipped,
        errors_count: errors.length,
      },
      errors: errors.slice(0, 10),
      timestamp: new Date().toISOString(),
    };

    console.log('CSV sync result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-compras-agiles-csv:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
