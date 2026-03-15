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
  console.error('❌ Error: Falta variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarComprasReales() {
  console.log('🔍 Verificando compras ágiles reales en la base de datos...\n');

  try {
    // Contar total
    const { count, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Total de compras ágiles: ${count || 0}\n`);

    if (count === 0) {
      console.log('⚠️  No hay compras ágiles en la base de datos.');
      console.log('\n💡 Esto significa que:');
      console.log('   1. El scraper aún no ha sincronizado compras reales');
      console.log('   2. Las compras de prueba fueron eliminadas correctamente');
      console.log('   3. Necesitas ejecutar el scraper para obtener compras reales\n');
      return;
    }

    // Obtener compras de ejemplo
    const { data: compras, error: dataError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, organismo, monto, estado, fecha_cierre, created_at, datos_json')
      .order('created_at', { ascending: false })
      .limit(10);

    if (dataError) {
      throw dataError;
    }

    console.log('✅ Compras ágiles encontradas:\n');
    console.log('─'.repeat(100));

    compras?.forEach((compra, index) => {
      const org = (compra as any).nombre_organismo || compra.organismo || 'N/A';
      const monto = (compra as any).monto_estimado || compra.monto || null;
      
      console.log(`\n${index + 1}. Código: ${compra.codigo}`);
      console.log(`   Nombre: ${compra.nombre}`);
      console.log(`   Organismo: ${org}`);
      console.log(`   Monto: ${monto ? `$${Number(monto).toLocaleString('es-CL')}` : 'N/A'}`);
      console.log(`   Estado: ${compra.estado || 'N/A'}`);
      console.log(`   Fecha cierre: ${compra.fecha_cierre ? new Date(compra.fecha_cierre).toLocaleDateString('es-CL') : 'N/A'}`);
      console.log(`   Creada: ${new Date(compra.created_at).toLocaleString('es-CL')}`);
      if (compra.datos_json) {
        console.log(`   ✅ Tiene datos_json (datos completos del scraper)`);
      }
    });

    // Estadísticas
    const { data: todas, error: statsError } = await supabase
      .from('compras_agiles')
      .select('estado, match_encontrado, monto, monto_estimado');

    if (!statsError && todas) {
      const conMatch = todas.filter(c => c.match_encontrado).length;
      const activas = todas.filter(c => c.estado === 'activa').length;
      const montoTotal = todas.reduce((sum, c) => {
        const m = (c as any).monto_estimado || c.monto || 0;
        return sum + Number(m);
      }, 0);

      console.log('\n' + '─'.repeat(100));
      console.log('\n📈 Estadísticas:');
      console.log(`   Total: ${count}`);
      console.log(`   Con match: ${conMatch}`);
      console.log(`   Activas: ${activas}`);
      console.log(`   Monto total: $${montoTotal.toLocaleString('es-CL')}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    if (error.details) console.error('Details:', error.details);
  }
}

verificarComprasReales();
