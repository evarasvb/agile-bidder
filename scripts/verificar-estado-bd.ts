import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://euzqadopjvdszcdjegmo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarEstadoBD() {
  console.log('🔍 VERIFICANDO ESTADO REAL DE LA BASE DE DATOS...\n');
  console.log('─'.repeat(80));

  try {
    // 1. Contar total
    const { count, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Total de compras ágiles: ${count || 0}\n`);

    // 2. Buscar datos de prueba
    const { data: datosPrueba, error: pruebaError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, created_at')
      .or('codigo.like.CA-2025-%,codigo.like.CA-2024-%,codigo.like.TEST-%')
      .order('created_at', { ascending: false });

    if (!pruebaError && datosPrueba && datosPrueba.length > 0) {
      console.log(`⚠️  DATOS DE PRUEBA ENCONTRADOS: ${datosPrueba.length}\n`);
      datosPrueba.forEach((compra, i) => {
        console.log(`   ${i + 1}. ${compra.codigo} - ${compra.nombre?.substring(0, 50)}...`);
        console.log(`      Creada: ${new Date(compra.created_at).toLocaleString('es-CL')}`);
      });
    } else {
      console.log(`✅ No hay datos de prueba en la base de datos\n`);
    }

    // 3. Ver últimas 10 compras
    const { data: ultimas, error: ultimasError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, nombre_organismo, monto_estimado, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!ultimasError && ultimas && ultimas.length > 0) {
      console.log(`\n📋 Últimas 10 compras ágiles:\n`);
      ultimas.forEach((compra, i) => {
        const org = (compra as any).nombre_organismo || (compra as any).organismo || 'N/A';
        const monto = (compra as any).monto_estimado || (compra as any).monto || null;
        console.log(`   ${i + 1}. ${compra.codigo}`);
        console.log(`      Nombre: ${compra.nombre?.substring(0, 60)}...`);
        console.log(`      Organismo: ${org}`);
        console.log(`      Monto: ${monto ? `$${Number(monto).toLocaleString('es-CL')}` : 'N/A'}`);
        console.log(`      Creada: ${new Date(compra.created_at).toLocaleString('es-CL')}`);
        console.log('');
      });
    }

    // 4. Verificar compras del scraper (códigos como 813-50-COT26)
    const { data: comprasReales, error: realesError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre, created_at')
      .not('codigo', 'like', 'CA-2025-%')
      .not('codigo', 'like', 'CA-2024-%')
      .not('codigo', 'like', 'TEST-%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!realesError && comprasReales && comprasReales.length > 0) {
      console.log(`\n✅ COMPRAS REALES DEL SCRAPER: ${comprasReales.length} (últimas 10)\n`);
      comprasReales.forEach((compra, i) => {
        console.log(`   ${i + 1}. ${compra.codigo} - ${compra.nombre?.substring(0, 50)}...`);
      });
    } else {
      console.log(`\n⚠️  No se encontraron compras reales del scraper\n`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
  }
}

verificarEstadoBD();
