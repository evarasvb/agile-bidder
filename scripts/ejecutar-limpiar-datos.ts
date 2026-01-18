/**
 * Script para ejecutar la limpieza de datos de prueba
 * Llama a la Edge Function que elimina los datos automáticamente
 */

const SUPABASE_URL = 'https://euzqadopjvdszcdjegmo.supabase.co';

async function limpiarDatosPrueba() {
  console.log('🧹 LIMPIANDO DATOS DE PRUEBA...\n');
  console.log('─'.repeat(80));

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/limpiar-datos-prueba`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al ejecutar limpieza');
    }

    const result = await response.json();
    
    console.log(`✅ ${result.mensaje || 'Limpieza completada'}`);
    console.log(`📊 Total de compras restantes: ${result.totalRestante || 0}\n`);
    console.log('─'.repeat(80));
    console.log('\n✅ PROCESO COMPLETADO!');
    console.log('\n💡 Ahora solo necesitas:');
    console.log('   1. Hacer commit y push de los cambios');
    console.log('   2. Publicar en Lovable');
    console.log('   3. Refrescar firmavb.cl\n');

    return result;
  } catch (error: any) {
    console.error('\n❌ Error:', error.message || error);
    console.log('\n⚠️  SOLUCIÓN ALTERNATIVA:');
    console.log('   Ejecuta el SQL manualmente en Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql\n');
    process.exit(1);
  }
}

limpiarDatosPrueba();
