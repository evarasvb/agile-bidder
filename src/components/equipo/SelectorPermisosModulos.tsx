import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MODULOS, MODULO_KEYS, type ModuloKey } from '@/lib/modulosPermisos';

interface Props {
  // null = acceso a todo (sin restricción). Array = solo esos módulos.
  value: ModuloKey[] | null;
  onChange: (v: ModuloKey[] | null) => void;
}

// Selector de módulos para el perfil de un miembro. Un switch "acceso a todo"
// (value = null) y, al apagarlo, un grid de checkboxes por módulo.
export function SelectorPermisosModulos({ value, onChange }: Props) {
  const todo = value == null;
  const set = new Set<ModuloKey>(value ?? []);

  const toggle = (k: ModuloKey, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(k); else next.delete(k);
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Acceso a todos los módulos</Label>
          <p className="text-[11px] text-muted-foreground">Apágalo para elegir a qué secciones entra este miembro.</p>
        </div>
        <Switch
          checked={todo}
          onCheckedChange={(on) => onChange(on ? null : MODULO_KEYS.slice())}
          className="data-[state=checked]:bg-firmavb-blue"
        />
      </div>
      {!todo && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODULOS.map((m) => (
            <label key={m.key} className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
              <Checkbox checked={set.has(m.key)} onCheckedChange={(c) => toggle(m.key, c === true)} />
              <span className="truncate">{m.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
