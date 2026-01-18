import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://euzqadopjvdszcdjegmo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RevisionResult {
  seccion: string;
  estado: 'ok' | 'error' | 'advertencia';
  mensaje: string;
  detalles?: any;
}

const resultados: RevisionResult[] = [];

async function verificarBaseDatos(supabase: any) {
  console.log('\n📊 1. VERIFICANDO BASE DE DATOS...\n');
  console.log('─'.repeat(80));

  try {
    // Contar compras ágiles
    const { count, error: countError } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      resultados.push({
        seccion: 'Base de Datos - Contar Compras',
        estado: 'error',
        mensaje: `Error al contar: ${countError.message}`,
        detalles: countError
      });
      console.log('❌ Error al contar compras ágiles:', countError.message);
      return;
    }

    resultados.push({
      seccion: 'Base de Datos - Total Compras Ágiles',
      estado: count === 0 ? 'advertencia' : 'ok',
      mensaje: `Total: ${count || 0} compras ágiles`,
      detalles: { count }
    });
    console.log(`✅ Total de compras ágiles: ${count || 0}`);

    if (count === 0) {
      console.log('⚠️  No hay compras ágiles en la base de datos');
    } else {
      // Obtener estadísticas
      const { data: todas, error: statsError } = await supabase
        .from('compras_agiles')
        .select('codigo, estado, match_encontrado, created_at, monto, monto_estimado');

      if (!statsError && todas) {
        const conMatch = todas.filter(c => c.match_encontrado).length;
        const activas = todas.filter(c => c.estado === 'activa').length;
        const recientes24h = todas.filter(c => {
          const creada = new Date(c.created_at);
          const ahora = new Date();
          return (ahora.getTime() - creada.getTime()) < 24 * 60 * 60 * 1000;
        }).length;

        resultados.push({
          seccion: 'Base de Datos - Estadísticas',
          estado: 'ok',
          mensaje: `Con match: ${conMatch}, Activas: ${activas}, Recientes (24h): ${recientes24h}`,
          detalles: { conMatch, activas, recientes24h }
        });

        console.log(`   - Con match: ${conMatch}`);
        console.log(`   - Activas: ${activas}`);
        console.log(`   - Recientes (24h): ${recientes24h}`);

        // Verificar códigos de prueba
        const codigosPrueba = todas.filter(c => 
          c.codigo?.startsWith('CA-2025-') || 
          c.codigo?.startsWith('TEST-') ||
          c.codigo?.toLowerCase().includes('test') ||
          c.codigo?.toLowerCase().includes('prueba')
        ).length;

        if (codigosPrueba > 0) {
          resultados.push({
            seccion: 'Base de Datos - Datos de Prueba',
            estado: 'advertencia',
            mensaje: `Se encontraron ${codigosPrueba} compras con códigos de prueba`,
            detalles: { codigosPrueba }
          });
          console.log(`⚠️  Compras con códigos de prueba: ${codigosPrueba}`);
        } else {
          resultados.push({
            seccion: 'Base de Datos - Datos de Prueba',
            estado: 'ok',
            mensaje: 'No se encontraron datos de prueba',
            detalles: { codigosPrueba: 0 }
          });
          console.log(`✅ No hay datos de prueba`);
        }

        // Últimas 5 compras
        const { data: ultimas, error: ultimasError } = await supabase
          .from('compras_agiles')
          .select('codigo, nombre, created_at')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!ultimasError && ultimas && ultimas.length > 0) {
          console.log('\n   Últimas 5 compras:');
          ultimas.forEach((c: any, i: number) => {
            const fecha = new Date(c.created_at).toLocaleString('es-CL');
            console.log(`   ${i + 1}. ${c.codigo} - ${c.nombre?.substring(0, 50)}... (${fecha})`);
          });
        }
      }
    }
  } catch (error: any) {
    resultados.push({
      seccion: 'Base de Datos - General',
      estado: 'error',
      mensaje: `Error inesperado: ${error.message}`,
      detalles: error
    });
    console.error('❌ Error:', error.message);
  }
}

async function verificarConfiguracion() {
  console.log('\n\n⚙️  2. VERIFICANDO CONFIGURACIÓN...\n');
  console.log('─'.repeat(80));

  const configs = {
    'SUPABASE_URL': supabaseUrl,
    'SUPABASE_SERVICE_ROLE_KEY': supabaseServiceKey ? '✅ Configurada' : '❌ No configurada',
  };

  let todasOk = true;
  for (const [key, value] of Object.entries(configs)) {
    const ok = key === 'SUPABASE_SERVICE_ROLE_KEY' ? supabaseServiceKey : value;
    const estado = ok ? 'ok' : 'error';
    if (!ok) todasOk = false;

    resultados.push({
      seccion: `Configuración - ${key}`,
      estado: ok ? 'ok' : 'error',
      mensaje: `${key}: ${value === supabaseUrl ? '✅ Configurada' : value}`,
      detalles: { key, tieneValor: !!ok }
    });

    console.log(`${ok ? '✅' : '❌'} ${key}: ${value === supabaseUrl ? 'Configurada' : value}`);
  }

  // Verificar archivos del scraper
  const scraperPath = '/Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper';
  const scraperExists = fs.existsSync(`${scraperPath}/scraper.js`);
  const packageJsonExists = fs.existsSync(`${scraperPath}/package.json`);
  const envExists = fs.existsSync(`${scraperPath}/.env`);

  resultados.push({
    seccion: 'Configuración - Archivos Scraper',
    estado: scraperExists && packageJsonExists ? 'ok' : 'advertencia',
    mensaje: `scraper.js: ${scraperExists ? '✅' : '❌'}, package.json: ${packageJsonExists ? '✅' : '❌'}, .env: ${envExists ? '✅' : '⚠️'}`,
    detalles: { scraperExists, packageJsonExists, envExists }
  });

  console.log(`\n📁 Archivos del scraper:`);
  console.log(`   ${scraperExists ? '✅' : '❌'} scraper.js`);
  console.log(`   ${packageJsonExists ? '✅' : '❌'} package.json`);
  console.log(`   ${envExists ? '✅' : '⚠️'} .env ${envExists ? '' : '(recomendado)'}`);
}

async function verificarMigraciones(supabase: any) {
  console.log('\n\n📋 3. VERIFICANDO MIGRACIONES...\n');
  console.log('─'.repeat(80));

  try {
    // Verificar estructura de compras_agiles
    const { data: columnas, error: columnasError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'compras_agiles'
          ORDER BY ordinal_position;
        `
      });

    if (!columnasError) {
      const columnasEsperadas = ['codigo', 'nombre', 'organismo', 'monto', 'fecha_cierre', 'estado', 'match_encontrado', 'datos_json'];
      const columnasExistentes = Array.isArray(columnas) ? columnas.map((c: any) => c.column_name) : [];

      const faltantes = columnasEsperadas.filter(c => !columnasExistentes.includes(c));
      
      resultados.push({
        seccion: 'Migraciones - Estructura Tabla',
        estado: faltantes.length === 0 ? 'ok' : 'error',
        mensaje: faltantes.length === 0 
          ? `✅ Todas las columnas esperadas existen (${columnasEsperadas.length})`
          : `❌ Faltan columnas: ${faltantes.join(', ')}`,
        detalles: { columnasEsperadas, columnasExistentes, faltantes }
      });

      console.log(`✅ Columnas en compras_agiles: ${columnasExistentes.length}`);
      if (faltantes.length > 0) {
        console.log(`   ⚠️  Faltan: ${faltantes.join(', ')}`);
      }
    } else {
      // Fallback: verificar tabla directamente
      const { error: testError } = await supabase
        .from('compras_agiles')
        .select('codigo')
        .limit(1);

      if (!testError) {
        resultados.push({
          seccion: 'Migraciones - Estructura Tabla',
          estado: 'ok',
          mensaje: '✅ Tabla compras_agiles existe y es accesible',
          detalles: {}
        });
        console.log('✅ Tabla compras_agiles existe y es accesible');
      } else {
        resultados.push({
          seccion: 'Migraciones - Estructura Tabla',
          estado: 'error',
          mensaje: `❌ Error al acceder a la tabla: ${testError.message}`,
          detalles: { error: testError.message }
        });
        console.log('❌ Error al acceder a la tabla:', testError.message);
      }
    }
  } catch (error: any) {
    resultados.push({
      seccion: 'Migraciones - General',
      estado: 'error',
      mensaje: `Error: ${error.message}`,
      detalles: error
    });
    console.error('❌ Error:', error.message);
  }
}

async function generarReporte() {
  console.log('\n\n📊 RESUMEN DE REVISIÓN COMPLETA\n');
  console.log('═'.repeat(80));
  
  const ok = resultados.filter(r => r.estado === 'ok').length;
  const advertencias = resultados.filter(r => r.estado === 'advertencia').length;
  const errores = resultados.filter(r => r.estado === 'error').length;

  console.log(`✅ Correctos: ${ok}`);
  console.log(`⚠️  Advertencias: ${advertencias}`);
  console.log(`❌ Errores: ${errores}`);
  console.log('\n' + '─'.repeat(80) + '\n');

  // Guardar reporte JSON
  const reporte = {
    fecha: new Date().toISOString(),
    resumen: { ok, advertencias, errores, total: resultados.length },
    resultados
  };

  const reportePath = 'scripts/revision-completa-reporte.json';
  fs.writeFileSync(reportePath, JSON.stringify(reporte, null, 2));
  console.log(`📄 Reporte guardado en: ${reportePath}`);

  // Mostrar errores y advertencias
  if (errores > 0) {
    console.log('\n❌ ERRORES ENCONTRADOS:');
    resultados.filter(r => r.estado === 'error').forEach(r => {
      console.log(`   - ${r.seccion}: ${r.mensaje}`);
    });
  }

  if (advertencias > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    resultados.filter(r => r.estado === 'advertencia').forEach(r => {
      console.log(`   - ${r.seccion}: ${r.mensaje}`);
    });
  }

  if (ok === resultados.length) {
    console.log('\n✅ ¡Sistema en buen estado!');
  }
}

async function revisionCompleta() {
  console.log('🔍 REVISIÓN COMPLETA DEL SISTEMA');
  console.log('═'.repeat(80));
  console.log(`Fecha: ${new Date().toLocaleString('es-CL')}`);

  if (!supabaseServiceKey) {
    console.error('\n❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada');
    console.log('Por favor, configura la variable de entorno en .env o .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await verificarBaseDatos(supabase);
  await verificarConfiguracion();
  await verificarMigraciones(supabase);
  await generarReporte();
}

revisionCompleta().catch((error) => {
  console.error('\n❌ Error fatal en la revisión:', error);
  process.exit(1);
});
