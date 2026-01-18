import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Cargar variables de entorno
dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://euzqadopjvdszcdjegmo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: Falta variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  console.error('💡 Necesitas configurar SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

console.log(`🔗 Conectando a: ${supabaseUrl.substring(0, 30)}...`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function eliminarComprasPrueba() {
  console.log('🗑️  Eliminando compras ágiles de prueba...\n');

  try {
    // Primero contar cuántas hay
    const { count: countBefore, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Total de compras ágiles antes: ${countBefore || 0}`);

    // Obtener todas las compras para filtrar manualmente
    const { data: todasCompras, error: selectError } = await supabase
      .from('compras_agiles')
      .select('id, codigo, nombre, nombre_organismo, organismo');

    if (selectError) {
      throw selectError;
    }

    if (!todasCompras || todasCompras.length === 0) {
      console.log('✅ No hay compras ágiles en la base de datos');
      return;
    }

    // Filtrar compras de prueba
    const comprasPrueba = todasCompras.filter(compra => {
      const codigo = (compra.codigo || '').toLowerCase();
      const nombre = (compra.nombre || '').toLowerCase();
      const organismo = (compra.nombre_organismo || compra.organismo || '').toLowerCase();

      return (
        codigo.startsWith('ca-2025-') ||
        codigo.startsWith('ca-2024-') ||
        codigo.startsWith('test-') ||
        codigo.startsWith('prueba-') ||
        codigo.startsWith('demo-') ||
        codigo.startsWith('sample-') ||
        ['test', 'prueba', 'demo', 'sample'].includes(codigo) ||
        organismo === 'organismo no especificado' ||
        organismo === 'organismo de prueba' ||
        nombre.includes('test') ||
        nombre.includes('prueba') ||
        nombre.includes('ejemplo') ||
        nombre.includes('dummy') ||
        nombre.includes('sample') ||
        nombre.includes('demo')
      );
    });

    if (comprasPrueba.length === 0) {
      console.log('✅ No se encontraron compras de prueba para eliminar');
      return;
    }

    console.log(`🔍 Encontradas ${comprasPrueba.length} compras de prueba:`);
    comprasPrueba.forEach(c => console.log(`   - ${c.codigo}: ${c.nombre}`));

    // Eliminar por IDs
    const ids = comprasPrueba.map(c => c.id);
    const { error: deleteError } = await supabase
      .from('compras_agiles')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`✅ Eliminadas ${comprasPrueba.length} compras de prueba`);

    // Contar después
    const { count: countAfter, error: countAfterError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countAfterError) {
      throw countAfterError;
    }

    console.log(`📊 Total de compras ágiles después: ${countAfter || 0}`);
    console.log(`\n✅ Proceso completado. Eliminadas: ${(countBefore || 0) - (countAfter || 0)} compras`);

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    console.error('Stack:', error.stack);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

eliminarComprasPrueba();