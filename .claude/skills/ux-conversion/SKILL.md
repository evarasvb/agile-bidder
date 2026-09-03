---
name: ux-conversion
description: Experto en UX y conversión (CRO) para tiendas y apps web. Usar al diseñar o revisar pantallas, landings, formularios, checkout, catálogo, onboarding, dashboards, o cuando se pida "que se vea profesional", "que venda más", "mejorar la experiencia", "revisar UX". Complementa a frontend-design y web-design-guidelines.
---

# UX y conversión

Antes de diseñar: cargar `frontend-design` para la dirección visual y `web-design-guidelines` para la auditoría técnica. Esta skill aporta el criterio de negocio: que cada pantalla lleve al usuario a una acción.

## Checklist de conversión (aplicar a cada pantalla)
1. **Una acción principal** visible sin scroll, con verbo ("Agregar al carrito", "Cotizar ahora"). Las secundarias en gris o texto.
2. **Claridad en 5 segundos**: qué es, para quién, qué gano. Titular en lenguaje del cliente, no del sistema.
3. **Fricción mínima**: pedir solo los datos imprescindibles. Compra sin registro. Autocompletar dirección. Guardar el carrito.
4. **Confianza**: precios con IVA claros, costo de despacho antes del checkout, medios de pago visibles, contacto por WhatsApp visible, política de cambio en una línea.
5. **Velocidad percibida**: skeletons, imágenes optimizadas (`next/image`), sin layout shift, respuesta inmediata al hacer clic.
6. **Móvil primero**: 70 % del tráfico en Chile es móvil. Botones de 44 px mínimo, formularios de una columna, sticky CTA en producto.
7. **Estados vacíos y errores** que digan qué hacer a continuación, nunca "Error 500" ni pantalla en blanco.
8. **Accesibilidad**: contraste AA, foco visible, labels en inputs, textos alternativos. Es UX y también SEO.

## Patrones para e-commerce (Tenute)
- Ficha de producto: foto grande, precio y stock arriba, CTA sticky en móvil, descuento por cantidad visible para mayoristas, productos relacionados.
- Catálogo: filtros por categoría y precio, búsqueda con tolerancia a errores, orden por relevancia, 12 a 24 por página.
- Checkout: 1 página o 3 pasos con indicador, resumen siempre visible, opción de retiro en tienda, confirmación por WhatsApp o email.
- Carrito abandonado: recordatorio a las 2 horas y a las 24 horas si hay email.

## Patrones para herramientas B2B (Agile Bidder)
- Dashboard: primero lo urgente (licitaciones que cierran hoy), luego lo importante. Números grandes con tendencia.
- Tablas: búsqueda, filtros guardados, acciones en fila, paginación, exportar.
- Flujos largos (postular): guardar progreso automáticamente, mostrar qué falta, permitir volver.
- Cada acción destructiva con confirmación y deshacer cuando sea posible.

## Cómo entregar
- Al revisar: lista de hallazgos ordenada por impacto en ventas, con la corrección concreta de cada uno. Máximo 10.
- Al diseñar: primero la jerarquía (qué ve el usuario primero, segundo, tercero), luego el componente. Reutilizar componentes y estilos existentes del repo.
- Medir: proponer el evento a registrar (clic en CTA, inicio de checkout, compra) para saber si la mejora funcionó.
