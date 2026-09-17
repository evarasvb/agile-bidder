# Lanzamiento del Experto: Beta 10

La fase activa es `beta_10`: las primeras 10 cuentas que entran al Experto
reciben acceso equivalente a Plus. Crear una cuenta o visitar `/planes` no
consume cupo. El visitante anónimo mantiene un resultado para probar.

Durante esta fase:

- la prueba Pro de 14 días figura como no disponible y su RPC rechaza intentos;
- `/planes`, la cuenta y los límites del Experto no muestran precios ni checkout;
- `crear-pago-experto` rechaza `pro_30` y `plus_30`, pero no afecta facturas ERP;
- chat, informes, Bajo el Agua, estudio, matriz y anexos pueden reclamar un cupo;
- `experto_beta_metricas()` permite revisar adopción y uso con `service_role`.

## Revisar avance

```sql
select * from public.experto_lanzamiento_publico();
select * from public.experto_beta_metricas(); -- solo operación interna
```

## Activar monetización más adelante

La implementación de resultado gratis, prueba de 14 días y Mercado Pago se
conserva. Cuando el producto esté afinado, el cambio de fase es deliberado:

```sql
update public.experto_lanzamiento_config
set fase = 'monetizacion', updated_at = now()
where id = 1;
```

Antes de ejecutar ese cambio en producción hay que validar el flujo completo en
preview: resultado anónimo, registro, prueba, expiración y pago aprobado.
