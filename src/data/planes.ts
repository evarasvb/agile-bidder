// Única fuente de verdad para la escalera de planes: antes el precio y los
// puntos de cada plan vivían repetidos (y podían desalinearse) entre la
// tarjeta de cuenta (PlanesEscalera) y cualquier otra pantalla que quisiera
// mostrarlos — como la página pública /planes.
export interface PlanEscalera {
  id: 'free' | 'pro_30' | 'plus_30' | 'erp';
  nombre: string;
  precio: string;
  periodo: string;
  puntos: string[];
}

export const PLANES: readonly PlanEscalera[] = [
  {
    id: 'free',
    nombre: 'Gratis',
    precio: '$0',
    periodo: '',
    puntos: ['3 preguntas y 1 informe al mes en el Experto', 'Ver las oportunidades de tu rubro'],
  },
  {
    id: 'pro_30',
    nombre: 'Experto Pro',
    precio: '$50.000',
    periodo: '30 días',
    puntos: [
      'Preguntas e informes sin límite',
      'Sala de postulación y matriz con Excel de fórmulas',
      'Estudio profundo: historial del organismo y quién gana',
      'Riesgo de pago y competencia en cada oportunidad',
    ],
  },
  {
    id: 'plus_30',
    nombre: 'Experto Plus',
    precio: '$100.000',
    periodo: '30 días',
    puntos: ['Todo lo de Pro', 'Anexos completados con los datos y documentos de tu empresa'],
  },
  {
    id: 'erp',
    nombre: 'FirmaVB ERP',
    precio: '$149.990 + IVA',
    periodo: 'al mes ($178.488 con IVA), más 3% del neto de cada OC aceptada que postulaste desde FirmaVB (+ IVA)',
    puntos: [
      'Todo lo de Plus',
      'Postular y autocompletar cotizaciones con la extensión',
      'Inventario, equipo, órdenes de compra y reportes',
    ],
  },
] as const;
