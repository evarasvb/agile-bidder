# Cálculo de licitaciones por lotes — propuesta sin activar

## Problema y cambio

El 13 de octubre de 2026 las tres ejecuciones más recientes del proceso de licitaciones
se cancelaron a los 15 minutos. La base contenía 20.252 ítems abiertos y cinco
empresas con inventario. El proceso actual recalcula todas las empresas en una
única transacción: un timeout impide conservar el avance del conjunto.

La propuesta procesa una empresa y un máximo configurable de ítems por llamada,
con cursor persistente, bloqueo de fila y reintento con espera creciente. Cada lote
reemplaza únicamente sus propias coincidencias dentro de una transacción. Un error
conserva las filas anteriores y el cursor. Se conserva el motor `match_sim_v3` vigente,
el umbral y la búsqueda de candidatos del inventario de la propia empresa.

La cola vive en un esquema interno, sin permisos para usuarios de la aplicación.
Las funciones usan SECURITY INVOKER y están disponibles solo para service_role y
el propietario. No se exponen endpoints ni se permiten cálculos de otras empresas
desde el navegador.

## Validación

Ejecutar `npm ci --ignore-scripts` y `npm run test:lic-batches` dentro de
`supabase/proposals/tests`. Nueve escenarios verifican límites de lote, avance entre
empresas, rollback, reanudación, aislamiento, nuevo ciclo, limpieza, validación de
parámetros y restricciones de acceso.

La prueba utiliza PostgreSQL Wasm y pg_trgm real, pero un scorer y operador de distancia
sintéticos. No demuestra el rendimiento del motor vectorial de producción ni la
concurrencia de pg_cron. Dos EXPLAIN ANALYZE de solo lectura sobre diez ítems y la empresa
con más inventario tardaron 10,61 s con candidatos ANN actuales y 8,54 s con una variante
de embeddings materializados por empresa. La variante no se incorpora: requiere
validar memoria, equivalencia de resultados y comportamiento con otros inventarios.
Estas mediciones no aplican las opciones HNSW locales del worker y no equivalen al
tiempo total de escritura. Se propone iniciar el piloto con diez ítems, no cien.

## Activación controlada

1. Revisar e instalar `lic_match_batches.sql`, sin activar el cron.
2. Medir un lote piloto completo con el motor real, revisar los productos compatibles,
   y verificar que avanza el cursor. Ajustar el límite solo a partir de esas medidas.
3. Comprobar privilegios de service_role sobre las tablas existentes y el motor de scoring.
4. Aplicar `lic_match_batches_enable.sql` cuando el proceso anterior esté inactivo.
   Reemplaza el cron antiguo por una llamada cada diez segundos, con timeout de 120 s.
   La cola debe monitorizarse: un resultado retry puede coexistir con cron.status=succeeded.
5. Revisar last_error, failure_count, last_success_at y last_cycle_completed_at.
   Un ciclo completo debe terminar para cada empresa antes de comunicar que está actualizado.

El cron ejecuta una instancia de un mismo job a la vez; el intervalo no garantiza una
llamada completada cada diez segundos. Un piloto de diez ítems puede tardar horas en
recorrer todos los productos: no se promete actualización horaria. Hace falta medir
throughput y optimizar el motor antes de decidir el tamaño y la concurrencia final.
Los ítems añadidos por debajo del cursor UUID entran en el ciclo siguiente.

`lic_match_batches_rollback.sql` detiene el nuevo cron y conserva los matches y el
avance de la cola. Restaurar el cron anterior reintroduce su timeout conocido.

No se ha instalado ni activado esta propuesta en producción. Faltan búsquedas múltiples,
unificar vista previa y alertas, y mostrar el estado del recálculo en la aplicación.
