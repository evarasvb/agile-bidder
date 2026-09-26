import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Tabla de datos reutilizable para todas las hojas de firmavb: ordenar por
 * cualquier columna (clic en el encabezado), búsqueda, paginación con tamaño
 * de página, encabezado fijo con scroll interno (la tabla cabe en la pantalla),
 * contador "X–Y de N", exportar a CSV lo filtrado y selección múltiple opcional.
 *
 * Es solo presentación: recibe las filas ya cargadas y filtradas por la página
 * (los selects de filtros van en `toolbar`) y se encarga del resto.
 */
export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Valor para ordenar. Si existe, la columna se puede ordenar con clic. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Valor para exportar a CSV (por defecto `sortValue`). */
  exportValue?: (row: T) => string | number | null | undefined;
  /** Encabezado para el CSV cuando `header` no es texto. */
  exportHeader?: string;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableSort {
  id: string;
  dir: 'asc' | 'desc';
}

export interface DataTableSelection {
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** Selecciona/deselecciona todas las filas visibles en la página actual. */
  onToggleMany: (ids: string[], seleccionar: boolean) => void;
}

/**
 * Modo servidor: la página trae solo una página ya ordenada y filtrada (p. ej.
 * inventarios de miles de filas). La tabla no ordena ni pagina localmente:
 * muestra `rows` tal cual y delega orden/página/tamaño a estos callbacks.
 */
export interface DataTableManual {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (n: number) => void;
  sort: DataTableSort | null;
  onSortChange: (sort: DataTableSort | null) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  manual?: DataTableManual;
  rows: T[];
  rowKey: (row: T) => string;
  /** Texto por fila para la búsqueda. Si se entrega, aparece el buscador. */
  searchText?: (row: T) => string;
  /** Se llama con el texto de búsqueda en cada cambio (además del filtrado local
   *  por `searchText`). Útil cuando `rows` viene truncado por el servidor (un
   *  `limit` en la RPC) y hay que reconsultar con ese mismo término. */
  onSearchChange?: (value: string) => void;
  /** `rows` ya viene filtrado por el servidor con el mismo término de búsqueda
   *  (vía `onSearchChange`): desactiva el filtrado local adicional por
   *  `searchText`, que puede buscar sobre menos campos que la consulta del
   *  servidor y ocultar filas que sí coinciden (p. ej. si el término solo
   *  aparece en un dato que no viaja en `rows`). El buscador se sigue
   *  mostrando igual. */
  serverSearch?: boolean;
  searchPlaceholder?: string;
  defaultSort?: DataTableSort;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  /** Recuerda orden y tamaño de página del usuario (localStorage). */
  storageKey?: string;
  /** Nombre del archivo CSV; si se entrega, aparece el botón Exportar. */
  exportFileName?: string;
  emptyMessage?: ReactNode;
  loading?: boolean;
  selection?: DataTableSelection;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Controles extra (filtros, acciones) a la izquierda de la barra. */
  toolbar?: ReactNode;
  /** Alto máximo del área con scroll (por defecto cabe en la pantalla). */
  maxHeight?: string;
  /** Nombre de lo que se lista, para el contador: "contactos", "órdenes". */
  itemLabel?: string;
  className?: string;
}

function leerPreferencia<T>(key: string | undefined, campo: string, porDefecto: T): T {
  if (!key) return porDefecto;
  try {
    const raw = localStorage.getItem(`dt:${key}:${campo}`);
    return raw ? (JSON.parse(raw) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarPreferencia(key: string | undefined, campo: string, valor: unknown) {
  if (!key) return;
  try {
    localStorage.setItem(`dt:${key}:${campo}`, JSON.stringify(valor));
  } catch {
    /* modo privado o storage lleno: se ignora */
  }
}

const esVacio = (v: unknown) => v === null || v === undefined || v === '';

/** Compara dos valores no vacíos (número o texto en español, orden natural). */
function compararValores(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/** Orden con dirección; los vacíos van SIEMPRE al final, suba o baje. */
function compararConDireccion(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const aNulo = esVacio(a);
  const bNulo = esVacio(b);
  if (aNulo && bNulo) return 0;
  if (aNulo) return 1;
  if (bNulo) return -1;
  return compararValores(a, b) * (dir === 'asc' ? 1 : -1);
}

function exportarCSV<T>(columns: DataTableColumn<T>[], rows: T[], fileName: string) {
  // Se exportan las columnas con valor exportable o con encabezado de texto
  // (las de acciones, sin encabezado, quedan fuera).
  const cols = columns.filter((c) => c.exportValue || c.sortValue || (typeof c.header === 'string' && c.header.trim() !== ''));
  const escapar = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    // Anti "CSV injection": una celda que empieza con = + - @ (o tab/retorno)
    // la planilla la ejecutaría como fórmula; se antepone un apóstrofo para
    // que Excel/Sheets la traten como texto.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecera = cols.map((c) => escapar(c.exportHeader ?? (typeof c.header === 'string' ? c.header : c.id)));
  const lineas = rows.map((r) => cols.map((c) => escapar((c.exportValue ?? c.sortValue)?.(r) ?? '')).join(';'));
  // Punto y coma + BOM: Excel en español lo abre en columnas sin preguntar.
  const blob = new Blob(['﻿' + [cabecera.join(';'), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  manual,
  rows,
  rowKey,
  searchText,
  onSearchChange,
  serverSearch = false,
  searchPlaceholder = 'Buscar…',
  defaultSort,
  pageSizeOptions = [25, 50, 100, 200],
  defaultPageSize = 50,
  storageKey,
  exportFileName,
  emptyMessage = 'No hay datos para mostrar.',
  loading = false,
  selection,
  onRowClick,
  rowClassName,
  toolbar,
  maxHeight = 'calc(100vh - 260px)',
  itemLabel = 'filas',
  className,
}: DataTableProps<T>) {
  const [busqueda, setBusqueda] = useState('');
  const [sortLocal, setSortLocal] = useState<DataTableSort | null>(() => leerPreferencia(storageKey, 'sort', defaultSort ?? null));
  const [pageSizeLocal, setPageSizeLocal] = useState<number>(() => leerPreferencia(storageKey, 'pageSize', defaultPageSize));
  const [pageLocal, setPageLocal] = useState(1);

  // En modo servidor el orden, la página y el tamaño vienen de la página.
  const sort = manual ? manual.sort : sortLocal;
  const pageSize = manual ? manual.pageSize : pageSizeLocal;

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (manual || serverSearch || !q || !searchText) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, busqueda, searchText, manual, serverSearch]);

  const ordenadas = useMemo(() => {
    if (manual || !sort) return filtradas;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return filtradas;
    const sv = col.sortValue;
    return [...filtradas].sort((a, b) => compararConDireccion(sv(a), sv(b), sort.dir));
  }, [filtradas, sort, columns, manual]);

  const total = manual ? manual.total : ordenadas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const paginaActual = Math.min(manual ? manual.page : pageLocal, totalPaginas);
  const inicio = (paginaActual - 1) * pageSize;
  const visibles = manual ? ordenadas : ordenadas.slice(inicio, inicio + pageSize);

  // Al cambiar búsqueda, orden, tamaño o cantidad de filas se vuelve a la
  // primera página (por cantidad y no por identidad: las páginas suelen
  // recalcular el arreglo en cada render). En modo servidor lo decide la página.
  useEffect(() => {
    if (!manual) setPageLocal(1);
  }, [busqueda, sort, pageSize, rows.length, manual]);

  // Con debounce: sin esto, cada tecla dispara una consulta al servidor (una
  // RPC con ILIKE de comodín inicial, sin cancelar la anterior), así que
  // escribir un término de 10 caracteres lanzaría 10 búsquedas simultáneas.
  useEffect(() => {
    // El servidor solo trata NULL/'' como "sin filtro"; un término con
    // espacios de sobra (al final, o solo espacios) viaja tal cual dentro
    // del ILIKE y puede no matchear nada aunque el texto exista. El input
    // conserva lo que el usuario escribió tal cual.
    const t = setTimeout(() => onSearchChange?.(busqueda.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const irA = (n: number) => {
    const destino = Math.min(Math.max(1, n), totalPaginas);
    if (manual) manual.onPageChange(destino);
    else setPageLocal(destino);
  };

  const cambiarOrden = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return;
    const siguiente: DataTableSort | null =
      sort?.id !== col.id ? { id: col.id, dir: 'asc' } : sort.dir === 'asc' ? { id: col.id, dir: 'desc' } : null;
    if (manual) {
      manual.onSortChange(siguiente);
      return;
    }
    guardarPreferencia(storageKey, 'sort', siguiente);
    setSortLocal(siguiente);
  };

  const cambiarPageSize = (n: number) => {
    if (manual) {
      manual.onPageSizeChange(n);
      return;
    }
    setPageSizeLocal(n);
    guardarPreferencia(storageKey, 'pageSize', n);
  };

  const idsVisibles = selection ? visibles.map(rowKey) : [];
  const todosVisiblesSeleccionados = selection ? idsVisibles.length > 0 && idsVisibles.every((id) => selection.selected.has(id)) : false;
  const algunoVisibleSeleccionado = selection ? idsVisibles.some((id) => selection.selected.has(id)) : false;

  const alineacion = (a?: 'left' | 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className={cn('space-y-3', className)}>
      {/* Barra: búsqueda + filtros a la izquierda, contador + exportar a la derecha */}
      <div className="flex flex-wrap items-center gap-2">
        {searchText && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="pl-8 pr-8 h-10"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-live="polite">
            {total === 0 ? `0 ${itemLabel}` : `${inicio + 1}–${Math.min(inicio + pageSize, total)} de ${total} ${itemLabel}`}
            {selection && selection.selected.size > 0 ? ` · ${selection.selected.size} seleccionados` : ''}
          </span>
          {exportFileName && (
            <Button variant="outline" size="sm" onClick={() => exportarCSV(columns, ordenadas, exportFileName)} disabled={total === 0}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Tabla con scroll interno y encabezado fijo. min-w-max: si las columnas
          no caben, la tabla crece a su ancho real en vez de comprimirse, y
          scrollbar-x-visible hace evidente que hay una barra para deslizar. */}
      <div className="rounded-lg border overflow-auto scrollbar-x-visible" style={{ maxHeight }}>
        <Table className="text-sm min-w-max">
          {/* sticky va en cada th (en thead no funciona en todos los navegadores) */}
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted [&_th]:shadow-[inset_0_-1px_0_hsl(var(--border))] [&_tr]:border-b">
            <TableRow className="hover:bg-transparent">
              {selection && (
                <TableHead className="w-10 px-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary cursor-pointer"
                    aria-label="Seleccionar todas las filas visibles"
                    checked={todosVisiblesSeleccionados}
                    ref={(el) => {
                      if (el) el.indeterminate = !todosVisiblesSeleccionados && algunoVisibleSeleccionado;
                    }}
                    onChange={() => selection.onToggleMany(idsVisibles, !todosVisiblesSeleccionados)}
                  />
                </TableHead>
              )}
              {columns.map((col) => {
                const activa = sort?.id === col.id;
                const ordenable = !!col.sortValue;
                return (
                  <TableHead
                    key={col.id}
                    aria-sort={activa ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : ordenable ? 'none' : undefined}
                    className={cn('h-10 px-3 whitespace-nowrap font-semibold text-foreground', alineacion(col.align), col.headerClassName)}
                  >
                    {ordenable ? (
                      <button
                        type="button"
                        onClick={() => cambiarOrden(col)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                        title={activa ? (sort!.dir === 'asc' ? 'Orden ascendente · clic para descendente' : 'Orden descendente · clic para quitar') : 'Clic para ordenar'}
                      >
                        {col.header}
                        {activa ? (
                          sort!.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {selection && <TableCell className="px-3" />}
                  {columns.map((c) => (
                    <TableCell key={c.id} className="px-3 py-2.5">
                      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selection ? 1 : 0)} className="py-10 text-center text-muted-foreground">
                  {busqueda ? (
                    <>
                      Nada coincide con “{busqueda}”.{' '}
                      <button type="button" className="underline underline-offset-2" onClick={() => setBusqueda('')}>
                        Borrar búsqueda
                      </button>
                    </>
                  ) : (
                    emptyMessage
                  )}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((row) => {
                const id = rowKey(row);
                const seleccionada = selection?.selected.has(id);
                return (
                  <TableRow
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-state={seleccionada ? 'selected' : undefined}
                    className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
                  >
                    {selection && (
                      <TableCell className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary cursor-pointer"
                          aria-label="Seleccionar fila"
                          checked={!!seleccionada}
                          onChange={() => selection.onToggle(id)}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.id} className={cn('px-3 py-2 align-middle', alineacion(col.align), col.className)}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pie: tamaño de página + paginación */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            Por página
            <select
              value={pageSize}
              onChange={(e) => cambiarPageSize(Number(e.target.value))}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              aria-label="Filas por página"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {totalPaginas > 1 && (
            <nav className="flex items-center gap-1" aria-label="Paginación">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => irA(1)} disabled={paginaActual === 1} aria-label="Primera página">
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => irA(paginaActual - 1)} disabled={paginaActual === 1} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-muted-foreground">
                Página <span className="font-medium text-foreground">{paginaActual}</span> de {totalPaginas}
              </span>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => irA(paginaActual + 1)} disabled={paginaActual === totalPaginas} aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => irA(totalPaginas)} disabled={paginaActual === totalPaginas} aria-label="Última página">
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
