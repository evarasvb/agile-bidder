import {
  Stethoscope, FileText, UtensilsCrossed, Laptop, Wrench, Armchair,
  SprayCan, HardHat, Car, Shirt, HelpCircle, type LucideIcon,
} from 'lucide-react';

export interface Industria {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Palabras clave semilla: alimentan la búsqueda de licitaciones aunque el
   *  cliente no agregue las suyas. */
  keywords: string[];
}

export const INDUSTRIAS: Industria[] = [
  { id: 'medico', label: 'Insumos médicos', icon: Stethoscope,
    keywords: ['insumo médico', 'clínico', 'hospital', 'mascarilla', 'guante', 'jeringa', 'médico'] },
  { id: 'oficina', label: 'Artículos de oficina', icon: FileText,
    keywords: ['papel', 'resma', 'oficina', 'útiles', 'tinta', 'tóner', 'archivador'] },
  { id: 'alimentos', label: 'Alimentos', icon: UtensilsCrossed,
    keywords: ['alimento', 'abarrote', 'comida', 'fruta', 'verdura', 'carne'] },
  { id: 'tecnologia', label: 'Tecnología', icon: Laptop,
    keywords: ['computador', 'notebook', 'impresora', 'software', 'licencia', 'tecnología', 'servidor'] },
  { id: 'servicios', label: 'Servicios / Contratista', icon: Wrench,
    keywords: ['servicio', 'mantención', 'contratista', 'reparación'] },
  { id: 'mobiliario', label: 'Mobiliario', icon: Armchair,
    keywords: ['mobiliario', 'mueble', 'silla', 'escritorio', 'estante'] },
  { id: 'aseo', label: 'Aseo y limpieza', icon: SprayCan,
    keywords: ['aseo', 'limpieza', 'detergente', 'cloro', 'papel higiénico', 'sanitario'] },
  { id: 'construccion', label: 'Construcción / Ferretería', icon: HardHat,
    keywords: ['construcción', 'ferretería', 'cemento', 'herramienta', 'pintura'] },
  { id: 'automotriz', label: 'Automotriz', icon: Car,
    keywords: ['vehículo', 'automotriz', 'repuesto', 'neumático', 'lubricante'] },
  { id: 'textil', label: 'Textil / Vestuario', icon: Shirt,
    keywords: ['vestuario', 'textil', 'uniforme', 'ropa', 'calzado'] },
  { id: 'otro', label: 'Otro', icon: HelpCircle, keywords: [] },
];

/** Une las keywords semilla de las industrias elegidas + las palabras clave que
 *  el cliente escribió, sin duplicados y en minúsculas. */
export function keywordsEfectivas(industrias: string[] = [], palabras: string[] = []): string[] {
  const set = new Set<string>();
  for (const id of industrias) {
    const ind = INDUSTRIAS.find((i) => i.id === id);
    ind?.keywords.forEach((k) => set.add(k.toLowerCase()));
  }
  for (const p of palabras) {
    const t = p.trim().toLowerCase();
    if (t) set.add(t);
  }
  return [...set];
}
