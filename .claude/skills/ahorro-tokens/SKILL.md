---
name: ahorro-tokens
description: Reglas de trabajo frugal para gastar el mínimo de tokens en cada tarea. Cargar SIEMPRE al empezar cualquier tarea en estos repos (código, análisis, marketing, documentos). Se activa con "ahorra tokens", "modo económico", "barato", "rápido", o por defecto en cualquier trabajo.
---

# Ahorro de tokens

Objetivo: entregar el mismo resultado con la menor cantidad de lectura, escritura y conversación posible.

## Antes de tocar nada
- Orientarse en 1 o 2 comandos: `git status`, `ls` del directorio relevante, `grep -rn` del símbolo. No listar todo el repo.
- Leer solo la parte del archivo que se necesita (`sed -n 'A,Bp'` o `Read` con offset/limit). Nunca leer un archivo completo de más de 300 líneas sin motivo.
- No releer archivos ya leídos en la sesión. No re-verificar ediciones que ya fueron aceptadas.
- Si la tarea toca más de 5 archivos o necesita explorar, delegar la búsqueda a un subagente `Explore` y quedarse solo con la conclusión.

## Mientras se trabaja
- Ediciones quirúrgicas con `Edit`, nunca reescribir archivos enteros.
- Un comando por objetivo. Encadenar con `&&` y filtrar la salida con `grep`, `head`, `tail`, `wc`. Nunca imprimir logs completos, `package-lock.json`, CSV, JSON grandes ni `node_modules`.
- Reutilizar lo que existe en el repo (componentes, helpers, estilos) antes de crear algo nuevo.
- Hacer las llamadas independientes en paralelo en un mismo turno.
- No instalar dependencias nuevas si la tarea se resuelve con lo que ya hay.
- Correr solo los tests o el lint del paquete afectado, no toda la suite, salvo antes de un push.

## Al responder
- El usuario no programa. Responder en español, corto, sin código en el texto salvo que lo pida. Decir qué se hizo, dónde verlo y qué falta.
- Sin resúmenes de lo que ya se dijo, sin repetir el plan, sin listas de opciones que no se van a ejecutar.
- Recomendar una opción, no un menú.

## Documentación
- No crear archivos `.md` nuevos por cada tarea. Actualizar el README o el documento existente si hace falta. Este repo ya tiene demasiados documentos sueltos.
- Commits con mensaje de una línea claro. Sin PR salvo que se pida.

## Costos externos (Vercel, Supabase, APIs)
- Antes de crear recursos pagos (proyectos, funciones, dominios, créditos), avisar el costo y esperar confirmación.
- Preferir planes gratis, cache, ISR y consultas indexadas. Ver skill `vercel-optimize` para reducir la cuenta de Vercel.
