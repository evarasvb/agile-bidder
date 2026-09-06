---
name: bajo-el-agua
description: Modo Bajo el Agua. Investigación profunda de una licitación o compra ágil de Mercado Público (Chile) a partir de su ID. Deduce relaciones ocultas (historial del organismo, proveedor recurrente, convenio de suministro, compras ágiles y convenio marco del mismo producto, comisiones evaluadoras repetidas, lobby, desiertas o nulas, precio promedio, noticias, resoluciones, dictámenes), estudia las bases y anexos, arma la matriz de adjudicación y la simulación, y si ya está adjudicada busca por dónde renovarla. Usar cuando se diga "bajo el agua", "mira debajo del agua", "investiga la licitación ID", "qué hay detrás de esta licitación", "deep research licitación", o cuando el usuario pegue un ID de Mercado Público (formato 1234-56-LE24, 1234-56-LR24, 1234-56-LQ24, 1234-56-L124, 1234-56-COT24).
---

# Modo Bajo el Agua

Lo que se ve en la ficha es la superficie. Este modo busca lo que está debajo: quién compra, a quién le compra siempre, cómo evalúa, qué pasó las veces anteriores y qué precio gana. Se entrega como un informe de inteligencia accionable, en español, sin relleno.

Cargar también `ahorro-tokens` (siempre), `ventas-experto` (para la recomendación final) y `preparar-propuesta-mercado-publico` si se pide completar anexos.

## Regla de oro
Nunca inventar datos. Cada hallazgo lleva su fuente (URL o documento) y su fecha. Lo que no se pudo verificar se marca como `[NO VERIFICADO]` y se dice cómo verificarlo. Sin datos no hay conclusión, solo hipótesis marcada como tal.

## Fase 0. Identificar el caso
1. Normalizar el ID. Tipos por sufijo: LE/LP/LQ/LR (licitación pública por tramo), L1 (menor a 100 UTM), COT (compra ágil / cotización), CM (convenio marco).
2. Ficha pública: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=<ID>` (WebFetch). Si hay ticket de la API pública: `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=<ID>&ticket=<TICKET>`.
3. Extraer y guardar: organismo comprador (nombre, RUT, unidad, región), objeto, productos y códigos ONU de cada línea, cantidades, presupuesto estimado, fechas (publicación, preguntas, cierre, apertura, adjudicación), estado, criterios y ponderaciones, contactos (nombre y cargo de quien pregunta, quien evalúa, quien firma), garantías, tipo de contrato (único, suministro, marco), vigencia y renovación.
4. Estado del caso define el camino:
   - **Publicada / en evaluación**: fases 1 a 5 completas, objetivo ganar.
   - **Adjudicada / cerrada**: fases 1 a 4 más fase 6 (renovación).
   - **Desierta / revocada**: fases 1 a 3 más lectura de por qué (acta), objetivo anticipar la relicitación.

## Fase 1. Historial del organismo (lo que compra y a quién)
Fuentes: API pública de Mercado Público (licitaciones y órdenes de compra por código de organismo y por fecha), buscador de Mercado Público, datos abiertos de ChileCompra (`https://datos-abiertos.chilecompra.cl`), transparentin.com, analiza.mercadopublico.cl.

Buscar los últimos 3 a 5 años del mismo organismo con los mismos productos o códigos ONU o palabras clave del objeto:
- **Licitaciones anteriores del mismo objeto**: ID, año, monto, adjudicatario, número de oferentes, estado (adjudicada, desierta, revocada, nula). Si se repite cada 1 o 2 años, es una compra recurrente: anotar el mes en que se publica.
- **Convenio de suministro vigente**: si la licitación actual o una anterior es de suministro, cuánto dura y cuándo vence. La ventana de renovación es 3 a 6 meses antes del vencimiento.
- **Órdenes de compra** del organismo a proveedores del mismo rubro: montos, frecuencia, proveedor. Detectar el **proveedor de siempre** (más del 50 % de las órdenes del rubro) y calcular su precio unitario si el detalle está disponible.
- **Compras ágiles** del mismo producto en los últimos 12 meses: cuántas, a quién, a qué precio. Muchas compras ágiles del mismo producto anticipan una licitación o revelan el precio que el organismo acepta pagar.
- **Convenio marco**: si el organismo compra el producto por convenio marco (órdenes con origen CM), qué proveedor y qué precio. Si hay convenio marco disponible y aun así licita, preguntarse por qué (precio, especificación, exclusión).
- **Desiertas o nulas** del mismo objeto: leer el acta o resolución. Motivos típicos: sin oferentes, ofertas inadmisibles por documentos, precio sobre presupuesto, error en bases. Cada motivo es una oportunidad concreta.

Salida de la fase: tabla cronológica (fecha, ID, tipo, monto, adjudicatario, oferentes, estado, fuente) y tres conclusiones: recurrencia, proveedor dominante, precio histórico.

## Fase 2. Precio (lo que gana)
- Precio promedio de adjudicación del mismo producto en el organismo y en organismos comparables (misma región o mismo tipo: municipio, hospital, servicio). Al menos 5 casos si existen. Mostrar mínimo, promedio, máximo y el de la última adjudicación.
- Precio en convenio marco (catálogo vigente) como piso de referencia del comprador.
- Precio de compras ágiles recientes del organismo como techo de lo que acepta sin licitar.
- Convertir todo a la misma unidad (neto CLP por unidad) y fecha (ajustar por dólar o UTM si aplica, `https://mindicador.cl/api/dolar`, `/api/utm`).
- Si hay criterio precio con fórmula (menor precio / oferta × puntaje), simular el puntaje a 3 niveles: conservador (98 % del tope), recomendado (95 %), agresivo (90 %).

## Fase 3. Personas (quién decide)
- Contactos de la ficha: encargado de la licitación, comisión evaluadora (del acta si existe o de bases), quien firma la resolución de adjudicación.
- Buscar esas mismas personas en licitaciones anteriores del mismo producto (acta de evaluación y resolución en la ficha de cada licitación previa). Si la comisión se repite, sus criterios de evaluación pasados predicen los actuales: leer cómo puntuaron y qué observaciones hicieron.
- **Ley de Lobby**: buscar el organismo y las autoridades en `https://www.infolobby.cl` (audiencias por sujeto pasivo, últimos 12 a 24 meses). Anotar audiencias con proveedores del rubro: quién se reunió, cuándo, materia. Una audiencia previa del proveedor de siempre explica mucho.
- Si el usuario menciona "RF" u otra sigla que no está clara, preguntar una vez qué significa antes de buscar. No asumir.
- Solo datos públicos y de funciones públicas. Nada de datos personales privados ni juicios sobre las personas; describir hechos con fuente.

## Fase 4. Entorno (lo que rodea al caso)
- **Noticias**: buscar organismo + producto u objeto + últimos 12 meses (Google, prensa regional, diario oficial). Escándalos, recortes, cambios de autoridad, licitaciones cuestionadas.
- **Resoluciones**: resoluciones modificatorias en la ficha (cambian plazos y anexos, leerlas enteras), resolución de adjudicación o deserción de las anteriores, resoluciones en el portal de transparencia activa del organismo.
- **Dictámenes de Contraloría**: buscar en `https://www.contraloria.cl` (dictámenes y jurisprudencia) por organismo y materia (licitación, convenio marco, trato directo). Dictámenes que anularon adjudicaciones o corrigieron bases del organismo o de casos idénticos sirven como argumento en preguntas y reclamos.
- **Reclamos en Mercado Público** y decisiones del Tribunal de Contratación Pública sobre el organismo, si aparecen.

## Fase 5. Bases y anexos (cómo se gana)
- Descargar las bases y anexos desde la ficha (adjuntos). `pdftotext -layout` y lectura por secciones, según `preparar-propuesta-mercado-publico`, fase 2.
- Extraer criterios y ponderaciones, fórmula de precio, umbrales de admisibilidad, documentos obligatorios, garantías, plazos de entrega, multas, causales de inadmisibilidad.
- Detectar errores o ambigüedades de las bases (contradicción entre bases y anexos, fechas imposibles, criterios sin fórmula, referencias a marcas, exigencias desproporcionadas). Cada error es materia de pregunta en el foro o de reclamo, y en casos adjudicados puede ser base de impugnación.
- **Matriz de adjudicación**: tabla con cada criterio, ponderación, cómo se puntúa, puntaje máximo, puntaje que obtendría nuestra oferta (con supuestos explícitos) y puntaje estimado del proveedor dominante (a partir de su historial). Total y brecha.
- **Simulación**: con la fórmula de precio y los puntajes técnicos, calcular a qué precio se gana contra el competidor probable en tres escenarios. Marcar el punto donde bajar el precio ya no cambia el resultado.
- Ofrecer completar los anexos: si el usuario acepta, seguir `preparar-propuesta-mercado-publico` (fases 4 y 5), siempre como BORRADOR con pendientes resaltados.

## Fase 6. Caso adjudicado: por dónde se renueva
- Fecha de término del contrato o convenio actual, cláusulas de renovación o prórroga (en bases y contrato si está publicado). Ventana de acción: 3 a 6 meses antes.
- Leer la oferta ganadora y las perdedoras (adjuntos del acta y ofertas en la ficha si son públicas): precio, plazo, servicio, qué las diferenció. Puntaje por criterio de cada una.
- Errores en la adjudicación: bases notariales o administrativas mal aplicadas, puntajes mal calculados, documentos faltantes aceptados, plazos incumplidos. Con fuente exacta (página del acta). Sirven para reclamo dentro de plazo o para argumentar en la próxima.
- Lobby previo a la adjudicación (fase 3) y órdenes de compra posteriores: si el organismo sigue comprando el mismo producto fuera del contrato (compras ágiles o trato directo), hay demanda no cubierta y una puerta de entrada.
- Plan de renovación: fecha objetivo, contacto adecuado (cargo, no persona privada), oferta diferencial concreta, precio de entrada, argumento con datos.

## Entregable estándar (informe "Bajo el Agua")
Un solo documento, en este orden, máximo 3 páginas más anexos:
1. **Ficha**: ID, organismo, objeto, monto, estado, fechas clave, tipo de contrato.
2. **Lo que está debajo** (5 a 8 hallazgos, cada uno en una línea con dato y fuente): recurrencia, proveedor dominante y su cuota, compras ágiles y convenio marco del producto, desiertas anteriores y por qué, comisión repetida, lobby, noticias, dictámenes.
3. **Precio que gana**: tabla mínimo, promedio, máximo, última adjudicación, convenio marco, compra ágil. Precio recomendado en tres escenarios con puntaje simulado.
4. **Matriz de adjudicación** y simulación contra el competidor probable.
5. **Errores y palancas**: errores de las bases, preguntas a hacer en el foro, argumentos con dictámenes.
6. **Recomendación**: postular o no, con qué línea, a qué precio, qué diferenciar, y los 3 pendientes que bloquean.
7. **Si está adjudicada**: plan de renovación con fechas.
8. **Anexo de fuentes**: cada URL o documento consultado con fecha.
Marcar con `[NO VERIFICADO]` todo dato no confirmado y con `[DATO]` lo que falta de la empresa.

## Producto y plan (para cuando se construye en Agile Bidder)
- El modo es el gancho de conversión: el plan gratuito incluye 1 informe Bajo el Agua completo; después se muestra el resumen (ficha y 2 hallazgos) con la sección profunda bloqueada y un llamado a pasar de plan.
- Cuota por plan configurable en la base de datos (tabla de planes), nunca escrita en el código. Mostrar siempre "te quedan N informes este mes".
- Un informe se guarda y se puede reabrir sin gastar cuota. Volver a investigar el mismo ID gasta cuota solo si han pasado más de 7 días.
- Registrar cada uso: usuario, ID, fecha, duración, fuentes consultadas, resultado. Sirve para medir y para vender.
