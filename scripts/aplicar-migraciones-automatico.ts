#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * 🚀 SCRIPT AUTOMÁTICO PARA APLICAR MIGRACIONES
 * 
 * Este script aplica todas las migraciones automáticamente usando
 * una Edge Function de Supabase que ejecuta SQL directamente.
 * 
 * Uso:
 *   deno run --allow-net --allow-env --allow-read scripts/aplicar-migraciones-automatico.ts
 * 
 * Requiere:
 *   - SUPABASE_URL en .env o variable de entorno
 *   - SUPABASE_SERVICE_ROLE_KEY en .env o variable de entorno
 *   - Edge Function "apply-migrations-auto" desplegada
 */

import { readTextFile, readDir } from 'https://deno.land/std@0.208.0/fs/mod.ts';
import { join } from 'https://deno.land/std@0.208.0/path/mod.ts';

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

// Cargar .env
async function loadEnv() {
  try {
    const envContent = await readTextFile('.env');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        Deno.env.set(key.trim(), value);
      }
    }
  } catch {
    // .env no existe, usar variables del sistema
  }
}

// Obtener migraciones
async function getMigrations(): Promise<string[]> {
  const migrationsDir = './supabase/migrations';
  const files: string[] = [];
  
  for await (const entry of readDir(migrationsDir)) {
    if (entry.isFile && entry.name.endsWith('.sql')) {
      files.push(entry.name);
    }
  }
  
  return files.sort();
}

// Aplicar migración usando Edge Function
async function applyMigration(
  supabaseUrl: string,
  serviceKey: string,
  migrationName: string,
  sql: string
): Promise<{ success: boolean; error?: string; results?: any }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/apply-migrations-auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        sql: sql,
        migration_name: migrationName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || `HTTP ${response.status}`,
        results: data.results,
      };
    }

    return {
      success: true,
      results: data.results,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Función principal
async function main() {
  logSection('🚀 APLICADOR AUTOMÁTICO DE MIGRACIONES');

  await loadEnv();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  if (!SUPABASE_URL) {
    log('❌ Error: SUPABASE_URL no está configurada', 'red');
    Deno.exit(1);
  }
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada', 'red');
    log('   Configúrala en .env o como variable de entorno', 'yellow');
    Deno.exit(1);
  }

  log(`✅ Supabase URL: ${SUPABASE_URL}`, 'green');
  log(`✅ Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`, 'green');

  // Obtener migraciones
  log('\n📂 Leyendo migraciones...', 'cyan');
  const migrationFiles = await getMigrations();
  log(`   Encontradas ${migrationFiles.length} migraciones\n`, 'green');

  // Mostrar lista
  log('📋 Migraciones a aplicar:', 'cyan');
  migrationFiles.forEach((file, index) => {
    log(`   ${(index + 1).toString().padStart(3, ' ')}. ${file}`, 'blue');
  });

  // Confirmar
  log('\n⚠️  ¿Deseas continuar? (Ctrl+C para cancelar)', 'yellow');
  log('   Presiona Enter para continuar...', 'yellow');
  await new Promise(resolve => {
    const buffer = new Uint8Array(1024);
    Deno.stdin.readSync(buffer);
    resolve(null);
  });

  // Estadísticas
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ file: string; error: string }> = [];

  logSection('📝 APLICANDO MIGRACIONES');

  // Procesar cada migración
  for (let i = 0; i < migrationFiles.length; i++) {
    const file = migrationFiles[i];
    const filePath = join('./supabase/migrations', file);
    
    log(`\n[${i + 1}/${migrationFiles.length}] ${file}`, 'cyan');
    
    try {
      const sql = await readTextFile(filePath);
      log('   ⏳ Ejecutando...', 'yellow');
      
      const result = await applyMigration(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, file, sql);
      
      if (result.success) {
        log(`   ✅ Migración aplicada exitosamente`, 'green');
        if (result.results) {
          const summary = result.results.reduce((acc: any, r: any) => {
            acc[r.success ? 'success' : 'errors'] = (acc[r.success ? 'success' : 'errors'] || 0) + 1;
            return acc;
          }, {});
          log(`   📊 ${summary.success || 0} statements exitosos, ${summary.errors || 0} errores`, 'blue');
        }
        successCount++;
      } else {
        log(`   ⚠️  ${result.error}`, 'yellow');
        log(`   📋 Ejecuta esta migración manualmente en Supabase Dashboard`, 'yellow');
        errors.push({ file, error: result.error || 'Error desconocido' });
        errorCount++;
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
      errors.push({ file, error: error.message });
      errorCount++;
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
    log('\n💡 Ejecuta las migraciones fallidas manualmente en Supabase Dashboard', 'yellow');
  }

  if (errorCount === 0) {
    logSection('🎉 ¡TODAS LAS MIGRACIONES APLICADAS EXITOSAMENTE!');
  }

  log('\n✨ Proceso completado.\n', 'cyan');
}

main().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red');
  console.error(error);
  Deno.exit(1);
});
