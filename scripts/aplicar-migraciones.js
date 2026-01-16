#!/usr/bin/env node
/**
 * Script para aplicar migraciones SQL automáticamente en Supabase
 * 
 * Uso:
 *   node scripts/aplicar-migraciones.js
 * 
 * Requiere:
 *   - SUPABASE_URL en .env
 *   - SUPABASE_SERVICE_ROLE_KEY en .env
 */

const fs = require('fs');
const path = require('path');

// Leer variables de entorno
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Requeridas: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  console.error('   O: VITE_SUPABASE_URL y SUPABASE_KEY');
  process.exit(1);
}

async function aplicarMigracion(sqlContent, nombre) {
  console.log(`\n📋 Aplicando migración: ${nombre}...`);
  
  try {
    // Usar la API REST de Supabase para ejecutar SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: sqlContent }),
    });

    if (!response.ok) {
      // Si no existe la función exec_sql, intentar método alternativo
      console.log('⚠️  Método directo no disponible, usando método alternativo...');
      throw new Error('MÉTODO_ALTERNATIVO');
    }

    const result = await response.json();
    console.log(`✅ Migración ${nombre} aplicada exitosamente`);
    return true;
  } catch (error) {
    if (error.message === 'MÉTODO_ALTERNATIVO') {
      // Método alternativo: usar pg_rest o psql si está disponible
      console.log('📝 Instrucciones manuales:');
      console.log('   1. Abre Supabase Dashboard → SQL Editor');
      console.log('   2. Copia el contenido de APLICAR_MIGRACIONES.sql');
      console.log('   3. Pega y ejecuta en el SQL Editor');
      return false;
    }
    console.error(`❌ Error aplicando migración ${nombre}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando aplicación de migraciones...\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL?.substring(0, 30)}...`);

  // Leer el archivo SQL completo
  const sqlPath = path.join(__dirname, '../APLICAR_MIGRACIONES.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Error: No se encuentra el archivo ${sqlPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Intentar aplicar
  const success = await aplicarMigracion(sqlContent, 'Todas las migraciones');

  if (success) {
    console.log('\n✅ ¡Todas las migraciones aplicadas exitosamente!');
    console.log('\n📊 Verificar:');
    console.log('   - Ejecuta: SELECT * FROM estadisticas_compras_agiles();');
    console.log('   - Verifica tablas: ordenes_compra, orden_compra_items');
  } else {
    console.log('\n⚠️  No se pudo aplicar automáticamente.');
    console.log('   Por favor, aplica manualmente siguiendo las instrucciones.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
