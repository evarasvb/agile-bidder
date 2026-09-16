import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Upload, Loader2, Save, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCliente, useActualizarCliente, validarRUT, formatearRUT } from '@/hooks/useCliente';
import { buscarEmpresaPorRut } from '@/hooks/useEmpresaPorRut';
import { uploadCompanyLogo, isValidImageFile } from '@/hooks/useProductImageUpload';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ícono de estado (ok/error) al lado derecho de un campo, solo cuando hay algo escrito. */
function CampoEstado({ tocado, valido }: { tocado: boolean; valido: boolean }) {
  if (!tocado) return null;
  return valido ? (
    <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-firmavb-green" />
  ) : (
    <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
  );
}

/**
 * Datos de la empresa que se imprimen en los PDF (ficha técnica y cotización):
 * nombre, RUT, dirección, teléfono, correo y LOGO. Se guardan en el cliente.
 */
export function DatosEmpresaCard() {
  const { data: cliente } = useCliente();
  const actualizar = useActualizarCliente();
  const fileRef = useRef<HTMLInputElement>(null);

  const [empresaNombre, setEmpresaNombre] = useState('');
  const [rut, setRut] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [repNombre, setRepNombre] = useState('');
  const [repRut, setRepRut] = useState('');
  const [giros, setGiros] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  // Autocompletado por RUT: el cliente escribe el RUT y buscamos sus datos
  // públicos (base de proveedores de Mercado Público o SII) para rellenar solo
  // los campos que estén vacíos. `rutTocado` evita buscar al cargar el perfil.
  const [rutTocado, setRutTocado] = useState(false);
  const [buscandoRut, setBuscandoRut] = useState(false);
  const [rutFuente, setRutFuente] = useState<string | null>(null);
  // Valores que puso la última búsqueda por RUT, para poder reemplazarlos si
  // el usuario cambia el RUT (sin tocar lo que escribió a mano).
  const autoRellenado = useRef<Partial<Record<'nombre' | 'direccion' | 'telefono' | 'email' | 'giros', string>>>({});

  useEffect(() => {
    if (cliente) {
      setEmpresaNombre(cliente.empresa_nombre || '');
      setRut(cliente.rut ? formatearRUT(cliente.rut) : '');
      setDireccion(cliente.direccion || '');
      setTelefono(cliente.telefono || '');
      // Correo de contacto para los PDF: el propio (si ya lo definió) o, para
      // no partir en blanco, el de su cuenta como sugerencia inicial.
      setEmail(cliente.email_contacto || cliente.email || '');
      setLogoUrl(cliente.logo_url || null);
      setRepNombre((cliente as any).representante_nombre || '');
      setRepRut((cliente as any).representante_rut ? formatearRUT((cliente as any).representante_rut) : '');
      setGiros((cliente as any).giros || '');
    }
  }, [cliente]);

  const rutValido = useMemo(() => rut.trim().length === 0 || validarRUT(rut), [rut]);
  const repRutValido = useMemo(() => repRut.trim().length === 0 || validarRUT(repRut), [repRut]);
  const emailValido = useMemo(() => email.trim().length === 0 || EMAIL_RE.test(email.trim()), [email]);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cliente?.user_id) return;
    if (!isValidImageFile(file)) {
      toast.error('Sube una imagen (JPG/PNG/WEBP) de máximo 5MB');
      return;
    }
    setSubiendo(true);
    const url = await uploadCompanyLogo(file, cliente.user_id);
    setSubiendo(false);
    if (!url) {
      toast.error('No se pudo subir el logo');
      return;
    }
    setLogoUrl(url);
    // Persistimos el logo de inmediato para que quede disponible.
    if (cliente?.id) {
      actualizar.mutate({ id: cliente.id, logo_url: url } as any);
    }
    toast.success('Logo actualizado');
  };

  const handleGuardar = () => {
    if (!cliente?.id) return;
    if (!rutValido) {
      toast.error('El RUT de la empresa no es válido. Revisa el dígito verificador.');
      return;
    }
    if (!repRutValido) {
      toast.error('El RUT del representante no es válido. Revisa el dígito verificador.');
      return;
    }
    if (!emailValido) {
      toast.error('El correo de contacto no tiene un formato válido.');
      return;
    }
    actualizar.mutate(
      {
        id: cliente.id,
        empresa_nombre: empresaNombre.trim(),
        rut: rut.trim(),
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        // Correo de contacto (para los PDF): va en su propia columna, NUNCA
        // en `email` (esa es la cuenta de acceso y tiene un UNIQUE constraint
        // — guardar ahí un correo ya usado por otra cuenta rompía el guardado).
        email_contacto: email.trim(),
        logo_url: logoUrl,
        representante_nombre: repNombre.trim(),
        representante_rut: repRut.trim(),
        giros: giros.trim(),
      } as any,
      { onSuccess: () => toast.success('Datos de la empresa guardados') }
    );
  };

  const handleRutChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(formatearRUT(e.target.value));
    if (setter === setRut) setRutTocado(true);
  };

  useEffect(() => {
    if (!rutTocado || !rutValido || rut.replace(/[^0-9kK]/g, '').length < 8) return;
    let cancelado = false;
    setRutFuente(null);
    const t = setTimeout(async () => {
      setBuscandoRut(true);
      const emp = await buscarEmpresaPorRut(rut);
      setBuscandoRut(false);
      if (cancelado) return;
      // Un campo se puede pisar si está vacío o si su valor actual es el que
      // puso una búsqueda anterior (el usuario no lo tocó). Lo que escribió a
      // mano nunca se reemplaza. Así, corregir el RUT de la empresa A a la B
      // no deja los datos de A pegados al RUT de B.
      const auto = autoRellenado.current;
      const nombreDefecto = (cliente?.email || '').split('@')[0];
      const aplicar = (setter: (f: (v: string) => string) => void, clave: keyof typeof auto, nuevo: string | null | undefined, extraVacio = '') => {
        setter((v) => {
          const pisable = !v.trim() || v === auto[clave] || (extraVacio && v.trim() === extraVacio);
          if (!pisable) return v;
          if (!nuevo) {
            const previo = auto[clave];
            delete auto[clave];
            return v === previo ? '' : v;
          }
          auto[clave] = nuevo;
          return nuevo;
        });
      };
      if (!emp) {
        // Sin datos para el nuevo RUT: se limpia lo que puso la búsqueda anterior.
        (Object.keys(auto) as (keyof typeof auto)[]).forEach((k) => {
          const setter = { nombre: setEmpresaNombre, direccion: setDireccion, telefono: setTelefono, email: setEmail, giros: setGiros }[k];
          setter((v) => (v === auto[k] ? '' : v));
          delete auto[k];
        });
        setRutFuente('');
        return;
      }
      // El nombre por defecto al crear la cuenta es el prefijo del correo: se
      // considera "vacío" para reemplazarlo por la razón social real.
      aplicar(setEmpresaNombre, 'nombre', emp.razon_social, nombreDefecto);
      const dir = [emp.direccion, emp.comuna, emp.region].filter((x) => x && String(x).trim()).join(', ');
      aplicar(setDireccion, 'direccion', dir);
      aplicar(setTelefono, 'telefono', emp.telefono ? String(emp.telefono) : null);
      aplicar(setEmail, 'email', emp.email && EMAIL_RE.test(emp.email) ? String(emp.email) : null);
      aplicar(setGiros, 'giros', emp.giros ? String(emp.giros) : null);
      setRutFuente(emp.fuente === 'sii' ? 'SII' : 'Mercado Público');
      toast.success(`Encontramos ${emp.razon_social}. Completamos los campos vacíos; revísalos y guarda.`);
    }, 700);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rut, rutTocado, rutValido]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Datos de la empresa
        </CardTitle>
        <CardDescription>
          Se usan en la cabecera de tus PDF (ficha técnica y cotización). El logo aparece en cada documento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo de la empresa" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogo}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              aria-label={logoUrl ? "Cambiar logo de la empresa" : "Subir logo de la empresa"}
            >
              {subiendo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">PNG o JPG, fondo transparente recomendado.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="empresa-nombre">Nombre / Razón social</Label>
            <Input id="empresa-nombre" value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} placeholder="Comercial ..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="empresa-rut">RUT</Label>
            <div className="relative">
              <Input
                id="empresa-rut"
                value={rut}
                onChange={handleRutChange(setRut)}
                placeholder="76.xxx.xxx-x"
                maxLength={12}
                className={cn('pr-9', !rutValido && 'border-destructive focus-visible:ring-destructive')}
              />
              {buscandoRut ? (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <CampoEstado tocado={rut.trim().length > 0} valido={rutValido} />
              )}
            </div>
            {!rutValido && <p className="text-xs text-destructive">RUT inválido — revisa el dígito verificador.</p>}
            {rutValido && buscandoRut && <p className="text-xs text-muted-foreground">Buscando los datos de la empresa…</p>}
            {rutValido && !buscandoRut && rutFuente && (
              <p className="text-xs text-firmavb-green">Datos completados desde {rutFuente}. Revísalos antes de guardar.</p>
            )}
            {rutValido && !buscandoRut && rutFuente === '' && (
              <p className="text-xs text-muted-foreground">No encontramos datos públicos para este RUT; complétalos a mano.</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="empresa-direccion">Dirección</Label>
            <Input id="empresa-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 123, Comuna, Ciudad" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresa-rep">Representante legal</Label>
            <Input id="empresa-rep" value={repNombre} onChange={(e) => setRepNombre(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresa-rep-rut">RUT del representante</Label>
            <div className="relative">
              <Input
                id="empresa-rep-rut"
                value={repRut}
                onChange={handleRutChange(setRepRut)}
                placeholder="12.345.678-9"
                maxLength={12}
                className={cn('pr-9', !repRutValido && 'border-destructive focus-visible:ring-destructive')}
              />
              <CampoEstado tocado={repRut.trim().length > 0} valido={repRutValido} />
            </div>
            {!repRutValido && <p className="text-xs text-destructive">RUT inválido — revisa el dígito verificador.</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="empresa-giros">Giros (como aparecen en el SII)</Label>
            <Input
              id="empresa-giros"
              value={giros}
              onChange={(e) => setGiros(e.target.value)}
              placeholder="Venta al por mayor de artículos de oficina; servicios informáticos"
            />
            <p className="text-xs text-muted-foreground">
              Cópialos tal como figuran en sii.cl → Servicios online → Situación tributaria. Si tienes más de uno, sepáralos con punto y coma ( ; ).
            </p>
            {giros.trim().length > 0 && giros.trim().length < 8 && (
              <p className="text-xs text-amber-600">Parece muy corto para ser un giro completo del SII — revisa que esté bien copiado.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="empresa-telefono">Teléfono</Label>
            <Input id="empresa-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 ..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="empresa-email">Correo de contacto</Label>
            <div className="relative">
              <Input
                id="empresa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@empresa.cl"
                className={cn('pr-9', !emailValido && 'border-destructive focus-visible:ring-destructive')}
              />
              <CampoEstado tocado={email.trim().length > 0} valido={emailValido} />
            </div>
            {!emailValido && <p className="text-xs text-destructive">Correo con formato inválido.</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={actualizar.isPending}>
            {actualizar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar datos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
