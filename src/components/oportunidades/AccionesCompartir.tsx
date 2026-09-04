// Botones "Agregar a mi calendario" y "Compartir por email" de una oportunidad.
// Funcionan con enlaces directos (Google, Outlook, .ics, mailto): el cliente no
// necesita conectar su cuenta ni salir de su propio calendario o correo.
import { CalendarPlus, Copy, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { descargarIcs, urlGoogleCalendar, urlOutlook } from '@/lib/calendario';
import { eventoCierre, mailtoOportunidad, resumenOportunidad, type OportunidadCompartible } from '@/lib/compartir';

interface Props {
  oportunidad: OportunidadCompartible;
  /** Texto adicional para el email (p. ej. el resumen del Libro o el link compartido). */
  extraEmail?: string;
  /** Iconos chicos para tarjetas; por defecto botones con texto. */
  compact?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
const detener = (e: React.SyntheticEvent) => e.stopPropagation();

export function AccionesCompartir({ oportunidad, extraEmail, compact = false, size = 'sm', className }: Props) {
  const evento = eventoCierre(oportunidad);
  const uid = `${oportunidad.codigo}@firmavb.cl`;

  const copiarResumen = async () => {
    try {
      await navigator.clipboard.writeText(resumenOportunidad(oportunidad, extraEmail));
      toast.success('Resumen copiado: pégalo en tu correo o WhatsApp');
    } catch {
      toast.error('No pude copiar. Usa "Enviar por email".');
    }
  };

  const botonCalendario = compact ? (
    <Button variant="ghost" size="icon" className="h-7 w-7" title="Agregar a mi calendario" disabled={!evento}>
      <CalendarPlus className="h-3.5 w-3.5" />
    </Button>
  ) : (
    <Button variant="outline" size={size} className="gap-2" disabled={!evento} title={evento ? undefined : 'Esta oportunidad no tiene fecha de cierre'}>
      <CalendarPlus className="h-4 w-4" />
      Agregar a mi calendario
    </Button>
  );
  const botonEmail = compact ? (
    <Button variant="ghost" size="icon" className="h-7 w-7" title="Compartir por email">
      <Mail className="h-3.5 w-3.5" />
    </Button>
  ) : (
    <Button variant="outline" size={size} className="gap-2">
      <Mail className="h-4 w-4" />
      Compartir por email
    </Button>
  );

  return (
    <span className={className ? className + ' inline-flex items-center gap-1' : 'inline-flex items-center gap-1'} onClick={detener}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{botonCalendario}</DropdownMenuTrigger>
        {evento && (
          <DropdownMenuContent align="end" onClick={detener}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Guardar el cierre en…</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => abrir(urlGoogleCalendar(evento))}>Google Calendar</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => abrir(urlOutlook(evento))}>Outlook / Microsoft 365</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { descargarIcs(evento, `cierre-${oportunidad.codigo}.ics`, uid); toast.success('Archivo .ics descargado: ábrelo y se agrega a tu calendario'); }}>
              Apple Calendar u otro (.ics)
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{botonEmail}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={detener}>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Resumen listo para enviar</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => { window.location.href = mailtoOportunidad(oportunidad, extraEmail); }}>
            <Mail className="h-4 w-4 mr-2" />Enviar por email
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => abrir(`https://wa.me/?text=${encodeURIComponent(resumenOportunidad(oportunidad, extraEmail))}`)}>
            <MessageCircle className="h-4 w-4 mr-2" />Enviar por WhatsApp
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={copiarResumen}>
            <Copy className="h-4 w-4 mr-2" />Copiar resumen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
