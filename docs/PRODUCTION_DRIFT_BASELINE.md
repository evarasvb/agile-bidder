# Línea base de drift GitHub ↔ Supabase

Fecha de observación: 2026-09-13  
Proyecto Supabase: `FirmaVB-PROD` (`juiskeeutbaipwbeeezw`)  
Repositorio: `evarasvb/agile-bidder`  
Commit base: `344470c27393d15aae2d61e8c7be4e98ccf7895f`

> Esta es una observación de solo lectura. La presencia en una lista no autoriza desplegar ni eliminar una función.

## Resumen

| Recurso | GitHub | Producción |
|---|---:|---:|
| Edge Functions | 74 | 88 |
| Migraciones SQL / historial | 217 archivos | 356 registros |

- 28 funciones están desplegadas pero no tienen un directorio canónico equivalente en `main`.
- 14 funciones están en `main` pero no aparecen desplegadas.
- Antes de cualquier cambio se debe clasificar cada diferencia como: productiva vigente, diagnóstico temporal, prueba, reemplazada u obsoleta.

## Desplegadas sin fuente canónica en main

| Función | Clasificación inicial |
|---|---|
| send-licitacion-to-odoo | Revisar; integración posiblemente retirada |
| asistente-lia | Revisar |
| procesar-oportunidades | Revisar |
| diag-mp-compras-agiles | Diagnóstico probable |
| diag-compra-agil | Diagnóstico probable |
| diag-ordenes | Diagnóstico probable |
| cotizacion-pdf | Productiva probable |
| test-ficha-mp | Prueba probable |
| academia-premium | Productiva probable |
| mp-webhook | Productiva probable |
| test-suscripcion-e2e | Prueba probable |
| diag-lic-items | Diagnóstico probable |
| diag-ca-detalle | Diagnóstico probable |
| sugerir-filtros | Productiva probable |
| importar-odoo | Revisar; integración posiblemente retirada |
| guardian | Productiva probable |
| experto-indexar | Núcleo Experto |
| experto-buscar | Núcleo Experto |
| experto-sync-dictamenes | Núcleo Experto |
| diag-gemini-modelos | Diagnóstico probable |
| experto | Núcleo Experto / posible versión anterior |
| explorar-fuente | Núcleo Experto |
| sii-contribuyente | Productiva probable |
| ca-detalle-muestra | Diagnóstico probable |
| probe-adjuntos | Diagnóstico probable |
| pexels-imagen | Auxiliar |
| mp-probe | Diagnóstico probable |
| tinyfish-test | Prueba explícita |

## En main pero no desplegadas

| Función | Clasificación inicial |
|---|---|
| apply-migration | Riesgo alto; revisar necesidad y permisos |
| apply-migrations | Riesgo alto; revisar necesidad y permisos |
| apply-rls-fix | Riesgo alto; revisar necesidad y permisos |
| chat-tender-ai | Posible versión anterior |
| create-user | Revisar |
| evaristo-autonomo | Auxiliar / revisar |
| match-opportunities | Posible versión anterior |
| process-tender-pdf | Posible versión anterior |
| resumir-bases | Posible versión anterior |
| send-notification | Revisar |
| sync-compras-agiles-csv | Importación manual / revisar |
| sync-health | Observabilidad / revisar |
| sync-ordenes-compra | Posible versión anterior |
| youtube-sync | Productiva o pendiente |

## Reglas para reconciliar

1. No descargar, copiar ni publicar secretos.
2. No desplegar código recuperado sin comparar configuración, versión y hash.
3. No eliminar funciones de producción por su nombre.
4. Confirmar invocadores antes de clasificar:
   - llamadas del frontend;
   - llamadas entre Edge Functions;
   - trabajos `pg_cron` y `pg_net`;
   - webhooks externos;
   - GitHub Actions;
   - extensiones y clientes activos.
5. Recuperar la fuente de cada función productiva en una rama separada.
6. Crear pruebas de contrato antes de reemplazar una función.
7. Para diagnósticos y pruebas:
   - verificar última invocación;
   - verificar secretos y permisos;
   - retirar acceso público antes de considerar eliminación.
8. Reconciliar migraciones como historial; nunca reejecutar automáticamente migraciones antiguas.

## Criterios de cierre de Fase 0

- Toda función productiva desplegada tiene fuente versionada.
- Cada función tiene dueño, propósito, autenticación e invocadores documentados.
- GitHub y producción tienen una diferencia explicada de cero recursos desconocidos.
- CI detecta altas, bajas y cambios de hash.
- Existe procedimiento de despliegue y rollback probado.
- Las funciones de prueba y diagnóstico no están expuestas innecesariamente.
