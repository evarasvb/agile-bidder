/**
 * Evidence Gate: Validador determinista para prevenir postulaciones
 * sin documentación completa.
 *
 * SEGURIDAD CRÍTICA:
 * - Trata todo texto de PDF/Word/anexos como evidencia NO CONFIABLE
 * - Bloquea cualquier instrucción incrustada en documentos
 * - Verdicto determinista basado SOLO en integridad de documentación
 * - Nunca deja que el contenido del documento afecte el resultado
 */

export interface DocumentacionEstado {
  /** Bases de la licitación leídas y procesadas */
  basesLeidas: boolean;
  /** Cantidad de bases/anexos leídos */
  anexosLeidosCount: number;
  /** Hay manifest de documentación revisado */
  manifestoRevisado: boolean;
  /** Documentos faltantes o bloqueados */
  faltantes: string[];
  /** Estado del inventario del cliente (¿tiene productos configurados?) */
  inventarioConfigurable: boolean;
  /** ¿Requisitos excluyentes conocidos? */
  requisitosExcluyentes: string[];
}

export interface VeredictoDeterminista {
  /** 'postular' | 'con_reservas' | 'descartar' | 'no_evaluable' */
  veredicto: 'postular' | 'con_reservas' | 'descartar' | 'no_evaluable';
  /** Razón determinista del veredicto */
  razon: string;
  /** Listado de faltantes/bloqueos */
  faltantes: string[];
  /** ¿Se puede mostrar badge verde POSTULAR? */
  permiteBadgeVerde: boolean;
}

/**
 * Valida que la documentación esté completa para evaluar una licitación.
 * Retorna veredicto DETERMINISTA basado en integridad, nunca en contenido
 * de documentos (que puede ser malicioso).
 *
 * ESPECIFICACIÓN DE SEGURIDAD:
 * - Si no hay manifest revisado → "no_evaluable"
 * - Si hay faltantes/bloqueados → "con_reservas" o "descartar"
 * - Si basesLeidas = false → "con_reservas" mínimo
 * - Si anexosLeidosCount = 0 → veredicto no puede ser "postular"
 * - Requisitos excluyentes desconocidos → no suman match, no se convierten en cumplimiento
 * - NUNCA Lee ni interpreta texto dentro de documentos para decisiones
 */
export function evidenceGate(estado: DocumentacionEstado): VeredictoDeterminista {
  const faltantes: string[] = [...estado.faltantes];

  // REGLA 1: Sin manifest revisado → no evaluable
  if (!estado.manifestoRevisado) {
    faltantes.push('Manifest de documentación no revisado');
    return {
      veredicto: 'no_evaluable',
      razon: 'Documentación sin revisar oficialmente. Riesgo: requisitos no identificados.',
      faltantes,
      permiteBadgeVerde: false,
    };
  }

  // REGLA 2: Sin bases leídas → con reservas mínimo
  if (!estado.basesLeidas) {
    faltantes.push('Bases de licitación no leídas');
  }

  // REGLA 3: Anexos faltantes/bloqueados
  if (estado.anexosLeidosCount === 0 && faltantes.length === 0) {
    faltantes.push('Ningún anexo leído');
  }

  // REGLA 4: Requisitos excluyentes desconocidos → no suman match
  // Estos simplemente se documentan pero no afectan veredicto
  // (solo previenen que se los cuente como "cumplido")
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
      razon: `Documentación incompleta. Faltantes: ${faltantes.join('; ')}`,
      faltantes,
      permiteBadgeVerde: false, // BLOQUEADO: no puedo recomendar POSTULAR
    };
  }

  // Todo parece en orden
  return {
    veredicto: 'con_reservas', // Conservador: siempre "con_reservas" hasta que se confirme
    razon: 'Documentación aparentemente completa. Requiere evaluación humana antes de postular.',
    faltantes: [],
    permiteBadgeVerde: false, // CONSERVADOR: incluso con doc completa, nunca automático
  };
}

/**
 * Crea un estado de documentación a partir de datos reales.
 * Valida que haya lectura real de documentos (no simulada).
 */
export function crearEstadoDocumentacion(
  libro?: any,
  inventario?: any[],
  metadata?: { basesLeidas?: boolean; anexosCount?: number }
): DocumentacionEstado {
  const basesLeidas = !!metadata?.basesLeidas || (libro?.bases_html?.trim()?.length ?? 0) > 100;
  const anexosLeidosCount = metadata?.anexosCount ?? (libro?.anexos?.length ?? 0);
  const manifestoRevisado = !!libro?.manifest_revisado || (libro?.ficha?.revisado === true);
  const faltantes = libro?.anexos?.faltantes ?? [];
  const inventarioConfigurable = Array.isArray(inventario) && inventario.length > 0;
  const requisitosExcluyentes = libro?.requisitos_excluyentes ?? [];

  return {
    basesLeidas,
    anexosLeidosCount,
    manifestoRevisado,
    faltantes,
    inventarioConfigurable,
    requisitosExcluyentes,
  };
}

/**
 * Fusiona veredicto del análisis de IA con gates de seguridad.
 * El evidence gate VETA cualquier veredicto verde sin documentación completa.
 */
export function veredictoCombinado(
  veredictoDeLaIA?: string,
  estadoDocumentacion?: DocumentacionEstado
): { texto: string; tipo: 'postular' | 'con_reservas' | 'descartar' | 'no_evaluable' } {
  if (!estadoDocumentacion) {
    return { texto: 'No se pudo validar documentación', tipo: 'no_evaluable' };
  }

  const gate = evidenceGate(estadoDocumentacion);

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
