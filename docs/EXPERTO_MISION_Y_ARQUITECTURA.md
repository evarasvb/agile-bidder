# Experto FirmaVB: misión, contrato y arquitectura objetivo

Relacionado con [#269](https://github.com/evarasvb/agile-bidder/issues/269).

## Misión

El Experto transforma datos y documentos de Mercado Público en decisiones comerciales seguras, rentables y ejecutables. No es un resumidor ni un buscador: reúne evidencia, detecta vacíos y contradicciones, cruza procesos, evalúa la capacidad real de la empresa y propone acciones.

## Principios no negociables

1. **Evidencia antes que elocuencia.** Toda afirmación material debe apuntar a una fuente identificable.
2. **Completitud explícita.** Si faltan bases, anexos, modificaciones o ítems, el Experto debe declarar la limitación.
3. **Hecho, inferencia y recomendación separados.** Nunca presentar una inferencia como dato oficial.
4. **Decisión estructurada.** La UI no debe inferir el veredicto buscando palabras dentro de prosa.
5. **Acción con control humano.** El Experto puede preparar; precios, declaraciones, presentación y compromisos requieren confirmación.
6. **Una sola identidad por entidad.** Institución, unidad, proveedor, proceso y producto deben resolverse antes de cruzar fuentes.
7. **Aprendizaje verificable.** Cada recomendación debe poder contrastarse con el resultado real.

## Expediente canónico

Cada proceso debe materializar un expediente versionado:

- ficha electrónica y estado;
- ítems;
- bases administrativas y técnicas;
- anexos;
- preguntas, respuestas y aclaraciones;
- modificaciones y resoluciones;
- organismo y unidad compradora;
- adjudicaciones;
- órdenes de compra;
- Compras Ágiles y otros procesos relacionados;
- reclamos y conducta de pago;
- noticias y señales externas;
- inventario, documentos y capacidades de la empresa;
- historial de análisis y decisiones.

### Estado de completitud mínimo

```ts
export type NivelCompletitud = 'insuficiente' | 'parcial' | 'suficiente' | 'verificado';

export interface CompletitudExpediente {
  nivel: NivelCompletitud;
  porcentaje: number;
  ficha: EstadoFuente;
  items: EstadoFuente;
  bases: EstadoFuente;
  anexos: EstadoFuente;
  aclaraciones: EstadoFuente;
  modificaciones: EstadoFuente;
  historial: EstadoFuente;
  actualizadoEn: string;
  faltantesCriticos: string[];
  advertencias: string[];
}

export interface EstadoFuente {
  estado: 'faltante' | 'pendiente' | 'parcial' | 'completa' | 'bloqueada';
  fuente?: string;
  version?: string;
  obtenidoEn?: string;
}
```

Un expediente `insuficiente` o `parcial` no puede producir un veredicto definitivo sin mostrar la limitación.

## Contrato de decisión

```ts
export type DecisionExperto =
  | 'participar'
  | 'participar_con_reservas'
  | 'estudiar'
  | 'asociarse'
  | 'descartar';

export interface EvaluacionExperto {
  version: string;
  codigoProceso: string;
  decision: DecisionExperto;
  confianza: number;
  resumenEjecutivo: string;
  completitud: CompletitudExpediente;
  dimensiones: {
    compatibilidadComercial: Dimension;
    cumplimientoDocumental: Dimension;
    rentabilidad: Dimension;
    caja: Dimension;
    riesgoContractual: Dimension;
    capacidadOperacional: Dimension;
    competencia: Dimension;
  };
  bloqueadores: Hallazgo[];
  oportunidades: Hallazgo[];
  contradicciones: Hallazgo[];
  procesosRelacionados: ProcesoRelacionado[];
  acciones: AccionExperta[];
  generadoEn: string;
}

export interface Dimension {
  puntaje: number;
  nivel: 'bajo' | 'medio' | 'alto';
  explicacion: string;
  evidencia: Cita[];
}

export interface Hallazgo {
  tipo: 'hecho' | 'inferencia' | 'riesgo' | 'oportunidad';
  severidad: 'informativa' | 'media' | 'alta' | 'critica';
  titulo: string;
  detalle: string;
  evidencia: Cita[];
}

export interface Cita {
  fuenteId: string;
  documento: string;
  pagina?: number;
  seccion?: string;
  fragmento: string;
  url?: string;
  hashVersion?: string;
}

export interface ProcesoRelacionado {
  codigo: string;
  modalidad: 'licitacion' | 'compra_agil' | 'orden_compra' | 'convenio_marco' | 'otro';
  relacion: string;
  similitud: number;
  institucionCoincide: boolean;
  productoCoincide: boolean;
  periodoCoincide: boolean;
  evidencia: Cita[];
}

export interface AccionExperta {
  prioridad: 'ahora' | 'hoy' | 'antes_del_cierre' | 'seguimiento';
  accion: string;
  responsableSugerido: string;
  venceEn?: string;
  requiereConfirmacionHumana: boolean;
  dependeDe: string[];
}
```

## Motor de relación

El grafo mínimo conecta:

```text
institución → unidad compradora → proceso → ítem → producto normalizado
                                      ↓
                 adjudicación → proveedor → orden de compra
                                      ↓
                     reclamo / pago / noticia / señal
```

La relación debe usar identificadores oficiales cuando existan y similitud semántica como respaldo, nunca como sustituto silencioso.

## Puertas de calidad

No publicar una evaluación como definitiva si:

- no se identificaron las bases vigentes;
- existen adjuntos pendientes o bloqueados relevantes;
- no se procesaron modificaciones posteriores a las bases;
- los criterios de evaluación no cuadran;
- faltan ítems o cantidades;
- una cita no puede resolverse hasta su fuente;
- la conclusión económica carece de costos o supuestos visibles.

## Métricas del producto

- cobertura de ficha, ítems, bases, anexos y modificaciones;
- exactitud de extracción por campo;
- porcentaje de afirmaciones con cita válida;
- contradicciones reales detectadas;
- precisión del match;
- decisiones aceptadas por usuarios;
- postulaciones, adjudicaciones y margen;
- tiempo ahorrado;
- alucinaciones o conclusiones sin respaldo;
- diferencia entre pago estimado y pago real.

## Orden de implementación

1. Reconciliar funciones y migraciones entre GitHub y producción.
2. Implementar completitud del expediente.
3. Implementar el contrato de decisión estructurado.
4. Versionar citas y documentos.
5. Construir relaciones entre modalidades de compra.
6. Incorporar rentabilidad, caja y capacidad operacional.
7. Convertir recomendaciones en tareas.
8. Crear conjunto dorado y evaluaciones automáticas.
9. Aprender de resultados reales.

