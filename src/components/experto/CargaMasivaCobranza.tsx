import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCrearFacturasMasivo, fechasConsistentes, type NuevaFactura, type DeudorTipo } from '@/hooks/useCobranza';

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

function descargarPlantilla() {
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
  const ws = XLSX.utils.json_to_sheet([ejemplo], { header: COLUMNAS });
  ws['!cols'] = COLUMNAS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
  XLSX.writeFile(wb, 'plantilla_cobranza.xlsx');
}

// Acepta fecha como texto (AAAA-MM-DD o DD-MM-AAAA / DD/MM/AAAA) o como
// número de serie de Excel (cuando la celda quedó con formato de fecha).
function parsearFecha(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return null;
}

function parsearFila(row: Record<string, unknown>, numeroFila: number): FilaParseada {
  const tipoRaw = String(row[COL_TIPO] ?? '').trim().toLowerCase();
  const tipo: DeudorTipo = tipoRaw.startsWith('priv') ? 'privado' : 'estado';
  const nombre = String(row[COL_NOMBRE] ?? '').trim();
  const rut = String(row[COL_RUT] ?? '').trim();
  const numero = String(row[COL_NUMERO] ?? '').trim();
  const monto = Number(String(row[COL_MONTO] ?? '').replace(/[^0-9]/g, ''));
  const emision = parsearFecha(row[COL_EMISION]);
  const recepcion = parsearFecha(row[COL_RECEPCION]);
  const vencimiento = parsearFecha(row[COL_VENCIMIENTO]);
  const notas = String(row[COL_NOTAS] ?? '').trim();

  if (!nombre) return { fila: numeroFila, factura: null, error: 'Falta institución o cliente', resumen: '—' };
  if (!monto || monto <= 0) return { fila: numeroFila, factura: null, error: 'Monto inválido', resumen: nombre };
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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (!json.length) { toast.error('El archivo está vacío'); setFilas([]); return; }
      setFilas(json.map((r, i) => parsearFila(r, i + 2))); // fila 1 = encabezado
    } catch {
      toast.error('No se pudo leer el archivo. Usa la plantilla de Excel (.xlsx).');
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
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
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
