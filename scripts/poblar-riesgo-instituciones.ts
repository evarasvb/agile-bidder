/**
 * Script para poblar la tabla institucion_riesgo con datos de Mercado Público
 * 
 * Extrae información de riesgo de instituciones desde mercadopublico.cl:
 * - Días promedio de pago
 * - Cantidad de reclamos en últimos 12 meses
 * - Calcula nivel de riesgo (Bajo/Medio/Alto)
 * 
 * Fuente: Ficha de comprador en www.mercadopublico.cl
 * Frecuencia recomendada: Semanal o mensual
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface InstitucionRiesgo {
  institucion_codigo: string;
  dias_pago_promedio: number;
  reclamos_12m: number;
  nivel_riesgo: 'Bajo' | 'Medio' | 'Alto';
}

/**
 * Calcula el nivel de riesgo basado en días de pago y reclamos
 */
function calcularNivelRiesgo(
  diasPago: number,
  reclamos: number
): 'Bajo' | 'Medio' | 'Alto' {
  // Riesgo Alto: > 60 días de pago O > 10 reclamos
  if (diasPago > 60 || reclamos > 10) {
    return 'Alto';
  }
  
  // Riesgo Medio: 30-60 días de pago O 3-10 reclamos
  if ((diasPago >= 30 && diasPago <= 60) || (reclamos >= 3 && reclamos <= 10)) {
    return 'Medio';
  }
  
  // Riesgo Bajo: < 30 días de pago Y < 3 reclamos
  return 'Bajo';
}

/**
 * Obtiene datos de riesgo de una institución desde Mercado Público
 * TODO: Implementar scraping real de mercadopublico.cl
 */
async function obtenerDatosRiesgoInstitucion(
  codigoInstitucion: string
): Promise<InstitucionRiesgo | null> {
  try {
    // TODO: Implementar llamada a API o scraping
    // URL ejemplo: https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquirer.aspx?idBuyer=CODIGO
    
    // Por ahora retornamos datos de prueba
    console.log(`Obteniendo datos para institución: ${codigoInstitucion}`);
    
    // Simular datos (reemplazar con scraping real)
    const diasPago = Math.floor(Math.random() * 90);
    const reclamos = Math.floor(Math.random() * 15);
    
    return {
      institucion_codigo: codigoInstitucion,
      dias_pago_promedio: diasPago,
      reclamos_12m: reclamos,
      nivel_riesgo: calcularNivelRiesgo(diasPago, reclamos)
    };
  } catch (error) {
    console.error(`Error obteniendo datos de ${codigoInstitucion}:`, error);
    return null;
  }
}

/**
 * Obtiene todas las instituciones únicas de las tablas de oportunidades
 */
async function obtenerInstitucionesUnicas(): Promise<string[]> {
  try {
    // Obtener instituciones de compras_agiles
    const { data: compras } = await supabase
      .from('compras_agiles')
      .select('institucion_codigo')
      .not('institucion_codigo', 'is', null);
    
    // Obtener instituciones de licitaciones
    const { data: licitaciones } = await supabase
      .from('licitaciones')
      .select('codigo_organismo')
      .not('codigo_organismo', 'is', null);
    
    // Combinar y eliminar duplicados
    const institucionesSet = new Set<string>();
    
    compras?.forEach((c: any) => {
      if (c.institucion_codigo) institucionesSet.add(c.institucion_codigo);
    });
    
    licitaciones?.forEach((l: any) => {
      if (l.codigo_organismo) institucionesSet.add(l.codigo_organismo);
    });
    
    return Array.from(institucionesSet);
  } catch (error) {
    console.error('Error obteniendo instituciones:', error);
    return [];
  }
}

/**
 * Inserta o actualiza datos de riesgo en la tabla institucion_riesgo
 */
async function actualizarRiesgoInstitucion(
  datosRiesgo: InstitucionRiesgo
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('institucion_riesgo')
      .upsert({
        institucion_codigo: datosRiesgo.institucion_codigo,
        dias_pago_promedio: datosRiesgo.dias_pago_promedio,
        reclamos_12m: datosRiesgo.reclamos_12m,
        nivel_riesgo: datosRiesgo.nivel_riesgo,
      }, {
        onConflict: 'institucion_codigo'
      });
    
    if (error) {
      console.error('Error insertando/actualizando:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en actualizarRiesgoInstitucion:', error);
    return false;
  }
}

/**
 * Proceso principal
 */
async function main() {
  console.log('=== Iniciando actualización de datos de riesgo ===");
  
  // 1. Obtener todas las instituciones únicas
  console.log('Obteniendo instituciones únicas...');
  const instituciones = await obtenerInstitucionesUnicas();
  console.log(`Encontradas ${instituciones.length} instituciones`);
  
  // 2. Procesar cada institución
  let exitosos = 0;
  let fallidos = 0;
  
  for (const codigoInstitucion of instituciones) {
    console.log(`\nProcesando: ${codigoInstitucion}`);
    
    // Obtener datos de riesgo
    const datosRiesgo = await obtenerDatosRiesgoInstitucion(codigoInstitucion);
    
    if (datosRiesgo) {
      // Actualizar en base de datos
      const exito = await actualizarRiesgoInstitucion(datosRiesgo);
      
      if (exito) {
        exitosos++;
        console.log(`✓ ${codigoInstitucion}: ${datosRiesgo.nivel_riesgo} (${datosRiesgo.dias_pago_promedio} días, ${datosRiesgo.reclamos_12m} reclamos)`);
      } else {
        fallidos++;
        console.log(`✗ Error guardando ${codigoInstitucion}`);
      }
    } else {
      fallidos++;
      console.log(`✗ No se pudieron obtener datos de ${codigoInstitucion}`);
    }
    
    // Delay para no sobrecargar el servidor (si se usa scraping)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 3. Resumen
  console.log('\n=== Resumen ===");
  console.log(`Total instituciones: ${instituciones.length}`);
  console.log(`Exitosos: ${exitosos}`);
  console.log(`Fallidos: ${fallidos}`);
  console.log('\n=== Proceso completado ===");
}

// Ejecutar
main().catch(console.error);
