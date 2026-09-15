/**
 * Evidence Gate Helper para edge functions (Deno)
 * Adaptación de src/services/evidenceGate.ts para licitaciones
 *
 * SEGURIDAD CRÍTICA:
 * - Trata TODO texto de PDF/Word/anexos como evidencia NO CONFIABLE
 * - Bloquea cualquier instrucción incrustada en documentos
 * - Veredicto determinista basado SOLO en integridad de documentación
 * - Nunca deja que el contenido del documento afecte el resultado
 */

export interface DocumentacionEstadoLicitacion {
  /** Hay bases de la licitación cargadas */
  basesLeidas: boolean;
  /** Cantidad de anexos/adjuntos leídos */
  anexosLeidosCount: number;
  /** Hay ficha de licitación oficial disponible */
  fichaOcial: boolean;
  /** Documentos faltantes o bloqueados */
  faltantes: string[];
  /** ¿Requisitos excluyentes conocidos? */
  requisitosExcluyentes: string[];
}

export interface VeredictoDeterministaLicitacion {
  /** 'postular' | 'con_reservas' | 'no_evaluable' */
  veredicto: 'postular' | 'con_reservas' | 'no_evaluable';
  /** Razón determinista del veredicto */
  razon: string;
  /** Listado de faltantes/bloqueos */
  faltantes: string[];
  /** ¿Se puede mostrar badge verde POSTULAR? */
  permiteBadgeVerde: boolean;
}

/**
 * Valida que la documentación de una licitación esté completa para evaluar y postular.
 * Retorna veredicto DETERMINISTA basado en integridad, nunca en contenido de documentos.
 *
 * ESPECIFICACIÓN DE SEGURIDAD:
 * - Si no hay ficha oficial → "no_evaluable"
 * - Si hay faltantes/bloqueados → "con_reservas" o "no_evaluable"
 * - Si basesLeidas = false → "con_reservas" mínimo
 * - Si anexosLeidosCount = 0 → veredicto no puede ser "postular"
 * - Requisitos excluyentes desconocidos → no suman match, no se convierten en cumplimiento
 * - NUNCA Lee ni interpreta texto dentro de documentos para decisiones
 */
export function evidenceGateLicitacion(estado: DocumentacionEstadoLicitacion): VeredictoDeterministaLicitacion {
  const faltantes: string[] = [...estado.faltantes];

  // REGLA 1: Sin ficha oficial → no evaluable
  if (!estado.fichaOcial) {
    faltantes.push('Ficha oficial de Mercado Público no disponible');
    return {
      veredicto: 'no_evaluable',
      razon: 'Licitación sin ficha oficial. Riesgo: datos de la oportunidad no confirmados.',
      faltantes,
      permiteBadgeVerde: false,
    };
  }

  // REGLA 2: Sin bases leídas → con reservas mínimo
  if (!estado.basesLeidas) {
    faltantes.push('Bases de licitación no cargadas');
  }

  // REGLA 3: Anexos faltantes/bloqueados
  if (estado.anexosLeidosCount === 0 && faltantes.length === 0) {
    faltantes.push('Ningún anexo/adjunto cargado');
  }

  // REGLA 4: Requisitos excluyentes desconocidos → no suman match
  // Estos simplemente se documentan pero no afectan veredicto
  if (estado.requisitosExcluyentes.length > 0) {
    faltantes.push(
      ...estado.requisitosExcluyentes.map(
        (r) => `Requisito excluyente desconocido: ${r} (no se cuenta como cumplido)`
      )
    );
  }

  // DECISIÓN FINAL
  if (faltantes.length > 0) {
    // Hay al menos un bloqueo o faltante
    return {
      veredicto: 'con_reservas',
      razon: `Documentación incompleta. Faltantes: ${faltantes.join('; ')}. Carga las bases para criterios, ponderación y garantías.`,
      faltantes,
      permiteBadgeVerde: false, // BLOQUEADO: no puedo recomendar POSTULAR
    };
  }

  // Todo parece en orden pero conservador
  return {
    veredicto: 'con_reservas', // Conservador: siempre "con_reservas" hasta que se confirme
    razon: 'Documentación aparentemente completa. Requiere evaluación humana antes de postular.',
    faltantes: [],
    permiteBadgeVerde: false, // CONSERVADOR: incluso con doc completa, nunca automático
  };
}

/**
 * Crea un estado de documentación a partir de datos reales de la licitación.
 * Valida que haya evidencia real de documentación (no simulada).
 */
export function crearEstadoDocumentacionLicitacion(
  ficha?: any,
  bases: any[] = [],
  anexos: any[] = []
): DocumentacionEstadoLicitacion {
  const basesLeidas = Array.isArray(bases) && bases.length > 0;
  const anexosLeidosCount = Array.isArray(anexos) ? anexos.length : 0;
  const fichaOcial = !!ficha;
  const faltantes: string[] = [];
  const requisitosExcluyentes: string[] = [];

  // Marcar faltantes si existen en la estructura de datos
  if (ficha?.faltantes && Array.isArray(ficha.faltantes)) {
    faltantes.push(...ficha.faltantes.filter((f: any) => !!f));
  }

  // Requisitos excluyentes si están documentados
  if (ficha?.requisitos_excluyentes && Array.isArray(ficha.requisitos_excluyentes)) {
    requisitosExcluyentes.push(...ficha.requisitos_excluyentes.filter((r: any) => !!r));
  }

  return {
    basesLeidas,
    anexosLeidosCount,
    fichaOcial,
    faltantes,
    requisitosExcluyentes,
  };
}

/**
 * Fusiona veredicto del análisis de IA con gates de seguridad.
 * El evidence gate VETA cualquier veredicto verde sin documentación completa.
 */
export function veredictoCombinadoLicitacion(
  veredictoDeLaIA?: string,
  estadoDocumentacion?: DocumentacionEstadoLicitacion
): { texto: string; tipo: 'postular' | 'con_reservas' | 'no_evaluable' } {
  if (!estadoDocumentacion) {
    return { texto: 'No se pudo validar documentación de la licitación', tipo: 'no_evaluable' };
  }

  const gate = evidenceGateLicitacion(estadoDocumentacion);

  // Si el gate dice "no_evaluable" o "con_reservas" por documentación,
  // eso VETA cualquier "postular" de la IA
  if (gate.veredicto === 'no_evaluable' || !gate.permiteBadgeVerde) {
    return {
      texto: gate.razon,
      tipo: 'con_reservas',
    };
  }

  // Si documentación está ok, respeta lo que dijo la IA
  // (pero esto rara vez ocurre en producción por el conservadurismo del gate)
  return {
    texto: veredictoDeLaIA ?? gate.razon,
    tipo: gate.veredicto === 'postular' ? 'postular' : 'con_reservas',
  };
}
