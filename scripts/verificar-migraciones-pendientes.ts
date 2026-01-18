#!/usr/bin/env deno run --allow-net --allow-env
/**
 * Script para verificar si las migraciones pendientes ya están aplicadas
 * Verifica si las tablas/funciones existen en Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurado');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verificarMigraciones() {
  console.log('🔍 Verificando migraciones pendientes...\n');

  // Verificar 20260116000004: tabla ordenes_compra
  console.log('📋 Verificando: 20260116000004_create_ordenes_compra.sql');
  const { data: ordenesTable, error: ordenesError } = await supabase
    .from('ordenes_compra')
    .select('id')
    .limit(1);
  
  if (ordenesError && ordenesError.code === '42P01') {
    console.log('   ❌ Tabla ordenes_compra NO existe\n');
  } else if (ordenesError) {
    console.log(`   ⚠️  Error al verificar: ${ordenesError.message}\n`);
  } else {
    console.log('   ✅ Tabla ordenes_compra existe\n');
  }

  // Verificar 20260117000000: columnas costo_neto y margen_comercial en inventory
  console.log('📋 Verificando: 20260117000000_add_costo_neto_margen_comercial_inventory.sql');
  const { data: inventoryCols, error: inventoryError } = await supabase.rpc('exec_sql', {
    sql_text: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory' 
      AND column_name IN ('costo_neto', 'margen_comercial')
      LIMIT 2;
    `
  }).catch(() => ({ data: null, error: { message: 'RPC no disponible' } }));

  // Verificar directamente con una query
  const { data: inventoryTest, error: invTestError } = await supabase
    .from('inventory')
    .select('costo_neto, margen_comercial')
    .limit(1);
  
  if (invTestError && invTestError.message.includes('column') && invTestError.message.includes('does not exist')) {
    console.log('   ❌ Columnas costo_neto/margen_comercial NO existen\n');
  } else if (invTestError) {
    console.log(`   ⚠️  Error al verificar: ${invTestError.message}\n`);
  } else {
    console.log('   ✅ Columnas costo_neto y margen_comercial existen\n');
  }

  // Verificar 20260117000001: función exec_sql
  console.log('📋 Verificando: 20260117000001_create_exec_sql_function.sql');
  const { data: execSqlTest, error: execSqlError } = await supabase.rpc('exec_sql', {
    sql_text: 'SELECT 1 as test;'
  });
  
  if (execSqlError && (execSqlError.message.includes('does not exist') || execSqlError.code === '42883')) {
    console.log('   ❌ Función exec_sql NO existe\n');
  } else if (execSqlError) {
    console.log(`   ⚠️  Error: ${execSqlError.message}\n`);
  } else {
    console.log('   ✅ Función exec_sql existe\n');
  }

  console.log('✅ Verificación completada');
}

verificarMigraciones().catch(console.error);
