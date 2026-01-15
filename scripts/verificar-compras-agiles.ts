/**
 * Script para verificar si hay compras ágiles cargadas en la base de datos
 * 
 * Uso:
 *   deno run --allow-net --allow-env scripts/verificar-compras-agiles.ts
 * 
 * O con variables de entorno:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... deno run --allow-net --allow-env scripts/verificar-compras-agiles.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://euzqadopjvdszcdjegmo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.log('Por favor, configura la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verificarComprasAgiles() {
  console.log('🔍 Verificando compras ágiles en la base de datos...\n');

  try {
    // Contar total de compras ágiles
    const { count, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error al contar compras ágiles:', countError);
      return;
    }

    console.log(`📊 Total de compras ágiles: ${count || 0}\n`);

    if (count === 0) {
      console.log('⚠️  No hay compras ágiles cargadas en la base de datos.');
      console.log('\nPosibles razones:');
      console.log('  1. El scraping aún no se ha ejecutado');
      console.log('  2. El servidor pending-sync no está guardando los datos');
      console.log('  3. Hay un error en el proceso de sincronización');
      console.log('\nRecomendaciones:');
      console.log('  - Verificar que la extensión de Chrome esté configurada');
      console.log('  - Verificar que el servidor pending-sync esté funcionando');
      console.log('  - Revisar los logs del servidor pending-sync');
      return;
    }

    // Obtener algunas compras ágiles de ejemplo
    const { data: compras, error: dataError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, organismo, monto, estado, fecha_cierre, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (dataError) {
      console.error('❌ Error al obtener compras ágiles:', dataError);
      return;
    }

    console.log('✅ Compras ágiles encontradas:\n');
    console.log('Últimas 10 compras ágiles:');
    console.log('─'.repeat(100));

    compras?.forEach((compra, index) => {
      console.log(`\n${index + 1}. Código: ${compra.codigo}`);
      console.log(`   Nombre: ${compra.nombre}`);
      console.log(`   Organismo: ${compra.organismo}`);
      console.log(`   Monto: ${compra.monto ? `$${compra.monto.toLocaleString('es-CL')}` : 'N/A'}`);
      console.log(`   Estado: ${compra.estado || 'N/A'}`);
      console.log(`   Fecha cierre: ${compra.fecha_cierre ? new Date(compra.fecha_cierre).toLocaleDateString('es-CL') : 'N/A'}`);
      console.log(`   Creada: ${new Date(compra.created_at).toLocaleString('es-CL')}`);
    });

    // Estadísticas
    const { data: todasCompras, error: statsError } = await supabase
      .from('compras_agiles')
      .select('estado, match_encontrado, monto');

    if (!statsError && todasCompras) {
      const conMatch = todasCompras.filter(c => c.match_encontrado).length;
      const activas = todasCompras.filter(c => c.estado === 'activa').length;
      const montoTotal = todasCompras.reduce((sum, c) => sum + (c.monto || 0), 0);

      console.log('\n' + '─'.repeat(100));
      console.log('\n📈 Estadísticas:');
      console.log(`   Total: ${count}`);
      console.log(`   Con match: ${conMatch}`);
      console.log(`   Activas: ${activas}`);
      console.log(`   Monto total: $${montoTotal.toLocaleString('es-CL')}`);
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

verificarComprasAgiles();
