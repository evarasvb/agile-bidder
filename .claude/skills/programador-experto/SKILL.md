---
name: programador-experto
description: Estándares de programación experta para estos repos (Next.js o Vite + React + TypeScript + Tailwind + Supabase + Vercel). Cargar al escribir, corregir o revisar código, migraciones, componentes, APIs, o al hacer deploy. Se activa con "programa", "arregla", "agrega", "crea", "deploy", "bug", "error", "migración".
---

# Programador experto

El usuario no programa: el código debe funcionar a la primera, quedar desplegado y explicarse en una frase. Cargar también `ahorro-tokens` (siempre), `vercel-react-best-practices` (React/Next), `supabase` y `supabase-postgres-best-practices` (base de datos), `frontend-design` y `ux-conversion` (pantallas), `webapp-testing` (verificar en navegador).

## Flujo de trabajo
1. Entender el pedido en términos de negocio y confirmar el supuesto en una línea.
2. Buscar cómo se hace algo parecido en el repo y copiar el patrón (componentes, hooks, queries, estilos).
3. Cambio mínimo que resuelve el pedido completo. Sin refactors no pedidos.
4. Verificar: `npm run lint` y `npx tsc --noEmit` en el paquete tocado; `npm run build` antes de push si se tocó configuración, rutas o dependencias. Si hay UI, probar en navegador con Playwright y mirar la consola.
5. Commit claro, push a la rama indicada. Sin PR salvo pedido explícito.
6. Reportar en español: qué cambió, dónde verlo (URL o pantalla), qué falta o qué decisión queda pendiente.

## Reglas de código
- TypeScript estricto, sin `any` nuevos. Tipos junto al uso o en `types/`.
- Componentes de servidor por defecto en Next App Router; `"use client"` solo cuando hay estado, eventos o hooks de navegador.
- Datos: consultas a Supabase con selección de columnas explícita, filtros e índices; nunca `select('*')` en listados grandes. RLS activado en toda tabla nueva.
- Secretos solo en variables de entorno. Nunca escribir claves en el código ni en documentos. Claves `service_role` solo en servidor.
- Errores manejados con mensaje útil para el usuario y log para el desarrollador.
- Nombres en inglés en código, textos de interfaz en español chileno.
- Tailwind con las clases y tokens ya usados en el repo; no crear CSS nuevo si hay una clase existente.
- Sin dependencias nuevas sin justificar en el mensaje final.
- Migraciones SQL idempotentes (`if not exists`), en la carpeta `supabase/migrations` cuando exista, con nombre fechado.

## Seguridad mínima
- Validar entrada en servidor (zod o validación manual). Nunca confiar en el cliente.
- Autorización en cada ruta o acción de servidor. Revisar que un usuario no pueda ver datos de otro.
- No exponer stack traces ni IDs internos en respuestas.

## Deploy
- Vercel despliega solo desde `main`. Confirmar que el build local pasa antes de tocar `main`.
- Variables de entorno nuevas: agregarlas a `.env.example` y avisar que hay que cargarlas en Vercel y Supabase.
