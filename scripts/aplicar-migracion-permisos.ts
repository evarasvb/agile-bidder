#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Script para aplicar la migración de permisos de roles
 * 
 * Uso:
 *   deno run --allow-net --allow-env --allow-read scripts/aplicar-migracion-permisos.ts
 * 
 * Requiere:
 *   - SUPABASE_URL en variables de entorno
 *   - SUPABASE_SERVICE_ROLE_KEY en variables de entorno
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readTextFile } from 'https://deno.land/std@0.208.0/fs/read_text_file.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL no está configurada');
  Deno.exit(1);
}
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.error('   Configúrala en tu archivo .env o como variable de entorno');
  Deno.exit(1);
}

async function aplicarMigracion() {
  console.log('🚀 Iniciando aplicación de migración de permisos...\n');

  try {
    // Leer el archivo de migración
    const migrationPath = './supabase/migrations/20260116000003_add_missing_sections_to_permissions.sql';
    console.log(`📄 Leyendo migración: ${migrationPath}`);
    
    let sql: string;
    try {
      sql = await readTextFile(migrationPath);
    } catch (error) {
      console.error(`❌ Error leyendo archivo de migración: ${error.message}`);
      console.error('   Asegúrate de ejecutar este script desde la raíz del proyecto');
      Deno.exit(1);
    }

    // Crear cliente de Supabase con service role (permisos completos)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔌 Conectando a Supabase...');
    
    // Dividir SQL en statements (separados por ;)
    // Filtrar comentarios y líneas vacías
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    console.log(`📝 Encontrados ${statements.length} statements SQL\n`);

    // Ejecutar cada statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Saltar statements vacíos o solo comentarios
      if (statement.trim().length <= 1) continue;

      try {
        console.log(`⏳ Ejecutando statement ${i + 1}/${statements.length}...`);
        
        // Usar rpc para ejecutar SQL (requiere función helper)
        // Alternativa: usar Management API directamente
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_text: statement 
        });

        if (error) {
          // Si exec_sql no existe, intentar método alternativo
          // Usar fetch directo a la API de Supabase
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql_text: statement }),
          });

          if (!response.ok) {
            // Si falla, mostrar el SQL para ejecución manual
            console.warn(`⚠️  No se pudo ejecutar automáticamente`);
            console.warn(`   Statement: ${statement.substring(0, 100)}...`);
            errorCount++;
            continue;
          }
        }

        successCount++;
        console.log(`✅ Statement ${i + 1} ejecutado correctamente\n`);
      } catch (err) {
        console.error(`❌ Error en statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Resumen:');
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log('='.repeat(50) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Algunos statements fallaron.');
      console.log('   Ejecuta el SQL manualmente en Supabase Dashboard → SQL Editor\n');
      console.log('SQL completo:');
      console.log('─'.repeat(50));
      console.log(sql);
      console.log('─'.repeat(50));
    } else {
      console.log('🎉 ¡Migración aplicada exitosamente!');
      console.log('   Los permisos de roles han sido actualizados.');
    }

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    Deno.exit(1);
  }
}

// Ejecutar
aplicarMigracion();
