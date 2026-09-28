import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useActualizarCliente, Cliente } from '@/hooks/useCliente';
import { formatearRut, rutSinPuntos, rutValido } from '@/lib/rut';

// Versión de los textos legales que el cliente acepta en este paso. Si se
// cambian Términos o Privacidad de forma relevante, subir la versión.
export const TERMINOS_VERSION = '2026-09';

const REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso',
  'Metropolitana', "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos',
  'Los Lagos', 'Aysén', 'Magallanes',
];

const MIN_DESCRIPCION = 40;

type Campo = 'empresa' | 'rut' | 'nombre' | 'whatsapp' | 'descripcion' | 'regiones' | 'terminos';

interface Props {
  cliente: Cliente;
  onDone: () => void;
}

// Paso 1 del onboarding, inspirado en lo mejor de la competencia: un solo
// formulario, todo obligatorio y validado (RUT con dígito verificador,
// WhatsApp de 9 dígitos, descripción mínima, al menos una región y aceptación
// expresa de Términos y Privacidad). Con el RUT + la descripción la IA arma
// el perfil de búsqueda del cliente, así nadie termina el onboarding sin
// recibir oportunidades.
export default function OnboardingEmpresa({ cliente, onDone }: Props) {
  const actualizar = useActualizarCliente();
  const [empresa, setEmpresa] = useState('');
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [regiones, setRegiones] = useState<string[]>([]);
  const [terminos, setTerminos] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState('');
  const refs = useRef<Partial<Record<Campo, HTMLElement | null>>>({});
  const init = useRef(false);

  // Precarga lo que ya exista (clientes que retoman el onboarding).
  useEffect(() => {
    if (init.current || !cliente) return;
    init.current = true;
    setEmpresa(cliente.empresa_nombre && cliente.empresa_nombre !== cliente.email ? cliente.empresa_nombre : '');
    setRut(cliente.rut ? formatearRut(cliente.rut) : '');
    setNombre(cliente.nombre_responsable || '');
    setWhatsapp((cliente.telefono || '').replace(/\D/g, '').replace(/^56/, '').slice(-9));
    setDescripcion(cliente.descripcion_empresa || '');
    setTerminos(!!cliente.terminos_aceptados_at);
    supabase
      .from('cliente_filtros_oportunidades')
      .select('regiones_activas')
      .eq('cliente_id', cliente.id)
      .maybeSingle()
      .then(({ data }) => {
        const r = (data as { regiones_activas: string[] | null } | null)?.regiones_activas;
        if (r?.length) setRegiones(r);
      });
  }, [cliente]);

  const validar = (): Partial<Record<Campo, string>> => {
    const e: Partial<Record<Campo, string>> = {};
    if (empresa.trim().length < 3) e.empresa = 'Escribe el nombre o razón social de tu empresa.';
    if (!rut.trim()) e.rut = 'El RUT de la empresa es obligatorio.';
    else if (!rutValido(rut)) e.rut = 'Este RUT no es válido: revisa los números y el dígito verificador.';
    if (nombre.trim().length < 3) e.nombre = 'Escribe tu nombre.';
    const wa = whatsapp.replace(/\D/g, '');
    if (!/^9\d{8}$/.test(wa)) e.whatsapp = 'Escribe tu celular de 9 dígitos, empezando por 9 (ej: 912345678).';
    if (descripcion.trim().length < MIN_DESCRIPCION)
      e.descripcion = `Cuéntanos un poco más (mínimo ${MIN_DESCRIPCION} caracteres): qué productos o servicios vendes.`;
    if (regiones.length === 0) e.regiones = 'Elige al menos una región donde puedas vender o despachar.';
    if (!terminos) e.terminos = 'Para continuar debes aceptar los Términos y la Política de Privacidad.';
    return e;
  };

  // Al corregir un campo, su error desaparece al tiro (no hasta el próximo envío).
  const limpia = (c: Campo) => setErrores((p) => (p[c] ? { ...p, [c]: undefined } : p));

  const toggleRegion = (r: string) => {
    limpia('regiones');
    setRegiones((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validar();
    setErrores(e);
    const orden: Campo[] = ['empresa', 'rut', 'nombre', 'whatsapp', 'descripcion', 'regiones', 'terminos'];
    const primero = orden.find((c) => e[c]);
    if (primero) {
      // Sin toast: en celular tapaba el botón. Los errores van en línea.
      refs.current[primero]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setEnviando(true);
    try {
      setEtapa('Guardando tu empresa…');
      await actualizar.mutateAsync({
        id: cliente.id,
        empresa_nombre: empresa.trim(),
        rut: rutSinPuntos(rut),
        nombre_responsable: nombre.trim(),
        telefono: `+56${whatsapp.replace(/\D/g, '')}`,
        descripcion_empresa: descripcion.trim(),
        terminos_aceptados_at: cliente.terminos_aceptados_at || new Date().toISOString(),
        terminos_version: TERMINOS_VERSION,
      });

      await supabase
        .from('cliente_filtros_oportunidades')
        .upsert(
          { cliente_id: cliente.id, regiones_activas: regiones, updated_at: new Date().toISOString() },
          { onConflict: 'cliente_id' },
        );

      // La IA arma el perfil. Si falla, el cliente igual avanza y elige a mano.
      setEtapa('Revisando lo que tu empresa le ha vendido al Estado…');
      try {
        const { data, error } = await supabase.functions.invoke('perfil-empresa-ia', {
          body: { descripcion: descripcion.trim(), rut: rutSinPuntos(rut) },
        });
        if (!error && data) {
          const actuales = cliente.palabras_clave_busqueda ?? [];
          const palabras = Array.from(new Set([...actuales, ...((data.palabras as string[]) ?? [])])).slice(0, 25);
          const industrias = Array.from(new Set([...(cliente.industrias ?? []), ...((data.industrias as string[]) ?? [])]));
          await actualizar.mutateAsync({
            id: cliente.id,
            palabras_clave_busqueda: palabras,
            industrias,
            categoria_negocio: industrias[0] ?? cliente.categoria_negocio ?? null,
          } as Partial<Cliente> & { id: string });
          if (data.vende_al_estado && data.historial?.monto_total) {
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
              .format(data.historial.monto_total);
            toast.success(`Encontramos tu historial: ${monto} vendidos a ${data.historial.organismos} organismos.`);
          } else {
            toast.success(`Listo: armamos ${palabras.length} palabras clave para tu búsqueda.`);
          }
        }
      } catch {
        /* sin IA: el paso siguiente permite elegir a mano */
      }

      onDone();
    } catch {
      // useActualizarCliente ya muestra el error traducido.
    } finally {
      setEnviando(false);
      setEtapa('');
    }
  };

  const error = (c: Campo) =>
    errores[c] ? (
      <p className="text-sm text-destructive mt-1" role="alert">
        {errores[c]}
      </p>
    ) : null;
  const borde = (c: Campo) => (errores[c] ? 'border-destructive focus-visible:ring-destructive' : '');

  return (
    <form onSubmit={enviar} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Tu empresa
          </CardTitle>
          <CardDescription>Todos los campos son obligatorios. Te toma 1 minuto.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div ref={(el) => (refs.current.empresa = el)}>
            <Label htmlFor="ob-empresa">Nombre o razón social *</Label>
            <Input id="ob-empresa" value={empresa} onChange={(e) => { limpia('empresa'); setEmpresa(e.target.value); }} className={borde('empresa')} autoComplete="organization" />
            {error('empresa')}
          </div>
          <div ref={(el) => (refs.current.rut = el)}>
            <Label htmlFor="ob-rut">RUT de la empresa *</Label>
            <Input
              id="ob-rut"
              value={rut}
              onChange={(e) => { limpia('rut'); setRut(formatearRut(e.target.value)); }}
              onBlur={() => rut && setErrores((p) => ({ ...p, rut: rutValido(rut) ? undefined : 'Este RUT no es válido: revisa los números y el dígito verificador.' }))}
              placeholder="76.123.456-7"
              inputMode="text"
              className={borde('rut')}
            />
            {error('rut')}
          </div>
          <div ref={(el) => (refs.current.nombre = el)}>
            <Label htmlFor="ob-nombre">Tu nombre *</Label>
            <Input id="ob-nombre" value={nombre} onChange={(e) => { limpia('nombre'); setNombre(e.target.value); }} className={borde('nombre')} autoComplete="name" />
            {error('nombre')}
          </div>
          <div ref={(el) => (refs.current.whatsapp = el)}>
            <Label htmlFor="ob-wa">WhatsApp *</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground">+56</span>
              <Input
                id="ob-wa"
                value={whatsapp}
                onChange={(e) => { limpia('whatsapp'); setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 9)); }}
                placeholder="912345678"
                inputMode="numeric"
                className={`rounded-l-none ${borde('whatsapp')}`}
                autoComplete="tel-national"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ahí te avisaremos de tus oportunidades.</p>
            {error('whatsapp')}
          </div>
        </CardContent>
      </Card>

      <Card ref={(el) => (refs.current.descripcion = el)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> ¿Qué hace tu empresa? *
          </CardTitle>
          <CardDescription>
            Cuéntalo en tus palabras. Con esto y tu RUT, la IA revisa lo que ya le vendiste al Estado y arma tu búsqueda.
            Mientras más específico (productos, servicios, materiales), mejores oportunidades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={descripcion}
            onChange={(e) => { limpia('descripcion'); setDescripcion(e.target.value); }}
            rows={4}
            placeholder="Ej: Vendemos artículos de aseo y desechables (bolsas de basura, papel higiénico, cloro, guantes) a colegios, hospitales y municipios de la V Región."
            className={borde('descripcion')}
          />
          <p className={`text-xs mt-1 ${descripcion.trim().length >= MIN_DESCRIPCION ? 'text-green-600' : 'text-muted-foreground'}`}>
            {descripcion.trim().length}/{MIN_DESCRIPCION} caracteres mínimos
          </p>
          {error('descripcion')}
        </CardContent>
      </Card>

      <Card ref={(el) => (refs.current.regiones = el)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> ¿Dónde puedes vender? *
          </CardTitle>
          <CardDescription>Marca las regiones donde puedes despachar o prestar servicio. Lo cambias cuando quieras.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {REGIONES.map((r) => {
              const on = regiones.includes(r);
              return (
                <button
                  type="button"
                  key={r}
                  aria-pressed={on}
                  onClick={() => toggleRegion(r)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-muted-foreground/30'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="text-sm text-primary underline mt-3"
            onClick={() => { limpia('regiones'); setRegiones(regiones.length === REGIONES.length ? [] : [...REGIONES]); }}
          >
            {regiones.length === REGIONES.length ? 'Quitar todas' : 'Todo Chile'}
          </button>
          {error('regiones')}
        </CardContent>
      </Card>

      <Card ref={(el) => (refs.current.terminos = el)} className={errores.terminos ? 'border-destructive' : ''}>
        <CardContent className="pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={terminos}
              onChange={(e) => { limpia('terminos'); setTerminos(e.target.checked); }}
              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span className="text-sm">
              <ShieldCheck className="inline w-4 h-4 mr-1 text-primary" />
              Acepto los{' '}
              <Link to="/terminos" target="_blank" className="underline font-medium">Términos de Servicio</Link> y la{' '}
              <Link to="/privacidad" target="_blank" className="underline font-medium">Política de Privacidad</Link> de FirmaVB,
              y autorizo el uso de mis datos para buscar y avisarme oportunidades por correo y WhatsApp. *
            </span>
          </label>
          {error('terminos')}
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        {Object.values(errores).some(Boolean) && (
          <p className="text-sm text-destructive" role="status">
            Faltan {Object.values(errores).filter(Boolean).length} dato(s): revisa los campos marcados en rojo.
          </p>
        )}
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {etapa || 'Guardando…'}
            </>
          ) : (
            <>Armar mi búsqueda →</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">Tus datos están protegidos y puedes pedir su eliminación cuando quieras.</p>
      </div>
    </form>
  );
}
