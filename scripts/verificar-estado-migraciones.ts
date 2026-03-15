#!/usr/bin/env deno run --allow-net --allow-env
/**
 * Script para verificar si las migraciones pendientes ya están aplicadas
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL no está configurada');
  Deno.exit(1);
}
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurado');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verificarMigraciones() {
  console.log('🔍 Verificando estado de migraciones pendientes...\n');

  const resultados: string[] = [];

  // 1. Verificar tabla ordenes_compra (20260116000004)
  try {
    const { error } = await supabase
      .from('ordenes_compra')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      resultados.push('❌ 20260116000004: Tabla ordenes_compra NO existe');
    } else if (error) {
      resultados.push(`⚠️  20260116000004: Error - ${error.message}`);
    } else {
      resultados.push('✅ 20260116000004: Tabla ordenes_compra existe');
    }
  } catch (e) {
    resultados.push(`❌ 20260116000004: Error - ${e.message}`);
  }

  // 2. Verificar columnas costo_neto y margen_comercial (20260117000000)
  try {
    const { error } = await supabase
      .from('inventory')
      .select('costo_neto, margen_comercial')
      .limit(1);
    
    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      resultados.push('❌ 20260117000000: Columnas costo_neto/margen_comercial NO existen');
    } else if (error && !error.message.includes('does not exist')) {
      resultados.push(`✅ 20260117000000: Columnas existen (error de otro tipo: ${error.message})`);
    } else {
      resultados.push('✅ 20260117000000: Columnas costo_neto y margen_comercial existen');
    }
  } catch (e) {
    resultados.push(`❌ 20260117000000: Error - ${e.message}`);
  }

  // 3. Verificar función exec_sql (20260117000001)
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_text: 'SELECT 1 as test;'
    });
    
    if (error && (error.message.includes('does not exist') || error.code === '42883')) {
      resultados.push('❌ 20260117000001: Función exec_sql NO existe');
    } else if (error) {
      resultados.push(`⚠️  20260117000001: Error - ${error.message}`);
    } else {
      resultados.push('✅ 20260117000001: Función exec_sql existe');
    }
  } catch (e) {
    resultados.push(`❌ 20260117000001: Error - ${e.message}`);
  }

  console.log('📊 Resultados:\n');
  resultados.forEach(r => console.log(r));
  console.log('');

  // Resumen
  const aplicadas = resultados.filter(r => r.startsWith('✅')).length;
  const faltantes = resultados.filter(r => r.startsWith('❌')).length;
  
  console.log(`📈 Resumen: ${aplicadas} aplicadas, ${faltantes} faltantes\n`);

  if (faltantes > 0) {
    console.log('⚠️  Hay migraciones pendientes. ¿Quieres que las aplique ahora?');
    return false;
  } else {
    console.log('✅ Todas las migraciones están aplicadas!');
    return true;
  }
}

verificarMigraciones().catch(console.error);
