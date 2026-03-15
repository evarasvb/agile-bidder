import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarLimpieza() {
  console.log('🔍 VERIFICANDO RESULTADO DE LA LIMPIEZA...\n');
  console.log('─'.repeat(80));

  try {
    // Contar total
    const { count: total, error: totalError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.warn('⚠️  Error al contar:', totalError.message);
    } else {
      console.log(`📊 Total de compras ágiles: ${total || 0}\n`);
    }

    // Verificar datos de prueba
    const { count: prueba, error: pruebaError } = await supabase
      .from('compras_agiles')
      .select('codigo', { count: 'exact', head: true })
      .ilike('codigo', 'CA-2025-%');

    if (!pruebaError) {
      if (prueba === 0) {
        console.log('✅ ¡Perfecto! No quedan datos de prueba (CA-2025-*)\n');
      } else {
        console.log(`⚠️  Aún quedan ${prueba} registros con códigos CA-2025-*\n`);
      }
    }

    // Ver últimas compras
    const { data: compras, error: comprasError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!comprasError && compras && compras.length > 0) {
      console.log('📋 Últimas compras en la BD:\n');
      compras.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.codigo} - ${c.nombre?.substring(0, 50)}...`);
      });
    } else if (total === 0) {
      console.log('📋 No hay compras ágiles en la base de datos.\n');
      console.log('💡 Esto es correcto si:');
      console.log('   - Se eliminaron todos los datos de prueba');
      console.log('   - El scraper aún no ha obtenido compras reales\n');
    }

    console.log('─'.repeat(80));
    console.log('\n✅ VERIFICACIÓN COMPLETADA\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
  }
}

verificarLimpieza();
