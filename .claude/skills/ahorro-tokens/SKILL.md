---
name: ahorro-tokens
description: Reglas de trabajo frugal para gastar el mínimo de tokens en cada tarea (código, datos, investigación web, depuración, subagentes). Cargar SIEMPRE al empezar cualquier tarea en estos repos. Se activa con "ahorra tokens", "modo económico", "barato", "rápido", o por defecto en cualquier trabajo.
---

# Ahorro de tokens

Objetivo: el mismo resultado con la menor lectura, escritura y conversación posible. Cada token que no aporta al resultado es un token de más.

## Antes de tocar nada
- Orientarse en 1 o 2 comandos: `git status`, `ls` del directorio relevante, `grep -rn` del símbolo. No listar todo el repo.
- Leer solo la parte del archivo que se necesita (`Read` con offset/limit o `sed -n 'A,Bp'`). Nunca un archivo completo de más de 300 líneas sin motivo.
- No releer archivos ya leídos en la sesión. No re-verificar ediciones aceptadas. No pedir `git diff` de lo que uno mismo acaba de escribir.
- Si la tarea toca más de 5 archivos o hay que explorar, delegar la búsqueda a un subagente `Explore` con modelo `haiku` y quedarse solo con la conclusión.

## Modelo según la tarea (regla de Evaristo, 2026-09-17)
- Simple → subagente `haiku`: desplegar edge functions, leer logs, revisar estado de PR o workflows, consultar cifras de la base, buscar archivos, renombrar, mover, verificar que algo existe, resumir una página web.
- Mediano → `sonnet`: cambios acotados de código, tests, redacción de PR, extracción de datos con reglas claras.
- Complejo → modelo principal: diseñar, decidir, depurar bugs difíciles, migraciones con riesgo, prompts del Experto y de Don Evaristo, revisar lo que entregan los subagentes.
- Al delegar: prompt corto con el objetivo, los archivos exactos y el formato de respuesta pedido ("responde en máximo 10 líneas, sin pegar contenido de archivos"). El subagente devuelve conclusiones, no volcados.
- En la app igual: Gemini flash-lite para chat y saludos; modelos grandes solo para informes y estudios profundos.

## Programar barato
- Ediciones quirúrgicas con `Edit`; reescribir un archivo entero solo si es propio y corto.
- Un comando por objetivo. Encadenar con `&&` y filtrar la salida con `grep`, `head`, `tail`, `wc`. Nunca imprimir logs completos, `package-lock.json`, CSV, JSON grandes ni `node_modules`.
- Reutilizar lo que existe (componentes, helpers, RPCs, estilos) antes de crear algo nuevo. No instalar dependencias si se resuelve con lo que hay.
- Llamadas independientes en paralelo en un mismo turno; encadenar solo las que dependen de otra.
- Validar con lo mínimo que da certeza: `tsc` filtrado por los archivos tocados, lint del archivo, build una sola vez antes del push. Tests solo del paquete afectado, salvo antes de un push.
- Herramientas MCP que devuelven listas enormes (p. ej. listar todas las edge functions, todas las tablas) se evitan; consultar lo puntual con SQL o el endpoint específico.

## Extraer y depurar información
- Primero contar, después mirar: `count(*)`, agregados y `group by` antes de pedir filas. Filas siempre con `limit` (5 a 20) y solo las columnas necesarias; `left(texto, 200)` para textos largos.
- Un diagnóstico = una hipótesis por consulta. Formular la pregunta antes de consultar, no "traer todo y ver".
- Logs: filtrar por función, código de estado y ventana de tiempo; `tail` de 20 a 60 líneas; nunca el log completo. Con `failed_only` cuando existe.
- Reproducir el bug con la llamada más chica posible (una petición, un registro) antes de leer código; leer solo el tramo de código que la traza señala.
- Esquemas: `information_schema.columns` de la tabla exacta, no dumps de todo el esquema. Definiciones de funciones con `left(pg_get_functiondef(...), N)`.
- Guardar en una nota corta (scratchpad) los hallazgos clave de una investigación larga para no rehacer consultas.

## Investigar en la web
- Buscar antes de navegar: `WebSearch` con una consulta precisa y leer los fragmentos; abrir la página solo si el fragmento no basta.
- `WebFetch` siempre con una pregunta concreta ("extrae X, Y y Z; responde en 5 líneas"), nunca "resume la página". Máximo 3 páginas por pregunta; si hacen falta más, delegar a un subagente `haiku` que devuelva una tabla de hallazgos.
- No volver a abrir una página ya leída en la sesión; anotar lo extraído.
- Sitios con captcha, login o bloqueados: no insistir. Decirlo y proponer la vía (API, extensión, subida manual).
- Preferir fuentes primarias y estructuradas (API, JSON, CSV) sobre HTML; preferir documentación oficial sobre foros.

## Al responder
- El usuario no programa. Responder en español, corto, sin código en el texto salvo que lo pida. Decir qué se hizo, dónde verlo y qué falta.
- Sin resúmenes de lo ya dicho, sin repetir el plan, sin listas de opciones que no se van a ejecutar. Recomendar una opción, no un menú.
- Los avisos automáticos (bots de Vercel, notificaciones repetidas) se atienden en silencio; solo se reporta lo que cambia una decisión.
- Antes de cerrar un turno con un mensaje, preguntarse: ¿esto le sirve a Evaristo para decidir algo? Si no, una línea o nada.

## Seguimiento automático
- Chequeos de PR cada 3 horas, hechos por un subagente `haiku`; el principal solo entra si hay algo que corregir. Se cortan al mergear o cerrar la PR.
- Nunca dormir ni sondear en bucle: usar recordatorios programados y esperar los eventos.

## Documentación
- No crear archivos `.md` nuevos por cada tarea. Actualizar el README o el documento existente si hace falta.
- Commits con mensaje de una línea claro. Sin PR salvo que se pida o el flujo del repo lo exija.

## Costos externos (Vercel, Supabase, APIs)
- Antes de crear recursos pagos (proyectos, funciones, dominios, créditos), avisar el costo y esperar confirmación.
- Preferir planes gratis, cache, ISR y consultas indexadas. Ver skill `vercel-optimize` para reducir la cuenta de Vercel.
