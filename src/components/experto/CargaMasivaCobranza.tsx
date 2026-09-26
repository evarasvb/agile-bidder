import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCrearFacturasMasivo, fechasConsistentes, type NuevaFactura, type DeudorTipo } from '@/hooks/useCobranza';
import { downloadSpreadsheetWorkbook, readFirstSpreadsheetSheet, recordsToSpreadsheetRows, SpreadsheetReadError } from '@/lib/excelFiles';

// Columnas de la plantilla, en el mismo orden en que se leen de vuelta.
const COL_TIPO = 'Tipo (Estado/Privado)';
const COL_NOMBRE = 'Institución o Cliente';
const COL_RUT = 'RUT';
const COL_NUMERO = 'N° Factura';
const COL_MONTO = 'Monto';
const COL_EMISION = 'Fecha Emisión (AAAA-MM-DD)';
const COL_RECEPCION = 'Fecha Recepción (AAAA-MM-DD)';
const COL_VENCIMIENTO = 'Fecha Vencimiento (AAAA-MM-DD)';
const COL_NOTAS = 'Notas';
const COLUMNAS = [COL_TIPO, COL_NOMBRE, COL_RUT, COL_NUMERO, COL_MONTO, COL_EMISION, COL_RECEPCION, COL_VENCIMIENTO, COL_NOTAS];

interface FilaParseada {
  fila: number;
  factura: NuevaFactura | null;
  error: string | null;
  resumen: string;
}

async function descargarPlantilla() {
  const ejemplo: Record<string, string | number> = {
    [COL_TIPO]: 'Estado',
    [COL_NOMBRE]: 'I MUNICIPALIDAD DE MAIPÚ',
    [COL_RUT]: '69.070.100-3',
    [COL_NUMERO]: '1042',
    [COL_MONTO]: 1500000,
    [COL_EMISION]: '2026-08-01',
    [COL_RECEPCION]: '2026-08-05',
    [COL_VENCIMIENTO]: '',
    [COL_NOTAS]: 'Opcional',
  };
  await downloadSpreadsheetWorkbook('plantilla_cobranza.xlsx', [{
    name: 'Facturas',
    rows: recordsToSpreadsheetRows([ejemplo], COLUMNAS),
    columnWidths: COLUMNAS.map(() => 24),
  }]);
}

// Acepta fecha como texto (AAAA-MM-DD o DD-MM-AAAA / DD/MM/AAAA) o como
// número de serie de Excel (cuando la celda quedó con formato de fecha).
interface FechaParseada { valor: string | null; invalida: boolean }

// Distingue celda vacía (válida, fecha opcional) de un valor que vino pero no
// se pudo leer o no es una fecha real de calendario (p. ej. "2026-02-30"): un
// insert con esa fecha tal cual la rechaza Postgres y aborta TODO el lote, así
// que hay que detectarla acá, no dejar que llegue a la base.
function parsearFecha(raw: unknown): FechaParseada {
  if (raw == null || raw === '') return { valor: null, invalida: false };
  if (typeof raw === 'number') {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? { valor: null, invalida: true } : { valor: d.toISOString().slice(0, 10), invalida: false };
  }
  const s = String(raw).trim();
  if (!s) return { valor: null, invalida: false };
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  let y: number, m: number, day: number;
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); day = Number(iso[3]); }
  else if (dmy) { y = Number(dmy[3]); m = Number(dmy[2]); day = Number(dmy[1]); }
  else return { valor: null, invalida: true };
  const d = new Date(Date.UTC(y, m - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== day) return { valor: null, invalida: true };
  return { valor: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, invalida: false };
}

// Acepta números de Excel tal cual, o texto con separador de miles chileno
// ("1.500.000"), decimal con coma o punto, y rechaza negativos (no es un
// monto a cobrar válido) en vez de convertirlos en un positivo al quitar el
// signo.
function parsearMonto(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith('-')) return null;
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(s) && !/\.\d{3}(\D|$)/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(/[.,]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parsearFila(row: Record<string, unknown>, numeroFila: number): FilaParseada {
  const tipoRaw = String(row[COL_TIPO] ?? '').trim().toLowerCase();
  const tipo: DeudorTipo = tipoRaw.startsWith('priv') ? 'privado' : 'estado';
  const nombre = String(row[COL_NOMBRE] ?? '').trim();
  const rut = String(row[COL_RUT] ?? '').trim();
  const numero = String(row[COL_NUMERO] ?? '').trim();
  const monto = parsearMonto(row[COL_MONTO]);
  const emisionP = parsearFecha(row[COL_EMISION]);
  const recepcionP = parsearFecha(row[COL_RECEPCION]);
  const vencimientoP = parsearFecha(row[COL_VENCIMIENTO]);
  const notas = String(row[COL_NOTAS] ?? '').trim();

  if (!nombre) return { fila: numeroFila, factura: null, error: 'Falta institución o cliente', resumen: '—' };
  if (nombre.length > 500) return { fila: numeroFila, factura: null, error: 'Institución o cliente supera 500 caracteres', resumen: nombre.slice(0, 80) };
  if (rut.length > 20) return { fila: numeroFila, factura: null, error: 'RUT supera 20 caracteres', resumen: nombre };
  if (numero.length > 100) return { fila: numeroFila, factura: null, error: 'N° de factura supera 100 caracteres', resumen: nombre };
  if (notas.length > 5_000) return { fila: numeroFila, factura: null, error: 'Notas supera 5.000 caracteres', resumen: nombre };
  if (monto == null || monto <= 0) return { fila: numeroFila, factura: null, error: 'Monto inválido', resumen: nombre };
  if (emisionP.invalida || recepcionP.invalida || vencimientoP.invalida) {
    return { fila: numeroFila, factura: null, error: 'Fecha inválida (usa AAAA-MM-DD)', resumen: nombre };
  }
  const emision = emisionP.valor, recepcion = recepcionP.valor, vencimiento = vencimientoP.valor;
  const errorFechas = fechasConsistentes(emision || '', recepcion || '', vencimiento || '');
  if (errorFechas) return { fila: numeroFila, factura: null, error: errorFechas, resumen: nombre };

  return {
    fila: numeroFila,
    error: null,
    resumen: nombre,
    factura: {
      deudor_tipo: tipo, deudor_nombre: nombre, deudor_rut: rut || null,
      oc_codigo: null, numero_factura: numero || null, monto,
      fecha_emision: emision, fecha_recepcion: recepcion, fecha_vencimiento: vencimiento,
      notas: notas || null,
      factura_archivo_url: null, factura_archivo_nombre: null,
      guia_archivo_url: null, guia_archivo_nombre: null,
    },
  };
}

// Carga masiva de facturas por cobrar desde una plantilla de Excel. Los
// adjuntos (factura/guía en PDF) se suben después, uno por uno, desde el
// listado — subir muchos PDF a la vez y adivinar a qué fila corresponde cada
// uno es frágil; es más confiable cargar los datos primero y adjuntar el
// respaldo con el nombre del deudor ya visible en pantalla.
export function CargaMasivaCobranzaDialog() {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaParseada[]>([]);
  const [archivo, setArchivo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const crearMasivo = useCrearFacturasMasivo();

  const limpiar = () => { setFilas([]); setArchivo(null); };

  const onArchivo = async (file: File) => {
    setArchivo(file.name);
    try {
      const json = await readFirstSpreadsheetSheet(file);
      if (!json.length) { toast.error('El archivo está vacío'); setFilas([]); return; }
      setFilas(json.map((r, i) => parsearFila(r, i + 2))); // fila 1 = encabezado
    } catch (error) {
      toast.error(error instanceof SpreadsheetReadError
        ? error.message
        : 'No se pudo leer el archivo. Usa la plantilla de Excel (.xlsx).');
      setFilas([]);
    }
  };

  const validas = filas.filter((f) => f.factura);
  const conError = filas.filter((f) => !f.factura);

  const cargar = async () => {
    if (!validas.length) return;
    try {
      const n = await crearMasivo.mutateAsync(validas.map((f) => f.factura!));
      toast.success(`${n} factura${n === 1 ? '' : 's'} cargada${n === 1 ? '' : 's'}`);
      setAbierto(false);
      limpiar();
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo cargar el Excel');
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) limpiar(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><FileSpreadsheet className="mr-1 h-4 w-4" /> Cargar Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga masiva de facturas</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala y súbela para registrar varias facturas de una vez.
            Después puedes adjuntar la factura y la guía de cada una desde el listado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={descargarPlantilla}>
            <Download className="mr-1 h-4 w-4" /> Descargar plantilla
          </Button>
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); }} />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> {archivo ? 'Cambiar archivo' : 'Subir Excel completado'}
          </Button>
          {archivo && <span className="truncate text-xs text-muted-foreground max-w-[200px]">{archivo}</span>}
        </div>

        {filas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {validas.length} fila(s) lista(s) para cargar{conError.length ? ` · ${conError.length} con error (no se cargan)` : ''}.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Fila</TableHead>
                    <TableHead>Institución / Cliente</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.fila}>
                      <TableCell className="text-xs text-muted-foreground">{f.fila}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{f.resumen}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{f.factura ? f.factura.monto.toLocaleString('es-CL') : '—'}</TableCell>
                      <TableCell>
                        {f.factura ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> OK</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700"><AlertCircle className="h-3.5 w-3.5" /> {f.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={cargar} disabled={!validas.length || crearMasivo.isPending}>
            {crearMasivo.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Cargar {validas.length || ''} factura{validas.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
