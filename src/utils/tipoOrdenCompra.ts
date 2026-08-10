/**
 * Clasificacion del campo "tipo" de una Orden de Compra segun la
 * documentacion oficial de la API de Mercado Publico (api.mercadopublico.cl).
 */

export const TIPO_OC_LABELS: Record<string, string> = {
    OC: 'Automatica',
    D1: 'Trato Directo (proveedor unico)',
    C1: 'Trato Directo (emergencia/urgencia/imprevisto)',
    F3: 'Trato Directo (confidencialidad)',
    G1: 'Trato Directo (naturaleza de la negociacion)',
    R1: 'OC menor a 3 UTM',
    CA: 'Sin resolucion',
    SE: 'Sin emision automatica',
    CM: 'Convenio Marco',
    FG: 'Trato Directo (Art. 8 letras f y g - Ley 19.886)',
    TL: 'Convenio Marco - Tienda de Libros (obsoleto)',
    MC: 'Microcompra',
    AG: 'Compra Agil',
    CC: 'Compra Coordinada',
};

const TIPOS_TRATO_DIRECTO = new Set(['D1', 'C1', 'F3', 'G1', 'FG']);

export function esTratoDirecto(tipo?: string | null): boolean {
    if (!tipo) return false;
    return TIPOS_TRATO_DIRECTO.has(tipo.trim().toUpperCase());
}

export function getTipoOCLabel(tipo?: string | null): string {
    if (!tipo) return 'N/A';
    const key = tipo.trim().toUpperCase();
    return TIPO_OC_LABELS[key] ?? tipo;
}
