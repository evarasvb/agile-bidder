#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * 🚀 Script para ejecutar APLICAR_MIGRACIONES.sql automáticamente
 * 
 * Uso:
 *   deno run --allow-net --allow-env --allow-read scripts/ejecutar-migraciones-auto.ts
 * 
 * Requiere:
 *   - SUPABASE_URL en .env o variable de entorno
 *   - SUPABASE_SERVICE_ROLE_KEY en .env o variable de entorno
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readTextFile } from 'https://deno.land/std@0.208.0/fs/mod.ts';
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

// Cargar variables de entorno desde .env
async function loadEnv() {
  try {
    const envContent = await readTextFile('.env');
    const envVars: Record<string, string> = {};
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
          Deno.env.set(key.trim(), value);
        }
      }
    }
    log('✅ Variables de entorno cargadas desde .env', 'green');
  } catch (error) {
    log('⚠️  No se encontró .env, usando variables de entorno del sistema', 'yellow');
  }
}

// Ejecutar SQL usando Supabase directamente
async function executeSQL(
  supabase: any,
  sql: string
): Promise<{ success: boolean; error?: string; results?: any[] }> {
  try {
    // Dividir SQL en comandos individuales
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.match(/^\s*$/));

    log(`📝 Ejecutando ${commands.length} comandos SQL...`, 'cyan');
    
    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const commandPreview = command.substring(0, 60).replace(/\n/g, ' ') + '...';
      
      try {
        // Intentar ejecutar usando rpc si existe función helper
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_text: command + ';' 
          });
          
          if (error) {
            // Si la función no existe, intentar método alternativo
            if (error.code === '42883' || error.message?.includes('does not exist')) {
              throw new Error('FUNCION_NO_EXISTE');
            }
            throw error;
          }
          
          log(`   ✅ [${i + 1}/${commands.length}] ${commandPreview}`, 'green');
          results.push({ command: commandPreview, success: true });
          successCount++;
        } catch (rpcError: any) {
          if (rpcError.message === 'FUNCION_NO_EXISTE') {
            // Intentar ejecutar directamente usando query
            // Nota: Esto solo funciona para SELECT, no para DDL
            log(`   ⚠️  [${i + 1}/${commands.length}] No se puede ejecutar automáticamente: ${commandPreview}`, 'yellow');
            log(`      Necesitas ejecutar este comando manualmente en Supabase SQL Editor`, 'yellow');
            errorCount++;
            results.push({ 
              command: commandPreview, 
              success: false, 
              error: 'Función exec_sql no disponible. Ejecutar manualmente.' 
            });
          } else {
            throw rpcError;
          }
        }
      } catch (error: any) {
        log(`   ❌ [${i + 1}/${commands.length}] Error: ${error.message}`, 'red');
        errorCount++;
        results.push({ 
          command: commandPreview, 
          success: false, 
          error: error.message 
        });
      }
    }

    return {
      success: errorCount === 0,
      results,
      error: errorCount > 0 ? `${errorCount} comandos fallaron` : undefined
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función principal
async function main() {
  logSection('🚀 EJECUTAR MIGRACIONES AUTOMÁTICAMENTE');
  
  // Cargar variables de entorno
  await loadEnv();
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 
                       Deno.env.get('VITE_SUPABASE_URL') || 
                       'https://euzqadopjvdszcdjegmo.supabase.co';
  
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                                    Deno.env.get('SUPABASE_KEY');

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada', 'red');
    log('\n📋 Para configurarla:', 'yellow');
    log('   1. Abre Supabase Dashboard → Settings → API', 'yellow');
    log('   2. Busca "service_role" key (⚠️  es SECRET, no la anon key)', 'yellow');
    log('   3. Agrega en tu archivo .env:', 'yellow');
    log('      SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui', 'yellow');
    log('\n   O exporta la variable:', 'yellow');
    log('      export SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui', 'yellow');
    Deno.exit(1);
  }

  log(`✅ Supabase URL: ${SUPABASE_URL}`, 'green');
  log(`✅ Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`, 'green');

  // Crear cliente de Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Leer el archivo SQL
  log('\n📂 Leyendo APLICAR_MIGRACIONES.sql...', 'cyan');
  const sqlPath = join(Deno.cwd(), 'APLICAR_MIGRACIONES.sql');
  
  let sql: string;
  try {
    sql = await readTextFile(sqlPath);
    log(`✅ Archivo leído (${sql.length} caracteres)`, 'green');
  } catch (error) {
    log(`❌ Error leyendo archivo: ${error.message}`, 'red');
    log(`   Ruta esperada: ${sqlPath}`, 'yellow');
    Deno.exit(1);
  }

  // Ejecutar SQL
  logSection('📝 EJECUTANDO MIGRACIONES');
  
  const result = await executeSQL(supabase, sql);

  // Resumen
  logSection('📊 RESUMEN');
  
  if (result.success) {
    log('✅ ¡Todas las migraciones aplicadas exitosamente!', 'green');
    log('\n🎉 Tu base de datos está actualizada y lista para usar.', 'green');
  } else {
    log('⚠️  Algunas migraciones no se pudieron ejecutar automáticamente', 'yellow');
    log(`   Error: ${result.error}`, 'yellow');
    log('\n📋 INSTRUCCIONES MANUALES:', 'yellow');
    log('   1. Abre Supabase Dashboard → SQL Editor', 'yellow');
    log('   2. Copia el contenido de APLICAR_MIGRACIONES.sql', 'yellow');
    log('   3. Pega y ejecuta en Supabase SQL Editor', 'yellow');
    
    if (result.results) {
      const failed = result.results.filter(r => !r.success);
      if (failed.length > 0) {
        log(`\n   Comandos que fallaron: ${failed.length}`, 'red');
      }
    }
  }

  log('\n✨ Proceso completado.\n', 'cyan');
}

// Ejecutar
main().catch(error => {
  log(`\n❌ Error fatal: ${error.message}`, 'red');
  console.error(error);
  Deno.exit(1);
});
