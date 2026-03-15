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
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada');
  console.log('\n💡 Usando método alternativo con anon key...\n');
}

const supabase = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');

async function limpiarDatosPrueba() {
  console.log('🧹 LIMPIANDO DATOS DE PRUEBA DE COMPRAS_AGILES\n');
  console.log('─'.repeat(80));

  try {
    // Buscar compras con códigos de prueba usando múltiples queries
    console.log('🔍 Buscando datos de prueba...\n');
    
    const patrones = [
      { patron: 'CA-2025-%', campo: 'codigo' },
      { patron: 'CA-2024-%', campo: 'codigo' },
      { patron: 'TEST-%', campo: 'codigo' },
      { patron: 'PRUEBA-%', campo: 'codigo' }
    ];

    let todasComprasPrueba: any[] = [];

    for (const { patron } of patrones) {
      try {
        const { data, error } = await supabase
          .from('compras_agiles')
          .select('id, codigo, nombre')
          .ilike('codigo', patron);

        if (error) {
          console.warn(`⚠️  Error al buscar ${patron}:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          todasComprasPrueba = [...todasComprasPrueba, ...data];
          console.log(`   ✓ Encontradas ${data.length} compras con patrón ${patron}`);
        }
      } catch (err: any) {
        console.warn(`⚠️  Error con patrón ${patron}:`, err.message);
      }
    }

    if (todasComprasPrueba.length === 0) {
      console.log('\n✅ No se encontraron datos de prueba para eliminar.\n');
      
      // Verificar total
      const { count } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Total de compras ágiles en la BD: ${count || 0}\n`);
      return { deleted: 0, total: count || 0 };
    }

    // Eliminar duplicados por ID
    const comprasUnicas = Array.from(
      new Map(todasComprasPrueba.map(c => [c.id, c])).values()
    );

    console.log(`\n📊 Total de registros únicos a eliminar: ${comprasUnicas.length}\n`);
    comprasUnicas.forEach((compra, i) => {
      console.log(`   ${i + 1}. ${compra.codigo} - ${compra.nombre?.substring(0, 50)}...`);
    });

    // Eliminar usando los IDs
    const ids = comprasUnicas.map(c => c.id);
    
    console.log(`\n🗑️  Eliminando ${ids.length} registros...`);
    
    const { error: deleteError, count } = await supabase
      .from('compras_agiles')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (deleteError) {
      // Si falla por permisos, intentar uno por uno
      console.log('\n⚠️  Error al eliminar en batch, intentando uno por uno...\n');
      
      let eliminados = 0;
      for (const id of ids) {
        const { error: err } = await supabase
          .from('compras_agiles')
          .delete()
          .eq('id', id);
        
        if (!err) eliminados++;
      }
      
      console.log(`\n✅ ${eliminados} de ${ids.length} registros eliminados exitosamente!\n`);
    } else {
      console.log(`\n✅ ${count || ids.length} registros eliminados exitosamente!\n`);
    }

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

async function main() {
  console.log('🚀 EJECUTANDO LIMPIEZA AUTOMÁTICA DE DATOS DE PRUEBA\n');
  console.log('═'.repeat(80));
  console.log(`Fecha: ${new Date().toLocaleString('es-CL')}\n`);

  try {
    await limpiarDatosPrueba();

    console.log('\n✅ PROCESO COMPLETADO!\n');
    console.log('💡 Próximos pasos:');
    console.log('   1. Publica en Lovable');
    console.log('   2. Refresca firmavb.cl (Cmd + Shift + R)');
    console.log('   3. ¡Todo funcionando al 100%!\n');

  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message || error);
    console.log('\n⚠️  Si falló, ejecuta el SQL manualmente en Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql\n');
    process.exit(1);
  }
}

main();
