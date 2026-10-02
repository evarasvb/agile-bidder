/**
 * Columnas de `cliente_inventario` que el navegador necesita.
 *
 * POR QUÉ EXISTE ESTO: la tabla tiene una columna `embedding` de tipo
 * vector(1024). Con `select('*')` PostgREST la serializa y la manda al
 * navegador, donde no se puede usar para nada: la búsqueda semántica corre en
 * el servidor (función `embed-consulta` + RPC `buscar_inventario_semantico`),
 * nunca en el cliente.
 *
 * Medido el 2 de octubre de 2026 sobre un inventario de 16.359 productos:
 *
 *   select('*')  ->  4.369 kB por página de 1.000 filas
 *                    de los cuales 4.004 kB (92%) son los vectores
 *   select del catálogo completo (paginado) -> 70 MB, 64 MB de vectores
 *
 * Es decir: nueve de cada diez bytes que el usuario esperaba eran basura para
 * la interfaz. Y se lee de disco en cada carga, así que también pegaba en el
 * presupuesto de Disk IO del proyecto.
 *
 * MANTENIMIENTO: si se agrega una columna a `cliente_inventario` y hace falta
 * en el frontend, agrégala acá. Si la columna nueva es otro vector o un blob,
 * NO la agregues. Nunca volver a `select('*')` sobre esta tabla.
 */
export const COLUMNAS_INVENTARIO = [
  'id',
  'cliente_id',
  'sku',
  'nombre',
  'nombre_producto',
  'nombre_norm',
  'descripcion',
  'categoria',
  'marca',
  'proveedor',
  'precio_unitario',
  'precio_licitacion',
  'margen_minimo',
  'stock_disponible',
  'unidad_medida',
  'tiempo_entrega',
  'palabras_clave',
  'busqueda_match',
  'imagen_url',
  'codigo_producto',
  'codigo_onu',
  'codigo_onu_confianza',
  'codigo_onu_metodo',
  'codigo_onu_votos',
  'codigo_onu_en',
  'created_at',
  'updated_at',
].join(', ');
