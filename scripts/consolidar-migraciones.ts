#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * 📦 CONSOLIDADOR DE MIGRACIONES
 * 
 * Este script consolida todas las migraciones en un solo archivo SQL
 * que puedes ejecutar directamente en Supabase Dashboard → SQL Editor
 * 
 * Uso:
 *   deno run --allow-read --allow-write scripts/consolidar-migraciones.ts
 * 
 * Genera:
 *   - TODAS-LAS-MIGRACIONES.sql (archivo consolidado)
 */

import { readTextFile, readDir } from 'https://deno.land/std@0.208.0/fs/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

async function main() {
  console.log('📦 Consolidando migraciones...\n');

  const migrationsDir = './supabase/migrations';
  const files: string[] = [];
  
  // Leer todos los archivos SQL
  try {
    for await (const entry of readDir(migrationsDir)) {
      if (entry.isFile && entry.name.endsWith('.sql')) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    console.error(`❌ Error leyendo directorio: ${error.message}`);
    Deno.exit(1);
  }
  
  // Ordenar por nombre
  files.sort();
  
  console.log(`✅ Encontradas ${files.length} migraciones\n`);

  // Consolidar todas las migraciones
  let consolidatedSQL = `-- ============================================
-- MIGRACIONES CONSOLIDADAS PARA SUPABASE
-- ============================================
-- Este archivo contiene TODAS las migraciones del proyecto
-- Ejecuta este SQL completo en Supabase Dashboard → SQL Editor
-- 
-- Total de migraciones: ${files.length}
-- Generado: ${new Date().toISOString()}
-- ============================================

`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = join(migrationsDir, file);
    
    console.log(`📄 [${i + 1}/${files.length}] Procesando: ${file}`);
    
    try {
      const sql = await readTextFile(filePath);
      
      consolidatedSQL += `\n\n-- ============================================
-- MIGRACIÓN ${i + 1}/${files.length}: ${file}
-- ============================================

${sql}

`;
    } catch (error) {
      console.error(`   ❌ Error leyendo ${file}: ${error.message}`);
    }
  }

  // Guardar archivo consolidado
  const outputFile = './TODAS-LAS-MIGRACIONES.sql';
  await Deno.writeTextFile(outputFile, consolidatedSQL);
  
  console.log(`\n✅ Archivo consolidado creado: ${outputFile}`);
  console.log(`\n📋 Próximos pasos:`);
  console.log(`   1. Ve a Supabase Dashboard → SQL Editor`);
  console.log(`   2. Abre el archivo: ${outputFile}`);
  console.log(`   3. Copia todo el contenido`);
  console.log(`   4. Pégalo en SQL Editor`);
  console.log(`   5. Haz clic en "Run" o presiona Ctrl+Enter`);
  console.log(`\n✨ ¡Listo!\n`);
}

main().catch(error => {
  console.error(`\n❌ Error: ${error.message}`);
  Deno.exit(1);
});
