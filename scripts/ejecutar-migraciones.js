#!/usr/bin/env node
/**
 * Script para ejecutar migraciones SQL en Supabase automáticamente
 * Usa la Management API de Supabase
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Requeridas: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function ejecutarSQL(sql) {
  console.log('🚀 Intentando ejecutar migraciones...\n');
  
  try {
    // Intentar usar Management API de Supabase
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('No se pudo extraer project ref de SUPABASE_URL');
    }

    // Management API endpoint para ejecutar SQL
    const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    console.log(`📍 Proyecto: ${projectRef}`);
    console.log(`📋 Ejecutando SQL...\n`);

    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        query: sql,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Migraciones ejecutadas exitosamente!\n');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    return true;

  } catch (error) {
    console.error('❌ Error ejecutando SQL:', error.message);
    
    // Si falla, intentar método alternativo usando REST API
    console.log('\n⚠️  Intentando método alternativo...\n');
    
    try {
      // Usar REST API con rpc (si existe una función helper)
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Dividir SQL en comandos
      const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.match(/^\s*$/));

      console.log(`📝 Ejecutando ${commands.length} comandos...\n`);
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        try {
          // Intentar ejecutar usando rpc si existe función helper
          const { data, error } = await supabase.rpc('execute_sql_safe', { 
            sql_text: command + ';' 
          });
          
          if (error) {
            // Si no existe la función, no podemos ejecutar automáticamente
            if (error.code === '42883' || error.message?.includes('does not exist')) {
              throw new Error('FUNCION_NO_EXISTE');
            }
            throw error;
          }
          
          console.log(`✅ Comando ${i + 1}/${commands.length} ejecutado`);
          successCount++;
        } catch (cmdError) {
          if (cmdError.message === 'FUNCION_NO_EXISTE') {
            throw new Error('No se puede ejecutar automáticamente. Usa Supabase SQL Editor.');
          }
          console.error(`❌ Error en comando ${i + 1}:`, cmdError.message);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        console.log(`\n✅ Todas las migraciones aplicadas (${successCount} comandos)`);
        return true;
      } else {
        console.log(`\n⚠️  ${successCount} exitosos, ${errorCount} errores`);
        return false;
      }

    } catch (altError) {
      console.error('\n❌ No se pudo ejecutar automáticamente');
      console.error('   Razón:', altError.message);
      console.log('\n📝 INSTRUCCIONES MANUALES:');
      console.log('   1. Abre Supabase Dashboard → SQL Editor');
      console.log('   2. Copia el contenido de APLICAR_MIGRACIONES.sql');
      console.log('   3. Pega y ejecuta en Supabase SQL Editor');
      return false;
    }
  }
}

async function main() {
  const sqlPath = path.join(__dirname, '../APLICAR_MIGRACIONES.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Error: No se encuentra el archivo ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  const success = await ejecutarSQL(sql);
  
  if (success) {
    console.log('\n✅ ¡Migraciones aplicadas exitosamente!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Por favor, aplica las migraciones manualmente');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
