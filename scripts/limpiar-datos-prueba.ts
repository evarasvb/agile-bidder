import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL no configurada');
  process.exit(1);
}
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada en .env');
  console.log('\n💡 Por favor, configura SUPABASE_SERVICE_ROLE_KEY en tu archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function limpiarDatosPrueba() {
  console.log('🧹 LIMPIANDO DATOS DE PRUEBA DE COMPRAS_AGILES\n');
  console.log('─'.repeat(80));

  try {
    // Buscar todas las compras con códigos de prueba
    const codigosPrueba = [
      'CA-2025-%',
      'CA-2024-%',
      'TEST-%',
      'PRUEBA-%',
      'DEMO-%',
      'SAMPLE-%'
    ];

    let todasComprasPrueba: any[] = [];

    // Buscar por cada patrón
    for (const patron of codigosPrueba) {
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('id, codigo, nombre')
        .ilike('codigo', patron);

      if (error) {
        console.warn(`⚠️  Error al buscar con patrón ${patron}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        todasComprasPrueba = [...todasComprasPrueba, ...data];
      }
    }

    if (todasComprasPrueba.length === 0) {
      console.log('✅ No se encontraron datos de prueba para eliminar.\n');
      
      // Verificar total
      const { count } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Total de compras ágiles en la BD: ${count || 0}\n`);
      return { deleted: 0, total: count || 0 };
    }

    // Mostrar lo que se va a eliminar
    console.log(`📊 Encontrados ${todasComprasPrueba.length} registros de prueba a eliminar:\n`);
    todasComprasPrueba.forEach((compra, i) => {
      console.log(`   ${i + 1}. ${compra.codigo} - ${compra.nombre?.substring(0, 50)}...`);
    });

    // Eliminar todos usando los IDs
    const ids = todasComprasPrueba.map(c => c.id);
    
    console.log(`\n🗑️  Eliminando ${ids.length} registros...`);
    
    const { error: deleteError } = await supabase
      .from('compras_agiles')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`\n✅ ${ids.length} registros eliminados exitosamente!\n`);

    // Verificar resultado
    const { count: countFinal } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    const { count: countPrueba } = await supabase
      .from('compras_agiles')
      .select('codigo', { count: 'exact', head: true })
      .ilike('codigo', 'CA-2025-%');

    console.log('─'.repeat(80));
    console.log(`📊 RESULTADO:`);
    console.log(`   - Eliminados: ${ids.length} registros de prueba`);
    console.log(`   - Total restante: ${countFinal || 0} compras ágiles`);
    console.log(`   - Datos de prueba restantes: ${countPrueba || 0}`);
    console.log('─'.repeat(80));

    if (countPrueba === 0) {
      console.log('\n✅ ¡Base de datos limpia! No quedan datos de prueba.\n');
    }

    return { deleted: ids.length, total: countFinal || 0 };

  } catch (error: any) {
    console.error('\n❌ Error:', error.message || error);
    throw error;
  }
}

async function verificarComprasReales() {
  console.log('\n\n🔍 VERIFICANDO COMPRAS REALES...\n');
  console.log('─'.repeat(80));

  try {
    const { data: compras, error } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, nombre_organismo, monto_estimado, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    if (!compras || compras.length === 0) {
      console.log('⚠️  No hay compras ágiles en la base de datos.');
      console.log('\n💡 Ejecuta el scraper para obtener compras reales:');
      console.log('   cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper');
      console.log('   node scraper.js --test --from 2026-01-15 --to 2026-01-17\n');
      return;
    }

    console.log(`✅ Encontradas ${compras.length} compras ágiles:\n`);
    compras.forEach((compra, i) => {
      const org = (compra as any).nombre_organismo || 'N/A';
      const monto = (compra as any).monto_estimado || null;
      console.log(`   ${i + 1}. ${compra.codigo}`);
      console.log(`      ${compra.nombre?.substring(0, 60)}...`);
      console.log(`      Organismo: ${org}`);
      console.log(`      Monto: ${monto ? `$${Number(monto).toLocaleString('es-CL')}` : 'N/A'}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
  }
}

async function main() {
  console.log('🚀 ARREGLANDO SISTEMA COMPLETO\n');
  console.log('═'.repeat(80));
  console.log(`Fecha: ${new Date().toLocaleString('es-CL')}\n`);

  try {
    // Paso 1: Limpiar datos de prueba
    await limpiarDatosPrueba();

    // Paso 2: Verificar compras reales
    await verificarComprasReales();

    console.log('\n✅ PROCESO COMPLETADO\n');
    console.log('💡 Próximos pasos:');
    console.log('   1. Refresca firmavb.cl en el navegador (Cmd + Shift + R)');
    console.log('   2. Las compras de prueba ya no deberían aparecer');
    console.log('   3. Si no hay compras reales, ejecuta el scraper\n');

  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message || error);
    process.exit(1);
  }
}

main();
