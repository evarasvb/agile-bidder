# Estacionalidad de las compras del Estado de Chile, año 2025

Fuente: datos abiertos de ChileCompra (órdenes de compra y licitaciones, archivos mensuales 2025). Generado el 2026-09-26. Montos en pesos chilenos: M = millones, MM = miles de millones.

## Metodología

- OC deduplicadas por Codigo; MontoTotalOC_PesosChilenos sumado una vez por OC.
- Mes asignado por FechaEnvio de la OC (no por archivo); OC con FechaEnvio fuera de 2025 se excluyen.
- Monto por rubro/producto: el monto total de la OC se reparte entre sus líneas en proporción a totalLineaNeto; la cantidad de OC por rubro cuenta cada OC una vez por rubro.
- Comparaciones de fin de año: mes vs promedio mensual de enero–octubre.
- Licitaciones deduplicadas por Codigo; mes según FechaPublicacion.
- Se excluyen como errores de digitación las OC con MontoTotalOC_PesosChilenos superior a 1 billón de pesos y las OC en UTM o UF cuyo equivalente supera 20.000 millones de pesos (monto ingresado en pesos en vez de UTM/UF); se listan en control_oc_atipicas_excluidas.

Notas de procesamiento:

- Se excluyeron 22 OC atípicas por CLP 27,407,046,919,454 (monto > 1 billón, o en UTM/UF con equivalente > 20.000 millones: monto digitado en pesos); se listan en control_oc_atipicas_excluidas.
- Licitaciones: 100532 únicas en los archivos; 100532 con FechaPublicacion en 2025 (el resto tienen otra fecha de publicación y se excluyen de las series por mes de publicación).

### OC atípicas excluidas (22; las 25 mayores, lista completa en el JSON)

| Código | Fecha | Monto CLP | Monto original | Moneda | Organismo | Nombre |
|---|---|---:|---:|---|---|---|
| 2560-3-SE25 | 2025-01-08 | 15,744,671,499,995 | 233499999,999931 | UTM | I MUNICIPALIDAD DE LAS CONDES | Decreto 4738 (Aumento 2560-32-LR22) |
| 2667-1450-SE24 | 2025-01-08 | 9,093,384,018,048 | 135129194,55 | UTM | I MUNICIPALIDAD DE VITACURA | CONTROL DE SOTOBOSQUE Y REPOSICIÓN DE MATERIAL VEG |
| 2667-413-SE25 | 2025-05-28 | 391,870,668,818 | 5708406,2 | UTM | I MUNICIPALIDAD DE VITACURA | Recuperación de sist. de imp. A.P., S.M. Ambiente |
| 1395481-9-SE25 | 2025-06-26 | 285,696,028,540 | 7278624 | CLF | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | SEGURO DE VIDA Y SALUD SERV. BIENESTAR Gran Compra |
| 2667-414-SE25 | 2025-05-28 | 224,317,280,230 | 3267644,8 | UTM | I MUNICIPALIDAD DE VITACURA | Recuperación de sist. ext. de A.S., Punto Limpio. |
| 3833-1046-SE25 | 2025-12-29 | 208,200,768,967 | 5242180,86 | CLF | I MUNICIPALIDAD DE RIO BUENO | ARRIENDO VEHICULOS |
| 3833-784-SE25 | 2025-10-14 | 206,272,425,799 | 5221295,17 | CLF | I MUNICIPALIDAD DE RIO BUENO | ARRIENDO VEHICULOS |
| 3833-729-SE25 | 2025-09-26 | 205,630,657,140 | 5207731,55 | CLF | I MUNICIPALIDAD DE RIO BUENO | ARRIENDO VEHICULOS |
| 3833-520-SE25 | 2025-07-17 | 203,827,684,001 | 5192391,26 | CLF | I MUNICIPALIDAD DE RIO BUENO | ARRIENDO DE VEHICULOS |
| 3833-609-SE25 | 2025-08-19 | 203,268,622,568 | 5180748,3 | CLF | I MUNICIPALIDAD DE RIO BUENO | ARRIENDO VEHICULOS |
| 2423-508-SE25 | 2025-04-09 | 171,192,840,773 | 4396978,6 | CLF | I MUNICIPALIDAD DE PUENTE ALTO | Solución Computacional Permisos de Circulación |
| 2699-120-SE25 | 2025-12-31 | 169,523,516,207 | 4267520,88 | CLF | I MUNICIPALIDAD DE LA REINA | ORDEN DE COMPRA DESDE 2699-43-LR25 |
| 4707-257-SE25 | 2025-07-02 | 32,711,652,941 | 833000 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO LOCKERS MES DE JULIO |
| 2667-1237-SE24 | 2025-01-06 | 32,656,334,094 | 490622,6483144 | UTM | I MUNICIPALIDAD DE VITACURA | CONCESIÓN SERVICIOS DE RECOLECCIÓN DE RESIDUOS DOM |
| 4707-203-SE25 | 2025-06-04 | 32,651,127,031 | 833000 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO CASILLEROS PARA MEDICAMENTOS |
| 4707-305-SE25 | 2025-08-12 | 32,617,013,078 | 833000 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO DE LOCKERS MES DE AGOSTO |
| 4707-160-SE25 | 2025-05-05 | 32,571,464,898 | 833000 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO LOCKERS MES DE MAYO |
| 4707-121-SE25 | 2025-04-03 | 32,407,139,379 | 833000 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO LOCKERS MES DE ABRIL |
| 2560-105-SE25 | 2025-11-28 | 28,240,225,715 | 406088,77678908 | UTM | I MUNICIPALIDAD DE LAS CONDES | ORDEN DE COMPRA DESDE 2560-1-LR25 |
| 2560-81-SE25 | 2025-11-27 | 27,926,760,064 | 403187,180592 | UTM | I MUNICIPALIDAD DE LAS CONDES | ORDEN DE COMPRA DESDE 2560-1-LR25 |
| 4707-345-SE25 | 2025-09-03 | 25,158,631,530 | 638633,73 | CLF | I MUNICIPALIDAD DE SAN NICOLAS | ARRIENDO DE CASILLEROS MES DE SEPTIEMBRE |
| 4127-236-SE25 | 2025-06-12 | 22,250,559,638 | 567364,330001 | CLF | SUBSECRETARIA DE SALUD PUBLICA | [GABSRA] SC N°1222 EXP.36073/2025 REGULARIZA SERVI |

## 1. Órdenes de compra por mes

Total 2025: **1,856,065 OC** por **CLP 18,390,849,167,258** (18.39 billones).

| Mes | OC | % OC | Monto | % monto | Monto prom./OC | AG OC / monto | CM OC / monto | SE OC / monto | TD OC / monto |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| enero | 139,428 | 7.51% | $2,562.0 MM | 13.93% | $18 M | 46,745 / $73,967 M | 14,218 / $60,183 M | 67,494 / $2,294.7 MM | 10,080 / $128.7 MM |
| febrero | 126,153 | 6.8% | $2,515.8 MM | 13.68% | $20 M | 50,250 / $77,454 M | 11,678 / $57,722 M | 53,309 / $2,269.8 MM | 10,220 / $106.3 MM |
| marzo | 148,998 | 8.03% | $1,955.6 MM | 10.63% | $13 M | 61,165 / $90,172 M | 15,908 / $63,316 M | 59,839 / $1,625.3 MM | 11,339 / $164.6 MM |
| abril | 161,768 | 8.72% | $1,511.5 MM | 8.22% | $9 M | 69,408 / $100.4 MM | 16,542 / $66,206 M | 62,728 / $1,203.8 MM | 12,323 / $136.3 MM |
| mayo | 156,805 | 8.45% | $1,231.0 MM | 6.69% | $8 M | 66,336 / $93,644 M | 16,359 / $58,739 M | 61,900 / $797.4 MM | 11,409 / $276.3 MM |
| junio | 155,257 | 8.36% | $1,350.1 MM | 7.34% | $9 M | 65,266 / $90,843 M | 15,877 / $61,360 M | 62,020 / $981.8 MM | 11,347 / $205.7 MM |
| julio | 164,086 | 8.84% | $1,230.3 MM | 6.69% | $7 M | 68,480 / $95,412 M | 17,910 / $64,820 M | 65,323 / $863.0 MM | 11,513 / $199.8 MM |
| agosto | 159,543 | 8.6% | $1,271.3 MM | 6.91% | $8 M | 67,562 / $89,324 M | 16,727 / $65,959 M | 63,053 / $889.7 MM | 11,501 / $223.2 MM |
| septiembre | 150,019 | 8.08% | $1,139.2 MM | 6.19% | $8 M | 64,645 / $86,775 M | 15,555 / $57,902 M | 58,924 / $783.6 MM | 10,145 / $206.1 MM |
| octubre | 170,511 | 9.19% | $1,205.4 MM | 6.55% | $7 M | 76,209 / $100.6 MM | 18,212 / $66,023 M | 64,460 / $849.3 MM | 10,728 / $186.3 MM |
| noviembre | 168,212 | 9.06% | $1,014.2 MM | 5.51% | $6 M | 77,346 / $102.2 MM | 16,492 / $64,416 M | 63,070 / $705.0 MM | 10,460 / $123.4 MM |
| diciembre | 155,285 | 8.37% | $1,404.4 MM | 7.64% | $9 M | 66,826 / $98,550 M | 13,378 / $66,727 M | 63,467 / $1,033.4 MM | 10,669 / $197.5 MM |

Tipos de OC en el año:

| Tipo | Descripción | OC | % OC | Monto | % monto |
|---|---|---:|---:|---:|---:|
| AG | Compra ágil | 780,238 | 42.04% | $1,099.3 MM | 5.98% |
| SE | Licitación (sin emisión automática) | 745,587 | 40.17% | $14,296.6 MM | 77.74% |
| CM | Convenio marco | 188,856 | 10.18% | $753.4 MM | 4.1% |
| TD | Trato directo | 131,734 | 7.1% | $2,154.2 MM | 11.71% |
| CC | Compra coordinada / cotización | 9,404 | 0.51% | $81,514 M | 0.44% |
| CT | Contrato | 246 | 0.01% | $5,869 M | 0.03% |

### Las 20 OC más grandes del año (incluidas en el estudio)

| # | Código | Fecha | Monto | Organismo | Rubro |
|---:|---|---|---:|---|---|
| 1 | 85-429-SE24 | 2025-02-04 | $403.6 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Productos de papel |
| 2 | 85-98-SE25 | 2025-04-09 | $314.4 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 3 | 85-428-SE24 | 2025-02-04 | $252.8 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Productos de papel |
| 4 | 85-43-SE25 | 2025-01-24 | $244.5 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 5 | 85-87-SE25 | 2025-03-31 | $235.5 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 6 | 1186229-166-SE25 | 2025-06-24 | $229.2 MM | SERVICIO DE REGISTRO CIVIL E IDENTIFICACION | Servicios basados en ingeniería, ciencia |
| 7 | 85-37-SE25 | 2025-01-24 | $211.5 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 8 | 85-45-SE25 | 2025-01-24 | $207.4 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 9 | 85-97-SE25 | 2025-03-31 | $197.9 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 10 | 85-89-SE25 | 2025-03-31 | $193.0 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 11 | 85-32-SE25 | 2025-01-24 | $131.0 MM | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 12 | 1057973-2-SE25 | 2025-01-08 | $106.3 MM | SERVICIO DE SALUD METROPOLITANO SUR ORIENTE | Servicios de construcción y mantenimient |
| 13 | 85-33-SE25 | 2025-01-24 | $70,973 M | JUNTA NACIONAL DE AUXILIO ESCOLAR Y BECA | Organizaciones y consultorías políticas, |
| 14 | 591-6822-TD25 | 2025-09-26 | $59,829 M | FONDO NACIONAL DE SALUD | Educación, formación, entrenamiento y ca |
| 15 | 3929-36-SE25 | 2025-05-16 | $55,616 M | I MUNICIPALIDAD DE VINA DEL MAR | Servicios de limpieza industrial |
| 16 | 621-446-TD25 | 2025-05-16 | $51,346 M | CENTRAL DE ABASTECIMIENTO DEL SISTEMA NACIONA | Medicamentos y productos farmacéuticos |
| 17 | 1057973-3-SE25 | 2025-01-08 | $49,039 M | SERVICIO DE SALUD METROPOLITANO SUR ORIENTE | Servicios de construcción y mantenimient |
| 18 | 2671-4-SE25 | 2025-05-15 | $48,789 M | I MUNICIPALIDAD DE CONCEPCION | Servicios de limpieza industrial |
| 19 | 621-186-TD25 | 2025-03-19 | $47,713 M | CENTRAL DE ABASTECIMIENTO DEL SISTEMA NACIONA | Medicamentos y productos farmacéuticos |
| 20 | 591-7466-SE25 | 2025-08-07 | $46,390 M | FONDO NACIONAL DE SALUD | Salud, servicios sanitarios y alimentaci |

## 2. Rubros

### Top 15 rubros del año por monto

| # | Rubro | OC | Monto | % monto | Mes pico (OC) | Mes valle (OC) |
|---:|---|---:|---:|---:|---|---|
| 1 | Organizaciones y consultorías políticas, demográficas, económicas, sociales y de administración pública | 14,298 | $2,445.6 MM | 13.3% | noviembre | enero |
| 2 | Salud, servicios sanitarios y alimentación | 66,303 | $1,698.0 MM | 9.23% | enero | noviembre |
| 3 | Servicios de construcción y mantenimiento | 48,507 | $1,652.0 MM | 8.98% | diciembre | enero |
| 4 | Medicamentos y productos farmacéuticos | 109,383 | $1,631.7 MM | 8.87% | enero | diciembre |
| 5 | Equipamiento y suministros médicos | 337,918 | $1,220.3 MM | 6.64% | enero | diciembre |
| 6 | Servicios de limpieza industrial | 22,416 | $1,049.4 MM | 5.71% | enero | septiembre |
| 7 | Servicios profesionales, administrativos y consultorías de gestión empresarial | 80,474 | $809.1 MM | 4.4% | octubre | febrero |
| 8 | Productos de papel | 53,059 | $736.2 MM | 4.0% | noviembre | enero |
| 9 | (sin rubro informado) | 188,642 | $705.4 MM | 3.84% | octubre | febrero |
| 10 | Tecnologías de la información, telecomunicaciones y radiodifusión | 63,576 | $691.7 MM | 3.76% | diciembre | febrero |
| 11 | Servicios basados en ingeniería, ciencias sociales y tecnología de la información | 19,813 | $560.1 MM | 3.05% | diciembre | febrero |
| 12 | Servicios de transporte, almacenaje y correo | 101,018 | $518.4 MM | 2.82% | noviembre | febrero |
| 13 | Servicios agrícolas, pesqueros, forestales y relacionados con la fauna | 9,404 | $427.7 MM | 2.33% | noviembre | enero |
| 14 | Servicios de defensa nacional, orden público y seguridad | 10,435 | $423.2 MM | 2.3% | enero | agosto |
| 15 | Equipamiento para laboratorios | 81,137 | $359.1 MM | 1.95% | julio | febrero |

### Top 15 rubros del año por cantidad de OC

| # | Rubro | OC | % OC | Monto | Mes pico (OC) | Mes valle (OC) |
|---:|---|---:|---:|---:|---|---|
| 1 | Equipamiento y suministros médicos | 337,918 | 18.21% | $1,220.3 MM | enero | diciembre |
| 2 | (sin rubro informado) | 188,642 | 10.16% | $705.4 MM | octubre | febrero |
| 3 | Medicamentos y productos farmacéuticos | 109,383 | 5.89% | $1,631.7 MM | enero | diciembre |
| 4 | Servicios de transporte, almacenaje y correo | 101,018 | 5.44% | $518.4 MM | noviembre | febrero |
| 5 | Equipamiento para laboratorios | 81,137 | 4.37% | $359.1 MM | julio | febrero |
| 6 | Servicios profesionales, administrativos y consultorías de gestión empresarial | 80,474 | 4.34% | $809.1 MM | octubre | febrero |
| 7 | Salud, servicios sanitarios y alimentación | 66,303 | 3.57% | $1,698.0 MM | enero | noviembre |
| 8 | Artículos para estructuras, obras y construcciones | 63,747 | 3.43% | $267.9 MM | noviembre | enero |
| 9 | Tecnologías de la información, telecomunicaciones y radiodifusión | 63,576 | 3.43% | $691.7 MM | diciembre | febrero |
| 10 | Equipos, accesorios y suministros de oficina | 63,401 | 3.42% | $71,890 M | noviembre | enero |
| 11 | Alimentos, bebidas y tabaco | 62,184 | 3.35% | $181.9 MM | noviembre | febrero |
| 12 | Artículos de fabricación y producción | 53,850 | 2.9% | $65,122 M | abril | enero |
| 13 | Productos de papel | 53,059 | 2.86% | $736.2 MM | noviembre | enero |
| 14 | Servicios de construcción y mantenimiento | 48,507 | 2.61% | $1,652.0 MM | diciembre | enero |
| 15 | Servicios de Viajes, alimentación, alojamiento y entretenimiento | 48,198 | 2.6% | $144.3 MM | noviembre | febrero |

### Serie mensual de los 15 rubros principales (índice de OC: mes / promedio mensual; 1,00 = promedio)

| Rubro | ene | feb | mar | abr | may | jun | jul | ago | sep | oct | nov | dic |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Organizaciones y consultorías políticas, demo | 0.64 | 0.66 | 0.81 | 0.84 | 0.96 | 1.00 | 1.01 | 1.21 | 1.18 | 1.27 | 1.30 | 1.11 |
| Salud, servicios sanitarios y alimentación | 1.28 | 1.09 | 1.02 | 1.12 | 1.04 | 0.96 | 1.13 | 0.99 | 0.83 | 0.84 | 0.82 | 0.88 |
| Servicios de construcción y mantenimiento | 0.84 | 0.90 | 0.98 | 1.08 | 0.98 | 1.02 | 1.05 | 0.96 | 0.86 | 1.07 | 1.08 | 1.18 |
| Medicamentos y productos farmacéuticos | 1.13 | 1.00 | 1.05 | 1.08 | 1.09 | 1.01 | 1.07 | 0.95 | 0.90 | 0.95 | 0.89 | 0.88 |
| Equipamiento y suministros médicos | 1.16 | 0.91 | 1.01 | 1.08 | 1.02 | 1.02 | 1.08 | 0.99 | 0.93 | 0.97 | 0.93 | 0.90 |
| Servicios de limpieza industrial | 1.26 | 1.03 | 1.09 | 1.09 | 0.99 | 0.93 | 1.04 | 0.86 | 0.84 | 0.93 | 0.90 | 1.02 |
| Servicios profesionales, administrativos y co | 1.01 | 0.88 | 0.91 | 0.96 | 0.90 | 0.90 | 0.98 | 1.09 | 1.04 | 1.14 | 1.12 | 1.07 |
| Productos de papel | 0.63 | 0.77 | 1.01 | 1.09 | 1.02 | 1.02 | 1.04 | 1.00 | 0.95 | 1.18 | 1.21 | 1.06 |
| (sin rubro informado) | 0.90 | 0.74 | 1.01 | 1.05 | 1.04 | 1.01 | 1.14 | 1.06 | 0.99 | 1.16 | 1.05 | 0.85 |
| Tecnologías de la información, telecomunicaci | 0.78 | 0.73 | 0.97 | 1.06 | 0.97 | 1.01 | 1.03 | 1.01 | 0.92 | 1.09 | 1.16 | 1.27 |
| Servicios basados en ingeniería, ciencias soc | 0.79 | 0.77 | 0.93 | 1.04 | 0.91 | 1.01 | 1.00 | 0.99 | 0.95 | 1.18 | 1.18 | 1.25 |
| Servicios de transporte, almacenaje y correo | 0.78 | 0.71 | 0.91 | 0.99 | 1.00 | 0.97 | 0.95 | 1.06 | 0.99 | 1.23 | 1.23 | 1.17 |
| Servicios agrícolas, pesqueros, forestales y  | 0.73 | 0.81 | 0.96 | 1.07 | 1.02 | 0.97 | 1.11 | 0.99 | 0.96 | 1.15 | 1.15 | 1.07 |
| Servicios de defensa nacional, orden público  | 1.30 | 1.12 | 0.94 | 1.00 | 0.96 | 0.91 | 0.95 | 0.86 | 0.94 | 0.97 | 0.91 | 1.13 |
| Equipamiento para laboratorios | 0.99 | 0.89 | 0.98 | 1.07 | 1.01 | 1.02 | 1.10 | 1.01 | 0.93 | 1.08 | 0.97 | 0.94 |

(La serie completa con cantidad de OC y monto por mes de cada rubro, y el top 15 de cada mes, están en el JSON, sección 2.)

## 3. Fin de año: noviembre y diciembre vs promedio enero–octubre

- **Noviembre**: 168,212 OC (+9.8% vs promedio ene–oct de 153,257) y $1,014.2 MM (-36.5% vs $1,597.2 MM).
- **Diciembre**: 155,285 OC (+1.3% vs promedio ene–oct de 153,257) y $1,404.4 MM (-12.1% vs $1,597.2 MM).

### Variación por tipo de OC

| Tipo | Prom. ene–oct OC | Nov OC | Var. % | Dic OC | Var. % | Prom. ene–oct monto | Nov monto | Var. % | Dic monto | Var. % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AG | 63,607 | 77,346 | 21.6% | 66,826 | 5.06% | $89,853 M | $102.2 MM | 13.73% | $98,550 M | 9.68% |
| SE | 61,905 | 63,070 | 1.88% | 63,467 | 2.52% | $1,255.8 MM | $705.0 MM | -43.86% | $1,033.4 MM | -17.72% |
| CM | 15,899 | 16,492 | 3.73% | 13,378 | -15.85% | $62,223 M | $64,416 M | 3.52% | $66,727 M | 7.24% |
| TD | 11,060 | 10,460 | -5.43% | 10,669 | -3.54% | $183.3 MM | $123.4 MM | -32.68% | $197.5 MM | 7.71% |
| CC | 766 | 817 | 6.6% | 923 | 20.43% | $5,653 M | $18,236 M | 222.58% | $6,746 M | 19.33% |
| CT | 20 | 27 | 37.06% | 22 | 11.68% | $339 M | $920 M | 171.38% | $1,557 M | 359.06% |

### Variación por rubro (top 15 por monto)

| Rubro | Prom. ene–oct OC | Nov OC (var.) | Dic OC (var.) | Dic monto (var.) |
|---|---:|---:|---:|---:|
| Organizaciones y consultorías políticas, demográfi | 1,143 | 1,547 (35.37%) | 1,323 (15.77%) | $21,927 M (-90.88%) |
| Salud, servicios sanitarios y alimentación | 5,692 | 4,520 (-20.59%) | 4,861 (-14.6%) | $41,351 M (-74.44%) |
| Servicios de construcción y mantenimiento | 3,939 | 4,367 (10.87%) | 4,752 (20.65%) | $178.8 MM (31.89%) |
| Medicamentos y productos farmacéuticos | 9,330 | 8,106 (-13.12%) | 7,979 (-14.48%) | $133.0 MM (-8.09%) |
| Equipamiento y suministros médicos | 28,628 | 26,194 (-8.5%) | 25,441 (-11.13%) | $88,180 M (-15.59%) |
| Servicios de limpieza industrial | 1,882 | 1,689 (-10.27%) | 1,903 (1.09%) | $62,154 M (-32.49%) |
| Servicios profesionales, administrativos y consult | 6,576 | 7,517 (14.31%) | 7,200 (9.49%) | $80,303 M (20.65%) |
| Productos de papel | 4,302 | 5,340 (24.14%) | 4,702 (9.31%) | $9,027 M (-87.48%) |
| (sin rubro informado) | 15,882 | 16,471 (3.71%) | 13,352 (-15.93%) | $62,540 M (7.37%) |
| Tecnologías de la información, telecomunicaciones  | 5,070 | 6,142 (21.14%) | 6,731 (32.75%) | $79,379 M (44.09%) |
| Servicios basados en ingeniería, ciencias sociales | 1,580 | 1,943 (22.96%) | 2,068 (30.87%) | $28,746 M (-41.11%) |
| Servicios de transporte, almacenaje y correo | 8,079 | 10,353 (28.15%) | 9,878 (22.27%) | $63,342 M (53.37%) |
| Servicios agrícolas, pesqueros, forestales y relac | 766 | 899 (17.32%) | 842 (9.88%) | $64,853 M (89.0%) |
| Servicios de defensa nacional, orden público y seg | 866 | 793 (-8.43%) | 982 (13.39%) | $41,200 M (14.75%) |
| Equipamiento para laboratorios | 6,822 | 6,563 (-3.79%) | 6,358 (-6.8%) | $31,514 M (5.36%) |

### 20 rubros con mayor alza relativa en nov–dic

Solo rubros/productos con al menos 30 OC promedio mensual en enero–octubre; razón = promedio mensual nov–dic / promedio mensual ene–oct.

| # | Rubro | OC/mes ene–oct | OC/mes nov–dic | Razón | Var. % monto |
|---:|---|---:|---:|---:|---:|
| 1 | Productos para relojería, joyería y gemas | 77 | 143 | ×1.862 | 104.69% |
| 2 | Equipos, suministros y accesorios deportivos y recreati | 1,732 | 2,722 | ×1.571 | 50.95% |
| 3 | Equipos y suministros de imprenta, fotográficos y audio | 881 | 1,368 | ×1.553 | 144.01% |
| 4 | Muebles y mobiliario | 2,261 | 3,322 | ×1.469 | 87.14% |
| 5 | Instrumentos musicales, juegos, juguetes, artesanías y  | 3,623 | 5,195 | ×1.434 | 112.13% |
| 6 | Servicios de Viajes, alimentación, alojamiento y entret | 3,786 | 5,172 | ×1.366 | 18.86% |
| 7 | Muebles, accesorios, electrodomésticos y productos elec | 3,388 | 4,549 | ×1.343 | 68.98% |
| 8 | Maquinaria para agricultura, pesca y silvicultura | 173 | 226 | ×1.308 | -5.3% |
| 9 | Maquinarias, equipos y suministros para la industria de | 709 | 924 | ×1.303 | -3.53% |
| 10 | Tecnologías de la información, telecomunicaciones y rad | 5,070 | 6,436 | ×1.269 | 27.83% |
| 11 | Servicios basados en ingeniería, ciencias sociales y te | 1,580 | 2,006 | ×1.269 | -26.28% |
| 12 | Servicios de cuidado personal y domésticos | 1,017 | 1,288 | ×1.266 | -1.72% |
| 13 | Organizaciones y consultorías políticas, demográficas,  | 1,143 | 1,435 | ×1.256 | -91.52% |
| 14 | Servicios de transporte, almacenaje y correo | 8,079 | 10,116 | ×1.252 | 27.65% |
| 15 | Organizaciones sociales, laborales y clubes | 137 | 171 | ×1.251 | 26.47% |
| 16 | Servicios editoriales, de diseño, publicidad, gráficos  | 2,657 | 3,305 | ×1.244 | 39.7% |
| 17 | Alimentos, bebidas y tabaco | 4,982 | 6,184 | ×1.241 | -13.74% |
| 18 | Educación, formación, entrenamiento y capacitación | 1,304 | 1,592 | ×1.221 | -13.51% |
| 19 | Ropa, maletas y productos de aseo personal | 3,134 | 3,790 | ×1.21 | -6.21% |
| 20 | Maquinaria para construcción y edificación | 305 | 366 | ×1.201 | 16.06% |

### 10 rubros con mayor caída en nov–dic

| # | Rubro | OC/mes ene–oct | OC/mes nov–dic | Razón | Var. % monto |
|---:|---|---:|---:|---:|---:|
| 1 | Salud, servicios sanitarios y alimentación | 5,692 | 4,690 | ×0.824 | -75.15% |
| 2 | Medicamentos y productos farmacéuticos | 9,330 | 8,042 | ×0.862 | -36.25% |
| 3 | Equipamiento y suministros médicos | 28,628 | 25,818 | ×0.902 | -15.95% |
| 4 | Combustibles, lubricantes y anticorrosivos | 1,598 | 1,450 | ×0.908 | -4.49% |
| 5 | Resinas, cauchos, espumas y elastómeros | 473 | 434 | ×0.917 | -22.55% |
| 6 | Servicios financieros, pensiones y seguros | 676 | 621 | ×0.919 | 19.4% |
| 7 | Servicios de producción y fabricación industrial | 2,578 | 2,384 | ×0.925 | -16.59% |
| 8 | (sin rubro informado) | 15,882 | 14,912 | ×0.939 | 5.56% |
| 9 | Equipamiento para laboratorios | 6,822 | 6,460 | ×0.947 | 0.25% |
| 10 | Servicios de limpieza industrial | 1,882 | 1,796 | ×0.954 | -30.12% |

### 20 productos genéricos con mayor alza relativa en nov–dic

| # | Producto | OC/mes ene–oct | OC/mes nov–dic | Razón | Var. % monto |
|---:|---|---:|---:|---:|---:|
| 1 | SERVICIO POSTVENTA | 71 | 292 | ×4.088 | 333.47% |
| 2 | Ornamentos y decoraciones | 33 | 86 | ×2.653 | 2893.73% |
| 3 | Diplomas | 31 | 80 | ×2.59 | 147.17% |
| 4 | Mochilas | 130 | 320 | ×2.456 | 19.8% |
| 5 | Botellas de plástico | 52 | 126 | ×2.409 | 206.77% |
| 6 | Agendas | 75 | 180 | ×2.4 | 53.25% |
| 7 | Taco calendario | 39 | 90 | ×2.307 | -26.71% |
| 8 | Libros de literatura infantil | 41 | 94 | ×2.271 | 128.2% |
| 9 | Servicios relacionados con el arte | 45 | 100 | ×2.211 | 30.06% |
| 10 | Zona de juegos infantiles | 50 | 110 | ×2.206 | 8.14% |
| 11 | Audífonos | 170 | 374 | ×2.2 | 6.32% |
| 12 | Juguetes didácticos | 231 | 504 | ×2.181 | 547.14% |
| 13 | Juegos terapéuticos | 52 | 113 | ×2.169 | 257.42% |
| 14 | Kits de colocación de catéteres cardiovasculares | 44 | 96 | ×2.161 | -17.2% |
| 15 | Marcos para certificados | 38 | 82 | ×2.15 | 80.45% |
| 16 | Comidas preparadas para llevar | 51 | 110 | ×2.139 | 30.17% |
| 17 | Ventiladores | 76 | 161 | ×2.105 | 26.13% |
| 18 | Servicios de flete | 254 | 525 | ×2.067 | 168.45% |
| 19 | Protector solar | 144 | 294 | ×2.041 | 108.84% |
| 20 | Aljibes | 76 | 154 | ×2.018 | 5.59% |

### 10 productos genéricos con mayor caída en nov–dic

| # | Producto | OC/mes ene–oct | OC/mes nov–dic | Razón | Var. % monto |
|---:|---|---:|---:|---:|---:|
| 1 | GAS LICUADO GRANEL LITRO VII REGIÓN | 58 | 0 | ×0.0 | -100.0% |
| 2 | GAS LICUADO GRANEL LITRO X REGIÓN | 58 | 0 | ×0.0 | -100.0% |
| 3 | GAS LICUADO GRANEL LITRO VIII REGIÓN | 86 | 0 | ×0.0 | -100.0% |
| 4 | GAS LICUADO GRANEL LITRO XIV REGIÓN | 33 | 0 | ×0.0 | -100.0% |
| 5 | GAS LICUADO GRANEL LITRO V REGIÓN | 44 | 0 | ×0.0 | -100.0% |
| 6 | GAS LICUADO GRANEL LITRO XI REGIÓN | 46 | 0 | ×0.0 | -100.0% |
| 7 | GAS LICUADO CILINDRO MEDIANTE VALE DE RECARGA 15 KG VII | 34 | 0 | ×0.0 | -100.0% |
| 8 | GAS LICUADO GRANEL LITRO IX REGIÓN | 61 | 0 | ×0.0 | -100.0% |
| 9 | Centros asistenciales de urgencia | 75 | 8 | ×0.113 | -94.73% |
| 10 | Dispositivos de fijación internos o externos, féru | 42 | 6 | ×0.141 | -77.31% |

### Distribución de OC por día del mes (año completo)

| Día | OC | % | Monto |
|---:|---:|---:|---:|
| 1 | 46,257 | 2.49% | $421.7 MM |
| 2 | 57,122 | 3.08% | $408.9 MM |
| 3 | 68,123 | 3.67% | $457.0 MM |
| 4 | 70,128 | 3.78% | $1,317.1 MM |
| 5 | 60,632 | 3.27% | $440.9 MM |
| 6 | 58,200 | 3.14% | $545.0 MM |
| 7 | 66,841 | 3.6% | $634.4 MM |
| 8 | 53,794 | 2.9% | $560.6 MM |
| 9 | 62,039 | 3.34% | $825.6 MM |
| 10 | 74,548 | 4.02% | $592.2 MM |
| 11 | 70,090 | 3.78% | $584.5 MM |
| 12 | 61,411 | 3.31% | $431.5 MM |
| 13 | 59,302 | 3.2% | $417.3 MM |
| 14 | 69,129 | 3.72% | $494.6 MM |
| 15 | 53,455 | 2.88% | $411.9 MM |
| 16 | 52,293 | 2.82% | $533.0 MM |
| 17 | 70,393 | 3.79% | $542.4 MM |
| 18 | 53,927 | 2.91% | $767.5 MM |
| 19 | 51,436 | 2.77% | $431.7 MM |
| 20 | 52,968 | 2.85% | $417.2 MM |
| 21 | 53,772 | 2.9% | $383.3 MM |
| 22 | 59,580 | 3.21% | $505.1 MM |
| 23 | 59,166 | 3.19% | $447.6 MM |
| 24 | 69,256 | 3.73% | $1,843.6 MM |
| 25 | 58,384 | 3.15% | $488.1 MM |
| 26 | 59,902 | 3.23% | $497.7 MM |
| 27 | 60,084 | 3.24% | $432.1 MM |
| 28 | 71,377 | 3.85% | $551.4 MM |
| 29 | 62,032 | 3.34% | $476.9 MM |
| 30 | 62,919 | 3.39% | $562.4 MM |
| 31 | 27,505 | 1.48% | $967.6 MM |

### Distribución de OC por día de la semana

| Día | OC | % OC | Monto | % monto |
|---|---:|---:|---:|---:|
| lunes | 368,722 | 19.87% | $3,501.6 MM | 19.04% |
| martes | 397,269 | 21.4% | $4,338.9 MM | 23.59% |
| miércoles | 365,594 | 19.7% | $3,453.6 MM | 18.78% |
| jueves | 368,701 | 19.86% | $2,855.2 MM | 15.53% |
| viernes | 338,824 | 18.25% | $4,158.6 MM | 22.61% |
| sábado | 12,764 | 0.69% | $67,776 M | 0.37% |
| domingo | 4,191 | 0.23% | $15,265 M | 0.08% |

### Peso de los últimos 5 días de cada mes

| Mes | OC últimos 5 días | % OC del mes | % monto del mes |
|---|---:|---:|---:|
| enero | 34,284 | 24.59% | 13.12% |
| febrero | 30,741 | 24.37% | 9.58% |
| marzo | 23,148 | 15.54% | 41.96% |
| abril | 24,844 | 15.36% | 12.22% |
| mayo | 32,060 | 20.45% | 17.7% |
| junio | 22,075 | 14.22% | 13.91% |
| julio | 31,392 | 19.13% | 17.58% |
| agosto | 25,909 | 16.24% | 14.89% |
| septiembre | 23,645 | 15.76% | 22.73% |
| octubre | 32,906 | 19.3% | 21.26% |
| noviembre | 26,533 | 15.77% | 15.47% |
| diciembre | 17,507 | 11.27% | 18.34% |

## 4. Sectores y organismos

### Sectores: monto anual e índice mensual (mes / promedio mensual)

| Sector | Monto anual | % | ene | feb | mar | abr | may | jun | jul | ago | sep | oct | nov | dic |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Salud | $6,621.1 MM | 36.0% | 1.33 | 2.31 | 1.02 | 0.71 | 0.89 | 0.74 | 0.94 | 1.10 | 0.87 | 0.70 | 0.58 | 0.81 |
| Gob. Central, Universidades | $5,702.4 MM | 31.01% | 2.78 | 1.77 | 1.80 | 1.31 | 0.40 | 0.95 | 0.43 | 0.59 | 0.44 | 0.48 | 0.48 | 0.57 |
| Municipalidades | $4,036.6 MM | 21.95% | 1.13 | 0.84 | 1.01 | 0.99 | 1.19 | 1.01 | 0.93 | 0.75 | 0.93 | 1.19 | 0.86 | 1.16 |
| Obras Públicas | $748.0 MM | 4.07% | 0.65 | 0.36 | 1.34 | 0.78 | 0.86 | 0.86 | 1.21 | 0.72 | 0.87 | 1.24 | 0.82 | 2.29 |
| FFAA | $664.7 MM | 3.61% | 1.00 | 0.99 | 0.99 | 1.00 | 0.92 | 1.01 | 1.27 | 0.80 | 0.89 | 1.06 | 0.96 | 1.10 |
| Otros | $260.5 MM | 1.42% | 0.72 | 0.96 | 0.84 | 0.95 | 0.89 | 0.91 | 1.09 | 0.91 | 0.81 | 1.17 | 0.93 | 1.82 |
| (sin dato) | $260.1 MM | 1.41% | 0.52 | 0.72 | 1.26 | 1.66 | 1.03 | 0.63 | 0.90 | 0.90 | 0.75 | 0.86 | 1.27 | 1.49 |
| Legislativo y judicial | $97,366 M | 0.53% | 0.52 | 0.37 | 1.05 | 0.57 | 0.45 | 0.53 | 0.89 | 0.44 | 0.47 | 0.87 | 3.00 | 2.83 |

(Top 10 sectores de cada mes en el JSON, sección 4.)

### 20 organismos que más gastan en diciembre (razón diciembre / promedio mensual del año)

| # | Organismo | Monto dic | OC dic | Monto anual | Razón dic/prom | % anual en dic |
|---:|---|---:|---:|---:|---:|---:|
| 1 | CENTRAL DE ABASTECIMIENTO DEL SISTEMA NACIONAL DE SERVICIO D | $130.6 MM | 117 | $1,657.6 MM | 0.946 | 7.88% |
| 2 | MINISTERIO DE OBRAS PUBLICAS DIREC CION GRAL DE OO PP DCYF | $69,385 M | 1,893 | $375.9 MM | 2.215 | 18.46% |
| 3 | SERVIU REGION DE MAGALLANES Y DE LA ANTARTICA CHILENA | $33,539 M | 17 | $45,897 M | 8.769 | 73.07% |
| 4 | I MUNICIPALIDAD DE TEMUCO | $33,275 M | 422 | $86,335 M | 4.625 | 38.54% |
| 5 | CORP NACIONAL FORESTAL | $32,849 M | 1,461 | $137.7 MM | 2.862 | 23.85% |
| 6 | MUNICIPALIDAD DE OVALLE | $22,280 M | 337 | $46,674 M | 5.728 | 47.74% |
| 7 | DIRECCION DE LOGISTICA DE CARABINEROS | $16,728 M | 3,298 | $183.9 MM | 1.091 | 9.1% |
| 8 | DIRECCION GENERAL DE GENDARMERIA DE CHIL | $15,837 M | 2,485 | $125.6 MM | 1.513 | 12.61% |
| 9 | CORP ADMINISTRATIVA DEL PODER JUDICIAL | $14,239 M | 1,001 | $63,031 M | 2.711 | 22.59% |
| 10 | I MUNICIPALIDAD DE MAIPU | $13,128 M | 81 | $150.8 MM | 1.045 | 8.7% |
| 11 | DIRECCION SERVICIO DE SALUD TALCAHUANO | $12,962 M | 114 | $46,076 M | 3.376 | 28.13% |
| 12 | UNIVERSIDAD DE CHILE | $12,717 M | 3,257 | $164.7 MM | 0.926 | 7.72% |
| 13 | SERVICIO DE VIVIENDA Y URBANIZACION REGION ÑUBLE | $11,796 M | 24 | $24,544 M | 5.767 | 48.06% |
| 14 | DIRECCION GENERAL DE AERONAUTICA CIVIL | $11,468 M | 276 | $41,212 M | 3.339 | 27.83% |
| 15 | SERVICIO DE IMPUESTOS INTERNOS DIRECCION | $11,441 M | 92 | $50,859 M | 2.7 | 22.5% |
| 16 | ILUSTRE MUNICIPALIDAD DE LA SERENA | $11,139 M | 124 | $32,291 M | 4.14 | 34.5% |
| 17 | POLICIA DE INVESTIGACIONES DE CHILE | $10,983 M | 533 | $88,145 M | 1.495 | 12.46% |
| 18 | DIVISION LOGISTICA DEL EJERCITO | $10,456 M | 2,582 | $151.5 MM | 0.828 | 6.9% |
| 19 | I MUNICIPALIDAD DE PUENTE ALTO | $10,100 M | 307 | $69,427 M | 1.746 | 14.55% |
| 20 | SUBSECRETARIA DE SALUD PUBLICA | $9,996 M | 350 | $112.4 MM | 1.067 | 8.89% |

### 20 organismos con mayor razón diciembre / promedio mensual (más de CLP 1.000 M al año)

| # | Organismo | Monto dic | Monto anual | Razón | % anual en dic |
|---:|---|---:|---:|---:|---:|
| 1 | SERVIU REGION DE MAGALLANES Y DE LA ANTARTICA CHILENA | $33,539 M | $45,897 M | 8.769 | 73.07% |
| 2 | Ilustre Municipalidad de Cabo de Hornos | $3,872 M | $5,302 M | 8.764 | 73.04% |
| 3 | CORP MUNICIPAL DE VALPARAISO PARA EL DESARROLLO SOCIAL | $9,038 M | $13,392 M | 8.098 | 67.49% |
| 4 | SERVICIO DE SALUD ACONCAGUA | $9,034 M | $14,005 M | 7.741 | 64.51% |
| 5 | SUBSECRETARIA DE SEGURIDAD PUBLICA | $1,364 M | $2,513 M | 6.512 | 54.26% |
| 6 | AGENCIA CHILENA DE EFICIENCIA ENERGETICA | $1,927 M | $3,624 M | 6.38 | 53.16% |
| 7 | INSTITUTO NACIONAL DE DERECHOS HUMANOS | $1,800 M | $3,443 M | 6.273 | 52.27% |
| 8 | CENTRO DE FORMACION TECNICA DE LA REGION METROPOLITANA DE SA | $782 M | $1,512 M | 6.207 | 51.73% |
| 9 | GOBIERNO REGIONAL DE ATACAMA | $1,061 M | $2,067 M | 6.156 | 51.3% |
| 10 | I MUNICIPALIDAD DE FRUTILLAR | $4,567 M | $9,235 M | 5.934 | 49.45% |
| 11 | SERVICIO DE VIVIENDA Y URBANIZACION REGION ÑUBLE | $11,796 M | $24,544 M | 5.767 | 48.06% |
| 12 | MUNICIPALIDAD DE OVALLE | $22,280 M | $46,674 M | 5.728 | 47.74% |
| 13 | SERVICIO LOCAL DE EDUCACION PUBLICA DE GABRIELA MISTRAL | $2,252 M | $5,095 M | 5.304 | 44.2% |
| 14 | I MUNICIPALIDAD DE CATEMU | $2,860 M | $6,531 M | 5.254 | 43.78% |
| 15 | SERVICIO LOCAL DE EDUCACION PUBLICA ANDALIEN SUR | $5,570 M | $12,803 M | 5.22 | 43.5% |
| 16 | SERVICIO DE SALUD AYSEN CARLOS IBANEZ DEL CAMPO | $5,174 M | $12,099 M | 5.131 | 42.76% |
| 17 | MINISTERIO PUBLICO | $6,987 M | $16,825 M | 4.983 | 41.53% |
| 18 | SERVICIO DE SALUD ARAUCANIA NORTE | $3,062 M | $7,637 M | 4.812 | 40.1% |
| 19 | CORPORACION DE ASISTENCIA JUDICIAL DE LA REGION DEL BIO BIO | $622 M | $1,553 M | 4.804 | 40.03% |
| 20 | CORP CULTURAL DE LAS CONDES | $772 M | $1,955 M | 4.742 | 39.52% |

## 5. Regiones: monto por trimestre

| Región | T1 | T2 | T3 | T4 | Total | % | % en T4 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Región Metropolitana de Santiago | $5,155.3 MM | $2,284.5 MM | $2,022.3 MM | $1,693.9 MM | $11,155.9 MM | 60.66% | 15.18% |
| Región de Valparaíso | $307.2 MM | $361.0 MM | $263.9 MM | $285.1 MM | $1,217.3 MM | 6.62% | 23.42% |
| Región del Biobío | $225.9 MM | $261.6 MM | $241.4 MM | $249.8 MM | $978.7 MM | 5.32% | 25.52% |
| Región de la Araucanía | $184.3 MM | $147.8 MM | $146.9 MM | $198.1 MM | $677.1 MM | 3.68% | 29.26% |
| Región de los Lagos | $142.4 MM | $141.1 MM | $127.6 MM | $162.1 MM | $573.2 MM | 3.12% | 28.28% |
| Región del Maule | $143.7 MM | $147.0 MM | $121.3 MM | $128.9 MM | $540.8 MM | 2.94% | 23.84% |
| Región de Coquimbo | $125.2 MM | $84,785 M | $109.7 MM | $152.4 MM | $472.1 MM | 2.57% | 32.28% |
| Región del Ñuble | $119.2 MM | $97,510 M | $89,652 M | $106.8 MM | $413.1 MM | 2.25% | 25.85% |
| Región del Libertador General Bernardo O´Higgins | $95,775 M | $115.6 MM | $93,001 M | $100.3 MM | $404.7 MM | 2.2% | 24.78% |
| Región de Antofagasta | $67,251 M | $91,638 M | $87,379 M | $134.5 MM | $380.8 MM | 2.07% | 35.32% |
| Región de Los Ríos | $75,825 M | $96,089 M | $66,074 M | $68,885 M | $306.9 MM | 1.67% | 22.45% |
| Región de Tarapacá | $47,956 M | $57,461 M | $57,999 M | $63,739 M | $227.2 MM | 1.24% | 28.06% |
| Región de Atacama | $50,185 M | $55,339 M | $49,016 M | $67,105 M | $221.6 MM | 1.21% | 30.28% |
| Región de Magallanes y de la Antártica | $49,549 M | $41,364 M | $43,545 M | $78,092 M | $212.6 MM | 1.16% | 36.74% |
| Región Aysén del General Carlos Ibáñez del Campo | $40,018 M | $37,480 M | $51,402 M | $53,686 M | $182.6 MM | 0.99% | 29.4% |
| Metropolitana | $132.1 MM | $14,270 M | $10,282 M | $12,121 M | $168.8 MM | 0.92% | 7.18% |
| Región de Arica y Parinacota | $49,018 M | $36,241 M | $37,179 M | $44,357 M | $166.8 MM | 0.91% | 26.59% |
| Los Lagos | $4,629 M | $6,335 M | $5,018 M | $5,137 M | $21,120 M | 0.11% | 24.32% |
| Valparaíso | $5,932 M | $4,397 M | $4,533 M | $4,534 M | $19,397 M | 0.11% | 23.38% |
| Bío-Bío | $2,352 M | $2,157 M | $3,333 M | $3,635 M | $11,477 M | 0.06% | 31.67% |
| Maule | $2,818 M | $2,641 M | $2,580 M | $2,375 M | $10,413 M | 0.06% | 22.81% |
| Magallanes y Antártica | $2,232 M | $1,554 M | $1,909 M | $1,975 M | $7,670 M | 0.04% | 25.74% |
| Araucanía | $1,426 M | $1,342 M | $1,241 M | $2,861 M | $6,870 M | 0.04% | 41.64% |
| Lib. Gral. Bdo. O'Higgins | $621 M | $558 M | $681 M | $558 M | $2,418 M | 0.01% | 23.06% |
| Coquimbo | $750 M | $361 M | $323 M | $642 M | $2,076 M | 0.01% | 30.94% |
| Ñuble | $441 M | $441 M | $392 M | $541 M | $1,814 M | 0.01% | 29.82% |
| Antofagasta | $375 M | $291 M | $653 M | $436 M | $1,755 M | 0.01% | 24.85% |
| Tarapacá | $255 M | $521 M | $536 M | $297 M | $1,609 M | 0.01% | 18.47% |
| Atacama | $343 M | $314 M | $233 M | $437 M | $1,327 M | 0.01% | 32.89% |
| Los Ríos | $157 M | $575 M | $219 M | $332 M | $1,283 M | 0.01% | 25.85% |
| Aysén | $250 M | $158 M | $231 M | $248 M | $887 M | 0.0% | 27.95% |
| Arica y Parinacota | $129 M | $176 M | $274 M | $118 M | $696 M | 0.0% | 16.93% |

## 6. Licitaciones 2025

Total publicadas en 2025: **100,532**. Por tipo: LE 57,578 (57.27%), LP 14,885 (14.81%), L1 11,801 (11.74%), LQ 6,579 (6.54%), LR 6,236 (6.2%), O1 1,410 (1.4%), CO 1,278 (1.27%), B2 266 (0.26%), E2 208 (0.21%), H2 139 (0.14%), I2 107 (0.11%), LS 36 (0.04%), O2 9 (0.01%).

| Mes | Publicadas | LE | LP | L1 | LQ | LR | Monto estimado (CLP) | % desiertas | % revocadas | % adjudicadas | Oferentes prom. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| enero | 7,000 | 4,113 | 898 | 868 | 604 | 413 | $955.8 MM | 11.2% | 2.43% | 85.44% | 4.69 |
| febrero | 7,534 | 4,460 | 1,036 | 715 | 674 | 455 | $1,139.9 MM | 12.25% | 2.67% | 84.17% | 4.53 |
| marzo | 8,484 | 4,870 | 1,148 | 980 | 724 | 506 | $1,453.7 MM | 12.16% | 3.06% | 83.45% | 4.73 |
| abril | 9,383 | 5,397 | 1,250 | 1,116 | 754 | 556 | $1,608.6 MM | 13.27% | 2.5% | 82.81% | 4.49 |
| mayo | 8,725 | 4,977 | 1,166 | 1,095 | 671 | 506 | $1,695.4 MM | 12.15% | 2.68% | 83.48% | 4.71 |
| junio | 8,711 | 4,935 | 1,233 | 1,075 | 625 | 534 | $1,461.8 MM | 13.55% | 3.03% | 81.82% | 4.6 |
| julio | 9,354 | 5,283 | 1,270 | 1,191 | 658 | 581 | $1,827.2 MM | 14.05% | 2.59% | 81.54% | 4.63 |
| agosto | 8,722 | 4,919 | 1,182 | 1,166 | 612 | 539 | $2,213.9 MM | 12.68% | 2.42% | 83.04% | 4.56 |
| septiembre | 7,879 | 4,485 | 1,031 | 885 | 668 | 507 | $4,213.8 MM | 13.1% | 2.14% | 82.13% | 4.51 |
| octubre | 9,043 | 5,150 | 1,309 | 1,132 | 523 | 599 | $1,765.0 MM | 12.71% | 2.59% | 81.59% | 4.25 |
| noviembre | 8,627 | 4,980 | 1,727 | 1,011 | 49 | 534 | $1,876.8 MM | 11.97% | 2.06% | 81.52% | 4.22 |
| diciembre | 7,070 | 4,009 | 1,635 | 567 | 17 | 506 | $2,555.8 MM | 12.42% | 2.74% | 77.31% | 3.91 |

Adjudicadas por mes de adjudicación: enero 1,106, febrero 3,860, marzo 5,330, abril 6,544, mayo 6,452, junio 7,302, julio 7,449, agosto 7,213, septiembre 6,759, octubre 7,567, noviembre 7,317, diciembre 8,191.

### Tiempo publicación → adjudicación (días)

| Tipo | Descripción | N | Promedio | Mediana | P90 |
|---|---|---:|---:|---:|---:|
| LE | Licitación pública 100–1000 UTM | 48,264 | 36.5 | 29.0 | 68 |
| LP | Licitación pública 1000–2000 UTM | 12,399 | 60.7 | 52 | 106 |
| L1 | Licitación pública < 100 UTM | 9,822 | 25.3 | 21.0 | 43 |
| LQ | Licitación pública 2000–5000 UTM | 5,474 | 67.8 | 58.0 | 117 |
| LR | Licitación pública > 5000 UTM | 4,845 | 89.0 | 81 | 141 |
| CO |  | 876 | 33.7 | 27.0 | 62 |
| O1 |  | 626 | 132.5 | 112.5 | 240 |
| B2 |  | 169 | 54.1 | 44 | 96 |
| E2 |  | 138 | 22.7 | 19.5 | 40 |
| H2 |  | 94 | 56.0 | 43.0 | 95 |
| I2 |  | 60 | 83.0 | 67.5 | 134 |
| LS |  | 31 | 65.1 | 59 | 132 |
| O2 |  | 3 | 79.7 | 71 | 128 |

### Top 10 rubros por trimestre (licitaciones publicadas)

**T1**: EQUIPAMIENTO Y SUMINISTROS MÉDICOS (2,739); SERVICIOS PROFESIONALES, ADMINISTRATIVOS Y CONSULTORÍAS DE GESTIÓN EMPRESARIAL (2,292); SERVICIOS DE CONSTRUCCIÓN Y MANTENIMIENTO (2,193); SERVICIOS DE TRANSPORTE, ALMACENAJE Y CORREO (1,686); MEDICAMENTOS Y PRODUCTOS FARMACÉUTICOS (1,548); TECNOLOGÍAS DE LA INFORMACIÓN, TELECOMUNICACIONES Y RADIODIFUSIÓN (1,108); ARTÍCULOS PARA ESTRUCTURAS, OBRAS Y CONSTRUCCIONES (1,101); EQUIPAMIENTO PARA LABORATORIOS (904); SALUD, SERVICIOS SANITARIOS Y ALIMENTACIÓN (812); SERVICIOS DE LIMPIEZA INDUSTRIAL (757)

**T2**: EQUIPAMIENTO Y SUMINISTROS MÉDICOS (3,862); SERVICIOS PROFESIONALES, ADMINISTRATIVOS Y CONSULTORÍAS DE GESTIÓN EMPRESARIAL (2,474); SERVICIOS DE CONSTRUCCIÓN Y MANTENIMIENTO (2,375); MEDICAMENTOS Y PRODUCTOS FARMACÉUTICOS (1,683); TECNOLOGÍAS DE LA INFORMACIÓN, TELECOMUNICACIONES Y RADIODIFUSIÓN (1,419); ARTÍCULOS PARA ESTRUCTURAS, OBRAS Y CONSTRUCCIONES (1,276); SALUD, SERVICIOS SANITARIOS Y ALIMENTACIÓN (1,266); EQUIPAMIENTO PARA LABORATORIOS (1,245); SERVICIOS DE TRANSPORTE, ALMACENAJE Y CORREO (1,209); VEHÍCULOS Y EQUIPAMIENTO EN GENERAL (793)

**T3**: EQUIPAMIENTO Y SUMINISTROS MÉDICOS (3,628); SERVICIOS PROFESIONALES, ADMINISTRATIVOS Y CONSULTORÍAS DE GESTIÓN EMPRESARIAL (2,986); SERVICIOS DE CONSTRUCCIÓN Y MANTENIMIENTO (2,848); MEDICAMENTOS Y PRODUCTOS FARMACÉUTICOS (1,461); TECNOLOGÍAS DE LA INFORMACIÓN, TELECOMUNICACIONES Y RADIODIFUSIÓN (1,376); ARTÍCULOS PARA ESTRUCTURAS, OBRAS Y CONSTRUCCIONES (1,224); EQUIPAMIENTO PARA LABORATORIOS (1,131); SERVICIOS DE TRANSPORTE, ALMACENAJE Y CORREO (1,073); SALUD, SERVICIOS SANITARIOS Y ALIMENTACIÓN (876); VEHÍCULOS Y EQUIPAMIENTO EN GENERAL (715)

**T4**: SERVICIOS DE CONSTRUCCIÓN Y MANTENIMIENTO (3,075); EQUIPAMIENTO Y SUMINISTROS MÉDICOS (3,042); SERVICIOS PROFESIONALES, ADMINISTRATIVOS Y CONSULTORÍAS DE GESTIÓN EMPRESARIAL (2,711); TECNOLOGÍAS DE LA INFORMACIÓN, TELECOMUNICACIONES Y RADIODIFUSIÓN (1,500); MEDICAMENTOS Y PRODUCTOS FARMACÉUTICOS (1,289); ARTÍCULOS PARA ESTRUCTURAS, OBRAS Y CONSTRUCCIONES (1,127); SERVICIOS DE TRANSPORTE, ALMACENAJE Y CORREO (1,036); EQUIPAMIENTO PARA LABORATORIOS (1,008); SALUD, SERVICIOS SANITARIOS Y ALIMENTACIÓN (690); INSTRUMENTOS MUSICALES, JUEGOS, JUGUETES, ARTESANÍAS Y MATERIALES EDUCATIVOS (688)

Estados a la fecha del archivo: Adjudicada 82,801, Desierta (o art. 3 ó 9 Ley 19.886) 12,736, Revocada 2,592, Cerrada 2,354, Suspendida 49.

## 7. Hallazgos

1. En 2025 el Estado emitió 1,856,065 órdenes de compra únicas por CLP 18,390,849,167,258 (18.39 billones). En cantidad de OC el mes más activo fue octubre (170,511, 9.19% del año) y el más bajo febrero (126,153, 6.8%).
2. En monto, el mes más alto fue enero (13.93% del gasto anual) y el más bajo noviembre (5.51%): el monto no sigue a la cantidad de OC porque unas pocas OC plurianuales (alimentación escolar de JUNAEB, obras hospitalarias, CENABAST) se emiten a comienzos de año.
3. Las 20 OC más grandes del año suman CLP 3,156,841,590,366 (17.17% del gasto anual con solo 20 de 1,856,065 OC); 7 de ellas se emitieron en enero y 4 de ellas se emitieron en marzo.
4. Diciembre concentra 7.64% del gasto anual y 8.37% de las OC. Frente al promedio mensual de enero–octubre, diciembre emite +1.3% de OC y -12.1% de monto; el monto promedio por OC de diciembre (CLP 9,043,981) es 1.5× el de noviembre.
5. Noviembre es el mes de más compras chicas: 168,212 OC (+9.8% vs promedio ene–oct) pero el monto más bajo del año ($1,014.2 MM, -36.5%); nov+dic suman 17.43% de las OC y 13.15% del gasto anual.
6. Febrero es el valle de actividad (126,153 OC, 6.8% del año) y marzo el rebote de inicio de año: de febrero a marzo las OC suben +18.1% (compra ágil +21.7%, convenio marco +36.2%).
7. Compra ágil (AG): 780,238 OC (42.04% de las OC) por CLP 1,099,271,576,772 (5.98% del monto); pico de OC en noviembre y valle en enero. En diciembre sus OC varían +5.1% y su monto +9.7% frente al promedio enero–octubre.
8. Convenio marco (CM): 188,856 OC (10.18% de las OC) por CLP 753,372,524,962 (4.1% del monto); pico de OC en octubre y valle en febrero. En diciembre sus OC varían -15.8% y su monto +7.2% frente al promedio enero–octubre.
9. Licitación (sin emisión automática) (SE): 745,587 OC (40.17% de las OC) por CLP 14,296,633,789,607 (77.74% del monto); pico de OC en enero y valle en febrero. En diciembre sus OC varían +2.5% y su monto -17.7% frente al promedio enero–octubre.
10. Trato directo (TD): 131,734 OC (7.1% de las OC) por CLP 2,154,188,309,435 (11.71% del monto); pico de OC en abril y valle en enero. En diciembre sus OC varían -3.5% y su monto +7.7% frente al promedio enero–octubre.
11. Rubros que más suben en nov–dic (OC mensuales vs promedio ene–oct): Productos para relojería, joyería y gemas ×1.86 (77→143 OC/mes); Equipos, suministros y accesorios deportivos y recreativos ×1.57 (1,732→2,722 OC/mes); Equipos y suministros de imprenta, fotográficos y audiovisuales ×1.55 (881→1,368 OC/mes); Muebles y mobiliario ×1.47 (2,261→3,322 OC/mes). Es el patrón de compras de fin de año: regalos, deportes, muebles, juguetes y audiovisual.
12. Rubros que más caen en nov–dic: Salud, servicios sanitarios y alimentación ×0.82 (-18% en OC); Medicamentos y productos farmacéuticos ×0.86 (-14% en OC); Equipamiento y suministros médicos ×0.90 (-10% en OC). El área de salud desacelera sus compras al cierre del año.
13. Productos genéricos que más se disparan en nov–dic: SERVICIO POSTVENTA ×4.09 (71→292 OC/mes); Ornamentos y decoraciones ×2.65 (33→86 OC/mes); Diplomas ×2.59 (31→80 OC/mes); Mochilas ×2.46 (130→320 OC/mes); Botellas de plástico ×2.41 (52→126 OC/mes).
14. El rubro con más gasto es 'Organizaciones y consultorías políticas, demográficas, económicas, sociales y de administración pública' (CLP 2,445,595,599,594, 13.3% del total; pico de OC en noviembre, valle en enero); el rubro con más órdenes es 'Equipamiento y suministros médicos' (337,918 OC, 18.21% de las OC; pico en enero, valle en diciembre).
15. Rubros que más suben en marzo (OC del mes / promedio mensual, rubros con más de 3.000 OC al año): Servicios financieros, pensiones y seguros ×1.61 (667→1,072 OC); Equipos y suministros de limpieza ×1.12 (2,763→3,096 OC); Servicios de limpieza industrial ×1.09 (1,868→2,039 OC). Los seguros se renuevan en marzo.
16. Rubros que más caen en febrero: Educación, formación, entrenamiento y capacitación ×0.33 (1,352→450 OC); Servicios de Viajes, alimentación, alojamiento y entretenimiento ×0.36 (4,016→1,433 OC); Equipos y suministros de imprenta, fotográficos y audiovisuales ×0.54 (962→522 OC).
17. Los martes concentran la mayor emisión de OC (21.4% del año y 23.59% del monto); lunes 19.87%, martes 21.4%, miércoles 19.7%, jueves 19.86%, viernes 18.25%; sábado y domingo apenas 0.91%.
18. Por día del mes, el día 10 es el de mayor emisión (4.02% de las OC del año) y el día 1 el de menor entre los días 1–28 (2.49%). Los últimos 5 días del mes pesan más en enero (24.59% de las OC del mes) y en diciembre solo 11.27% (el cierre administrativo adelanta la emisión).
19. Entre organismos con más de CLP 1.000 millones anuales, el que más concentra su gasto en diciembre es SERVIU REGION DE MAGALLANES Y DE LA ANTARTICA CHILENA: 8.8× su promedio mensual (73.07% de su gasto anual en diciembre). 115 organismos de ese grupo gastan en diciembre al menos el doble de su promedio mensual.
20. El organismo que más gasta en diciembre es CENTRAL DE ABASTECIMIENTO DEL SISTEMA NACIONAL DE SERVICIO DE SALUD (CLP 130,639,507,516, 0.95× su promedio mensual, 7.88% de su gasto anual).
21. El sector con más gasto es 'Salud' (36.0% del monto anual) con pico en febrero (índice 2.31). El sector 'Municipalidades' pesa 21.95% y su pico es octubre (índice 1.19).
22. Región Metropolitana de Santiago concentra 60.66% del gasto anual y su cuarto trimestre representa 15.18% de su gasto (25% sería parejo); la región con mayor concentración en el cuarto trimestre es Araucanía (41.64% de su gasto anual).
23. 188,856 OC (10.18%) llevan código de convenio marco, por CLP 753,372,524,962 (4.1% del monto).
24. Licitaciones: 100,532 publicadas en 2025 (LE 57.27%, LP 14.81%, L1 11.74%); el mes con más publicaciones fue abril (9,383, 9.33%) y el de menos enero (7,000, 6.96%).
25. En nov–dic cambia la mezcla de licitaciones: el tipo LQ pasa de 651 a 33 publicaciones/mes (-95%) mientras LP pasa de 1,152 a 1,681 (+46%).
26. 12.67% de las licitaciones 2025 quedaron desiertas y 2.58% revocadas; el mes con mayor % de desiertas fue julio (14.05%) y el promedio de oferentes por licitación baja de 4.69 en enero a 3.91 en diciembre.
27. Tiempo publicación→adjudicación (mediana de días): LP 52 (promedio 61, p90 106); LE 29 (promedio 36, p90 68); L1 21 (promedio 25, p90 43); LQ 58 (promedio 68, p90 117); LR 81 (promedio 89, p90 141). Una licitación LR tarda en mediana casi 4 veces más que una L1.
28. El mes con más adjudicaciones fue diciembre (8,191); la suma de monto estimado de licitaciones publicadas fue mayor en septiembre ($4,213.8 MM).
