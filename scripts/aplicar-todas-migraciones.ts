#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * 🚀 SCRIPT MAESTRO PARA APLICAR TODAS LAS MIGRACIONES A SUPABASE
 * 
 * Este script lee todas las migraciones de supabase/migrations/ y las aplica
 * en orden cronológico a tu base de datos de Supabase.
 * 
 * Uso:
 *   deno run --allow-net --allow-env --allow-read scripts/aplicar-todas-migraciones.ts
 * 
 * Requiere:
 *   - SUPABASE_URL en variables de entorno o .env
 *   - SUPABASE_SERVICE_ROLE_KEY en variables de entorno o .env
 * 
 * El script:
 *   1. Lee todas las migraciones en orden
 *   2. Las ejecuta una por una
 *   3. Verifica que se aplicaron correctamente
 *   4. Muestra un resumen completo
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readTextFile, readDir } from 'https://deno.land/std@0.208.0/fs/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

// Cargar variables de entorno
async function loadEnv() {
  try {
    const envContent = await readTextFile('.env');
    const envVars: Record<string, string> = {};
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
    
    // Cargar en Deno.env
    for (const [key, value] of Object.entries(envVars)) {
      Deno.env.set(key, value);
    }
  } catch (error) {
    // .env no existe, usar variables de entorno del sistema
    log('⚠️  No se encontró archivo .env, usando variables de entorno del sistema', 'yellow');
  }
}

// Obtener todas las migraciones en orden
async function getMigrations(): Promise<string[]> {
  const migrationsDir = './supabase/migrations';
  const files: string[] = [];
  
  try {
    for await (const entry of readDir(migrationsDir)) {
      if (entry.isFile && entry.name.endsWith('.sql')) {
        files.push(entry.name);
      }
    }
  } catch (error) {
    log(`❌ Error leyendo directorio de migraciones: ${error.message}`, 'red');
    Deno.exit(1);
  }
  
  // Ordenar por nombre (que incluye timestamp)
  return files.sort();
}

// Ejecutar SQL usando Supabase Management API
async function executeSQL(
  supabaseUrl: string,
  serviceKey: string,
  sql: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Usar el endpoint de Management API de Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql_text: sql }),
    });

    if (!response.ok) {
      // Si exec_sql no existe, intentar método alternativo
      // Usar directamente el cliente de Supabase con query
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Dividir SQL en statements y ejecutar uno por uno
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Intentar ejecutar usando rpc
            const { error } = await supabase.rpc('exec_sql', { 
              sql_text: statement + ';' 
            });
            
            if (error) {
              // Si falla, retornar error
              return { 
                success: false, 
                error: `No se pudo ejecutar SQL. Error: ${error.message}. Necesitas ejecutar manualmente en Supabase Dashboard.` 
              };
            }
          } catch (err) {
            return { 
              success: false, 
              error: `Error ejecutando statement: ${err.message}` 
            };
          }
        }
      }

      return { success: true };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

// Función principal
async function main() {
  logSection('🚀 APLICADOR DE MIGRACIONES A SUPABASE');
  
  // Cargar variables de entorno
  await loadEnv();
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  if (!SUPABASE_URL) {
    log('❌ Error: SUPABASE_URL no está configurada', 'red');
    Deno.exit(1);
  }
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada', 'red');
    log('   Configúrala en tu archivo .env o como variable de entorno:', 'yellow');
    log('   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui', 'yellow');
    log('\n   Puedes obtenerla en: Supabase Dashboard → Settings → API → service_role key', 'yellow');
    Deno.exit(1);
  }

  log(`✅ Supabase URL: ${SUPABASE_URL}`, 'green');
  log(`✅ Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`, 'green');

  // Obtener todas las migraciones
  log('\n📂 Leyendo migraciones...', 'cyan');
  const migrationFiles = await getMigrations();
  log(`   Encontradas ${migrationFiles.length} migraciones\n`, 'green');

  // Mostrar lista de migraciones
  log('📋 Migraciones a aplicar:', 'cyan');
  migrationFiles.forEach((file, index) => {
    log(`   ${(index + 1).toString().padStart(3, ' ')}. ${file}`, 'blue');
  });

  // Confirmar
  log('\n⚠️  ¿Deseas continuar? (Ctrl+C para cancelar)', 'yellow');
  log('   Presiona Enter para continuar...', 'yellow');
  await new Promise(resolve => {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(1024);
    Deno.stdin.readSync(buffer);
    resolve(null);
  });

  // Crear cliente de Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Estadísticas
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ file: string; error: string }> = [];
  const sqlToExecute: Array<{ file: string; sql: string }> = [];

  logSection('📝 APLICANDO MIGRACIONES');

  // Procesar cada migración
  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = join('./supabase/migrations', file);
    
    log(`\n[${i + 1}/${migrationFiles.length}] Procesando: ${file}`, 'cyan');
    
    try {
      // Leer el archivo SQL
      const sql = await readTextFile(filePath);
      
      // Intentar ejecutar
      log('   ⏳ Ejecutando...', 'yellow');
      const result = await executeSQL(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, sql);
      
      if (result.success) {
        log(`   ✅ Migración aplicada exitosamente`, 'green');
        successCount++;
      } else {
        log(`   ⚠️  No se pudo ejecutar automáticamente: ${result.error}`, 'yellow');
        log(`   📋 Se agregará al SQL para ejecución manual`, 'yellow');
        sqlToExecute.push({ file, sql });
        errorCount++;
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
      errors.push({ file, error: error.message });
      errorCount++;
      
      // Intentar leer el SQL para ejecución manual
      try {
        const sql = await readTextFile(filePath);
        sqlToExecute.push({ file, sql });
      } catch (readError) {
        log(`   ❌ No se pudo leer el archivo para ejecución manual`, 'red');
      }
    }
  }

  // Resumen
  logSection('📊 RESUMEN');
  
  log(`✅ Migraciones exitosas: ${successCount}`, 'green');
  log(`❌ Migraciones con errores: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
  
  if (errors.length > 0) {
    log('\n❌ Errores encontrados:', 'red');
    errors.forEach(({ file, error }) => {
      log(`   - ${file}: ${error}`, 'red');
    });
  }

  // Si hay SQL para ejecutar manualmente
  if (sqlToExecute.length > 0) {
    logSection('📋 SQL PARA EJECUCIÓN MANUAL');
    
    log('Las siguientes migraciones necesitan ejecutarse manualmente:', 'yellow');
    log('1. Ve a Supabase Dashboard → SQL Editor', 'yellow');
    log('2. Copia y pega el SQL de cada migración', 'yellow');
    log('3. Ejecuta cada una en orden\n', 'yellow');

    // Crear archivo con todo el SQL
    const allSQL = sqlToExecute
      .map(({ file, sql }) => `-- ============================================\n-- ${file}\n-- ============================================\n\n${sql}\n`)
      .join('\n\n');

    const outputFile = './migraciones-pendientes.sql';
    await Deno.writeTextFile(outputFile, allSQL);
    log(`✅ SQL guardado en: ${outputFile}`, 'green');
    log(`   Puedes copiar este archivo y ejecutarlo en Supabase SQL Editor\n`, 'yellow');

    // Mostrar cada migración
    sqlToExecute.forEach(({ file, sql }, index) => {
      log(`\n--- Migración ${index + 1}: ${file} ---`, 'cyan');
      log(sql.substring(0, 500) + (sql.length > 500 ? '...' : ''), 'blue');
    });
  }

  // Verificación final
  if (errorCount === 0) {
    logSection('🎉 ¡TODAS LAS MIGRACIONES APLICADAS EXITOSAMENTE!');
    log('Tu base de datos está actualizada y lista para usar.', 'green');
  } else {
    logSection('⚠️  MIGRACIONES PENDIENTES');
    log('Algunas migraciones necesitan ejecutarse manualmente.', 'yellow');
    log('Revisa el archivo migraciones-pendientes.sql para más detalles.', 'yellow');
  }

  log('\n✨ Proceso completado.\n', 'cyan');
}

// Ejecutar
main().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red');
  console.error(error);
  Deno.exit(1);
});
