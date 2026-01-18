import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://euzqadopjvdszcdjegmo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ejecutarSQL(sql: string) {
  console.log('🔧 Ejecutando SQL...\n');
  console.log('─'.repeat(80));
  console.log(sql.substring(0, 200) + '...\n');
  console.log('─'.repeat(80));

  try {
    // Usar RPC si existe exec_sql, sino intentar con query directo
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // Si falla RPC, intentar método alternativo: ejecutar como DELETE directo
      if (sql.trim().toUpperCase().startsWith('DELETE')) {
        console.log('⚠️  RPC exec_sql no disponible, usando método alternativo...');
        
        // Extraer condiciones del DELETE
        const matches = sql.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(.+);?/i);
        if (matches) {
          const table = matches[1];
          const conditions = matches[2];
          
          // Simular el DELETE usando Supabase client
          // Primero obtener los IDs a eliminar
          const selectSQL = `SELECT id, codigo FROM ${table} WHERE ${conditions}`;
          console.log('Buscando registros a eliminar...');
          
          // Usar .from() con .delete() si es posible
          // Buscar compras con códigos de prueba usando múltiples queries
          const { data: compras1, error: e1 } = await supabase
            .from(table)
            .select('id, codigo')
            .like('codigo', 'CA-2025-%');
          
          const { data: compras2, error: e2 } = await supabase
            .from(table)
            .select('id, codigo')
            .like('codigo', 'CA-2024-%');
          
          const { data: compras3, error: e3 } = await supabase
            .from(table)
            .select('id, codigo')
            .like('codigo', 'TEST-%');
          
          const { data: compras4, error: e4 } = await supabase
            .from(table)
            .select('id, codigo')
            .like('codigo', 'PRUEBA-%');
          
          const selectError = e1 || e2 || e3 || e4;
          const compras = [...(compras1 || []), ...(compras2 || []), ...(compras3 || []), ...(compras4 || [])];
          
          if (selectError) {
            throw selectError;
          }
          
          if (compras && compras.length > 0) {
            console.log(`\n📊 Encontrados ${compras.length} registros a eliminar:`);
            compras.forEach((c: any) => {
              console.log(`   - ${c.codigo}`);
            });
            
            // Eliminar uno por uno usando .delete()
            const ids = compras.map((c: any) => c.id);
            const { error: deleteError } = await supabase
              .from(table)
              .delete()
              .in('id', ids);
            
            if (deleteError) {
              throw deleteError;
            }
            
            console.log(`\n✅ ${compras.length} registros eliminados exitosamente!`);
            return { success: true, deleted: compras.length };
          } else {
            console.log('\n✅ No se encontraron registros de prueba para eliminar.');
            return { success: true, deleted: 0 };
          }
        }
      }
      
      throw error;
    }

    console.log('\n✅ SQL ejecutado exitosamente!');
    return { success: true, data };
  } catch (error: any) {
    console.error('\n❌ Error al ejecutar SQL:', error.message || error);
    throw error;
  }
}

async function main() {
  const sqlFile = process.argv[2] || 'scripts/eliminar-compras-prueba-directo.sql';
  
  console.log('🚀 EJECUTANDO SCRIPT DE LIMPIEZA DE DATOS DE PRUEBA\n');
  console.log(`📄 Archivo SQL: ${sqlFile}\n`);

  try {
    const sql = readFileSync(sqlFile, 'utf-8');
    await ejecutarSQL(sql);

    // Verificar resultado
    console.log('\n\n🔍 VERIFICANDO RESULTADO...\n');
    const { count, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Total de compras ágiles después de limpieza: ${count || 0}`);

    // Verificar que no queden datos de prueba
    const { count: countPrueba, error: pruebaError } = await supabase
      .from('compras_agiles')
      .select('codigo', { count: 'exact', head: true })
      .or('codigo.like.CA-2025-%,codigo.like.CA-2024-%');

    if (!pruebaError) {
      if (countPrueba === 0) {
        console.log('✅ No quedan datos de prueba en la base de datos!');
      } else {
        console.log(`⚠️  Aún quedan ${countPrueba} registros con códigos de prueba`);
      }
    }

    console.log('\n✅ Proceso completado!');
  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message || error);
    process.exit(1);
  }
}

main();
