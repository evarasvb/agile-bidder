# Datos abiertos ChileCompra: Órdenes de Compra y Convenio Marco

Investigación de solo lectura realizada el 26-09-2026. Fuentes: PDF oficial de la API de OC, portal `datos-abiertos.chilecompra.cl` (código del sitio) y archivos reales descargados desde el almacenamiento `transparenciachc.blob.core.windows.net`. No contiene secretos.

## (a) URLs de descarga, formato, tamaño y periodos

| Dataset | URL (patrón) | Formato | Periodo / actualización |
|---|---|---|---|
| Órdenes de Compra mensual | `https://transparenciachc.blob.core.windows.net/oc-da/[año]-[mes].zip` — mes SIN cero a la izquierda (`2026-8.zip`, no `2026-08.zip`) | ZIP con un CSV `[año]-[mes].csv`; separador `;`; codificación Latin-1 / Windows-1252 (el portal dice UTF-8, pero los archivos de 2026 vienen en Latin-1); CRLF; decimales con coma; 1 fila por ítem de OC | Disponible desde 2007. Los archivos se regeneran diariamente (Last-Modified 25-09-2026 para todos los meses de 2026). Mes en curso (2026-9) ya existe y crece día a día |
| Transacciones Convenio Marco mensual | `https://transparenciachc.blob.core.windows.net/planillas-cm/[año]-[mes].zip` — mes sin cero (`2026-8.zip`) | ZIP con un CSV `[año]-[mes].csv`; separador `;`; Latin-1; CRLF; 1 fila por línea de producto de la OC | Selector del portal desde 2016 (verificado 2016-1, 2025-12, 2026-1, 2026-7, 2026-8). Se publica alrededor del día 11 del mes siguiente (2026-8 con fecha 11-09-2026). **2026-9 aún no existe** (404) |
| Licitaciones mensual | `https://transparenciachc.blob.core.windows.net/lic-da/[año]-[mes].zip` | ZIP/CSV | 2026-8 = 16.216.746 bytes |
| Maestra de productos por convenio | Índice `https://transparenciachc.blob.core.windows.net/maestrascm/CM_publicados.csv` → `https://transparenciachc.blob.core.windows.net/maestrascm/MaestraProd_cm_[nro-licitacion-minúsculas].zip` (ej. `MaestraProd_cm_2239-1-lr25.zip`) | ZIP con CSV separado por coma, UTF-8 con BOM | "actualizados semanalmente los días martes"; índice fechado 21-09-2026 con 18 convenios |
| Complementos | `https://transparenciachc.blob.core.windows.net/oc-da/Instituciones_compradoras.zip`, `.../oc-da/Listado_rubros_ONU.xlsx`, `.../oc-da/OC_CFMP.zip`, `.../oc-da/ParidadMoneda.csv`, `.../oc-da/hist_OC_erroneas.csv`, `.../oc-da/hist_moneda_H_vs_I.csv` | varios | — |
| OCDS | `https://ocds.blob.core.windows.net/ocds/yyyymm.zip`; API `https://api.mercadopublico.cl/APISOCDS/OCDS/listaOCDSAgnoMesConvenio/` | ZIP JSON | Convenios Marco y Tratos Directos desde 2019 |

Tamaños verificados (HEAD, 26-09-2026):

| Archivo | Bytes ZIP | CSV descomprimido | Last-Modified |
|---|---|---|---|
| planillas-cm/2026-8.zip | 8.363.343 | 70.902.970 bytes; 72.865 registros; 18.288 OC únicas | 11-09-2026 |
| planillas-cm/2026-7.zip | 8.851.397 | — | 11-09-2026 |
| planillas-cm/2026-1.zip | 7.455.550 | — | 11-07-2026 |
| planillas-cm/2025-12.zip | 6.582.452 | — | 11-06-2026 |
| planillas-cm/2016-1.zip | 28.682.510 | — | 11-04-2022 |
| oc-da/2026-9.zip | 78.706.015 | — | 25-09-2026 |
| oc-da/2026-8.zip | 100.823.566 | 735.006.441 bytes; 433.887 registros ítem; 153.594 OC únicas | 25-09-2026 |
| oc-da/2026-7.zip | 98.853.998 | — | 25-09-2026 |
| oc-da/2026-1.zip | 81.304.264 | — | 25-09-2026 |
| maestrascm/MaestraProd_cm_2239-1-lr25.zip | 5.324 | 96.898 (GAS.csv) | 21-09-2026 |

Portal: el dominio antiguo `datosabiertos.chilecompra.cl` (incl. `/Home/TransaccionConvenioMarcoHistorica`) no resolvió DNS desde el entorno de prueba; el portal vigente es `https://datos-abiertos.chilecompra.cl/` (rutas `/descargas/ordenes-y-licitaciones`, `/descargas/convenio-marco`, `/datos-abiertos/definiciones`). Es una SPA React; los patrones de URL se extrajeron de su bundle JS y se verificaron descargando los archivos.

## (b) Cabeceras completas

### OC mensual (`oc-da/2026-8.csv`) — 79 columnas, separador `;`, Latin-1, CRLF

```
"ID";"Codigo";"Link";"Nombre";"Descripcion/Obervaciones";"Tipo";"ProcedenciaOC";"EsTratoDirecto";"EsCompraAgil";"CodigoTipo";"CodigoAbreviadoTipoOC";"DescripcionTipoOC";"CodigoProyectoPlanAnualCompras";"codigoEstado";"Estado";"codigoEstadoProveedor";"EstadoProveedor";"FechaCreacion";"FechaEnvio";"FechaSolicitudCancelacion";"fechaUltimaModificacion";"FechaAceptacion";"FechaCancelacion";"tieneItems";"PromedioCalificacion";"CantidadEvaluacion";"MontoTotalOC";"TipoMonedaOC";"MontoTotalOC_PesosChilenos";"Impuestos";"TipoImpuesto";"Descuentos";"Cargos";"TotalNetoOC";"CodigoUnidadCompra";"RutUnidadCompra";"UnidadCompra";"CodigoOrganismoPublico";"OrganismoPublico";"sector";"ActividadComprador";"CiudadUnidadCompra";"RegionUnidadCompra";"PaisUnidadCompra";"CodigoSucursal";"RutSucursal";"Sucursal";"CodigoProveedor";"NombreProveedor";"ActividadProveedor";"ComunaProveedor";"RegionProveedor";"PaisProveedor";"Financiamiento";"PorcentajeIva";"Pais";"TipoDespacho";"FormaPago";"CodigoLicitacion";"Codigo_ConvenioMarco";"IDItem";"codigoCategoria";"Categoria";"codigoProductoONU";"NombreroductoGenerico";"RubroN1";"RubroN2";"RubroN3";"EspecificacionComprador";"EspecificacionProveedor";"cantidad";"UnidadMedida";"monedaItem";"precioNeto";"totalCargos";"totalDescuentos";"totalImpuestos";"totalLineaNeto";"Forma de Pago"
```

Notas de parseo: los campos de texto van entre comillas dobles y pueden contener saltos de línea (`Descripcion/Obervaciones`, `Observaciones`), por lo que hay que usar un parser CSV real (no `split` por línea). Valores nulos aparecen como `NA` o cadena vacía. Números con coma decimal (`11497724,07`).

### Transacciones Convenio Marco (`planillas-cm/2026-8.csv`) — 45 columnas, separador `;`, Latin-1, CRLF

```
"Nro Licitacion Publica";"Id Convenio Marco";"Convenio Marco";"CodigoOC";"NombreOC";"Fecha Envio OC";"EstadoOC";"Proviene de Gran Compra";"idGranCompra";"Especificacion del Comprador";"IDProductoCM";"Producto";"Nombre Producto ONU";"Tipo de Producto";"Marca";"Modelo";"Precio Unitario";"Cantidad";"TotaLinea(Neto)";"Moneda";"Monto Total OC Neto";"Descuento Global OC";"Cargos Adicionales OC";"Subtotal OC";"Impuestos";"Monto Total OC";"Rut Unidad de Compra";"Unidad de Compra";"Razon Social Comprador";"Direccion Unidad Compra";"Comuna Unidad Compra";"Region Unidad de Compra";"Institucion";"Sector";"Rut Proveedor";"Nombre Proveedor Sucursal";"Nombre Empresa";"Comuna del Proveedor";"Region del Proveedor";"Observaciones";"Forma de Pago";"Orgcode_Comprador";"Entcode_Comprador";"Orgcode_Proveedor";"Entcode_Proveedor"
```

### Maestra de productos (`maestrascm/MaestraProd_cm_2239-1-lr25.zip` → `GAS.csv`) — separador `,`, UTF-8 BOM

```
CONVENIO MARCO,NÚMERO LICITACIÓN,ID CONVENIO MARCO,ID PROVEEDOR,NOMBRE PROVEEDOR,RUT PROVEEDOR,ID PRODUCTO,CÓDIGO ONU,PRODUCTO,ID TIPO PRODUCTO,TIPO PRODUCTO,REGIÓN,MARCA,MODELO,MEDIDA,STOCK,PRECIO EN TIENDA,PRECIO REGULAR,PRECIO OFERTA,FECHA EJECUCIÓN
```

## (c) Filas de ejemplo (OC terminadas en -CM)

### OC mensual — 5 filas con código `-CM26` de 5 convenios distintos (campos largos recortados a 1.800 caracteres)

```
54417083;"1383-60-CM26";"http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=1383-60-CM26";"AYUDAS TECNICAS, RESOL N°75";"Orden de Compra codigo: 1383-60-CM26 dirigida a BLUNDING S A";"CM";"Proveniente de convenio marco";"No";"No";9;"CM";"Convenio Marco";"NA";6;"Aceptada";4;"Aceptada";2026-03-04;2026-08-21;"NA";2026-03-30;2026-08-24;"NA";1;5;6;784864,5;"CLP";784864,5;125314,5;"IVA";0;0;659550;2379;61.602.242-3;"Hospital Vilcún";7049;"HOSPITAL VILCUN";"Salud";"SALUD";"Vilcún";"Región de la Araucanía ";"CL";67320;79.744.580-0;"BLUNDING S.A.";65382;"BLUNDING S.A.";"FABRICACION DE EQUIPO MEDICO Y QUIRURGICO, Y DE APARATOS ORTOPEDICOS";"";"NA";"CL";"";19;"CL";12;2;"";"2239-21-LR23";147466230;"NA";"";0;"BASTÓN BLUNDING CANADIENSE CODERA MÓVIL 85 A 107 CM ALTO UNIDAD";"NA";"NA";"NA";"(2229125) BASTÓN BLUNDING CANADIENSE CODERA MÓVIL 85 A 107 CM ALTO UNIDAD";"(2229125) BASTÓN BLUNDING CANADIENSE CODERA MÓVIL 85 A 107 CM ALTO UNIDAD ; Región de la Araucanía ; Vilcún; Bulnes 680";60;"NA";"CLP";6325;0;0;0;379500;"30 dias contra la recepcion conforme de la factura"
54468068;"591-86-CM26";"http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=591-86-CM26";"SERVICIOS DE OPERACIONES TI-sbg";"Orden de Compra codigo: 591-86-CM26 dirigida a APIUX TECNOLOGIA SPA";"CM";"Proveniente de convenio marco";"No";"No";9;"CM";"Convenio Marco";"NA";6;"Aceptada";4;"Aceptada";2026-03-12;2026-08-04;"NA";2026-08-04;2026-08-05;"NA";1;2,8;2;38923,4;"CLF";1550775155,59375;0;"Exento";2048,6;0;40972;1587;61.603.000-0;"FONASA, Nivel Central";6954;"FONDO NACIONAL DE SALUD";"Salud";"GOBIERNO CENTRAL Y ADMINISTRACION PUBLICA";"Rancagua";"Región del Libertador General Bernardo O´Higgins";"CL";864497;76.516.485-0;"Apiux Tecnología";1459899;"APIUX TECNOLOGIA SPA";"EMPRESAS DE SERVICIOS INTEGRALES DE INFORMATICA| OTRAS ACTIVIDADES EMPRESARIALES N.C.P.";"";"NA";"";4325;0;"CL";12;2;"";"2239-19-LR23";147626694;"NA";"";0;"PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS";"NA";"NA";"NA";"(2234535) PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS";"(2234535) PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS ; Región Metropolitana de Santiago; Santiago; Direccion no aplica a productos virtuales";1;"NA";"CLF";40972;0;0;0;40972;"30 dias contra la recepcion conforme de la factura"
54759488;"1057431-1436-CM26";"http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=1057431-1436-CM26";"Orden de Compra: 1057431-1436-CM26";"Orden de Compra codigo: 1057431-1436-CM26 dirigida a JOSE VICENTE SUAZO BENITEZ";"CM";"Proveniente de convenio marco";"No";"No";9;"CM";"Convenio Marco";"1057431-3-PC26";12;"Recepcion Conforme";7;"Recepcion Conforme";2026-05-06;2026-08-13;"NA";2026-07-28;2026-08-13;"NA";1;0;0;70089120;"CLP";70089120;0;"IVA";0;0;70089120;1057431;61.602.295-4;"1057431 Bienes y Servicios HTC";7479;"SERVICIO NAC DE SALUD HOSPITAL TRAUMATOLOGICO";"Salud";"Salud - Traumatología ";"Concepción";"Región del Biobío ";"CL";524451;"8.693.714-k";"Jose Vicente Suazo";1051567;"JOSÉ VICENTE SUAZO BENÍTEZ";"MAYORISTA DE FRUTAS Y VERDURAS| OTRAS ACTIVIDADES DE SERVICIOS PERSONALES N.C.P.";"";"NA";"CL";6137;19;"CL";12;2;"";"2239-9-LR24";148584388;"NA";"";0;"COLIFLOR CONGELADA MINUTO VERDE BOLSA 1 K UNIDAD VIII REGIÓN";"NA";"NA";"NA";"(4287692) COLIFLOR CONGELADA MINUTO VERDE BOLSA 1 K UNIDAD VIII REGIÓN";"(4287692) COLIFLOR CONGELADA MINUTO VERDE BOLSA 1 K UNIDAD VIII REGIÓN ; Región del Biobío ; Concepción; Avenida Roosevelt  1582";1800;"NA";"CLP";2773;0;0;0;4991400;"30 dias contra la recepcion conforme de la factura"
54789631;"800-2774-CM26";"http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=800-2774-CM26";"MAV_ 280251	COMPRESAS LAPAROTOMIA DESECHABLES ( 1 X 5 uN) / 214872";"OCI: 214872
FACTURAR:
Razón Social: Universidad de Chile
Giro: Actividad de Hospitales y Clínicas Públicas
Rut: 60.910.000-1
Dirección: Dr. Carlos Lorca Tobar N° 999, Independencia, Santiago
Correo envió de Factura: dte-recepcion@intercambio-planecloud.cl";"CM";"Proveniente de convenio marco";"No";"No";9;"CM";"Convenio Marco";"NA";12;"Recepcion Conforme";7;"Recepcion Conforme";2026-05-11;2026-08-09;2026-06-22;2026-06-22;2026-08-11;"NA";1;3;30;69243125;"CLP";69243125;11055625;"IVA";0;0;58187500;1796;60.910.000-1;"Hospital Clínico Univ. de Chile - Insumos Clínicos";7251;"UNIVERSIDAD DE CHILE";"Gob. Central, Universidades";"VENTA AL POR MENOR DE OTROS PRODUCTOS EN PEQUENOS ALMACENES NO ESPECIA| OTRAS ACTIVIDADES EMPRESARIALES N.C.P.| UNIVERSIDADES| HOSPITALES Y CLINICAS";"Independencia";"Región Metropolitana de Santiago";"CL";742992;81.210.400-4;"REUTTER CM";31590;"REUTTER S A";"VENTA AL POR MAYOR DE PRODUCTOS TEXTILES, PRENDAS DE VESTIR Y CALZADO| VENTA AL POR MAYOR DE OTROS ENSERES DOMESTICOS N.C.P.| VENTA AL POR MAYOR DE PRODUCTOS QUIMICOS| VENTA AL POR MAYOR DE MAQUINARIA, HERRAMIENTAS, EQUIPO Y MATERIALES N.| VENTA AL POR MA";"";"NA";"CL";214872;19;"CL";12;2;"";"2239-21-LR23";148680720;"NA";"";0;"COMPRESA RADIOPACA CRANBERRY ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES";"NA";"NA";"NA";"(2230238) COMPRESA RADIOPACA CRANBERRY ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES";"(2230238) COMPRESA RADIOPACA CRANBERRY ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES ; Región Metropolitana de Santiago; Independencia; Dr. Carlos Lorca Tobar 999 (Ex Santos Dumont)";66500;"NA";"CLP";875;0;0;0;58187
54801716;"3378-4239-CM26";"http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=3378-4239-CM26";"Adquisición de seguro colectivo de vida con adicional de salud para personal del HMS";"SR. OFERENTE, FAVOR CONSIDERAR DOCUMENTO ADJUNTO A LA ORDEN DE COMPRAS EMITIDA QUE INDICA LAS DISPOSICIONES Y ORIENTACIONES   QUE DEBE TENER PRESENTE AL MOMENTO DE FACTURAR."

La factura electrónica debe ser enviada a la casilla 61101030-3@febos.cl
";"CM";"Proveniente de convenio marco";"No";"No";9;"CM";"Convenio Marco";"NA";6;"Aceptada";4;"Aceptada";2026-05-13;2026-08-11;2026-08-11;2026-08-11;2026-08-11;"NA";1;5;1;363,107;"CLF";14629751,2364062;0;"IVA";0;0;363,107;4299;61.101.030-3;"Hospital Militar de Santiago- HMS";111870;"DIVISION LOGISTICA DEL EJERCITO";"FFAA";"Defensa";"La Reina";"Región Metropolitana de Santiago";"CL";532713;"96.573.600-K";"BCI Seguros Vida S.A";1066281;"BCI SEGUROS VIDA S A";"PLANES DE SEGURO DE VIDA| PLANES DE SEGUROS GENERALES";"";"NA";"CL";"FONDOS INTERNOS";19;"CL";12;49;"";"2239-12-LR23";148721614;"NA";"";0;"SEGURO COLECTIVO DE VIDA CON ADICIONAL DE SALUD Y CATASTRÓFICO - PLAN 1 VALOR PRIMA MENSUAL";"NA";"NA";"NA";"(2035635) SEGURO COLECTIVO DE VIDA CON ADICIONAL DE SALUD Y CATASTRÓFICO - PLAN 1 VALOR PRIMA MENSUAL";"(2035635) SEGURO COLECTIVO DE VIDA CON ADICIONAL DE SALUD Y CATASTRÓFICO - PLAN 1 VALOR PRIMA MENSUAL ; Región Metropolitana de Santiago; La Reina; Avenida Fernando Castillo Velasco N° 9100";331;"NA";"CLF";1,097;0;0;0;363,107;"NA"
```

Fila adicional del mismo archivo, OC `4778-495-CM25` (la misma que abre el archivo de Convenio Marco): `Tipo=CM; ProcedenciaOC=Proveniente de convenio marco; CodigoTipo=9; CodigoAbreviadoTipoOC=CM; DescripcionTipoOC=Convenio Marco; CodigoLicitacion=(vacío); Codigo_ConvenioMarco=2239-1-LR25; codigoCategoria=NA; codigoProductoONU=0; NombreroductoGenerico=GAS LICUADO GRANEL LITRO REGIÓN DEL AYSÉN; MontoTotalOC=11497724,07`.

### Transacciones Convenio Marco — 5 filas (5 convenios distintos)

```
"2239-1-LR25";5802379;"Convenio Marco Gas Licuado de Petróleo (Magento)";"4778-495-CM25";"RBEC-E.IND.-Solicitud de Compra Industrial N° 104-Orden de Compra: 4778-495-CM25-ITEM 2205003";"2026-08-17";"Recepcion Conforme";"No";"NA";"(4510619) GAS LICUADO GRANEL LITRO REGIÓN DEL AYSÉN";4510619;"GAS LICUADO GRANEL LITRO REGIÓN DEL AYSÉN";"Gas de petróleo licuefactado";"GAS LICUADO GRANEL";"-";"LITRO";371;26043;9661953;"CLP";9661953;0;0;9661953;1835771,07;11497724,07;"61.602.280-6";"Compras de Insumos y Servicios Generales";"SERVICIO NACIONAL DE SALUD HOSPITAL DE C";"Calle Dr Jorge Ibar 068";"Coyhaique";"Aysén";"SERVICIO NACIONAL DE SALUD HOSPITAL DE C";"Salud";"96.568.740-8";"GASCO GLP - DIVISION SUR";"GASCO GLP S A";"";"NA";"Orden de Compra codigo: 4778-495-CM25 dirigida a GASCO GLP S A";"30 dias contra la recepcion conforme de la factura";5693;7340;27100;27247
"2239-21-LR23";5802355;"Convenio Marco de Insumos y Dispositivos Médicos (Magento)";"1383-60-CM26";"AYUDAS TECNICAS, RESOL N°75";"2026-08-21";"Aceptada";"No";"NA";"(2236873) BASTÓN BLUNDING MANO ESTÁNDAR UNIDAD";2236873;"BASTÓN BLUNDING MANO ESTÁNDAR UNIDAD";"Cañas o accesorios de caña";"BASTÓN";"BLUNDING";"MANO ESTÁNDAR UNIDAD";5601;50;280050;"CLP";659550;0;0;659550;125314,5;784864,5;"61.602.242-3";"Hospital Vilcún";"HOSPITAL VILCUN";"BULNES 680, VILCUN, IX REGION ";"Vilcún";"Araucanía";"HOSPITAL VILCUN";"Salud";"79.744.580-0";"BLUNDING S.A.";"BLUNDING S.A.";"";"NA";"Orden de Compra codigo: 1383-60-CM26 dirigida a BLUNDING S A";"30 dias contra la recepcion conforme de la factura";2379;7049;67320;65382
"2239-19-LR23";5802363;"ADQUISICIÓN DE LOS SERVICIOS DE DESARROLLO Y MANTENCIÓN DE SOFTWARE, SERVICIOS PROFESIONALES TI E IN";"591-86-CM26";"SERVICIOS DE OPERACIONES TI-sbg";"2026-08-04";"Aceptada";"No";"NA";"(2234535) PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS";2234535;"PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS";"Soporte y mantenimiento de red de área local (LAN)";"PROYECTO DE MANTENCIÓN Y/O SOPORTE DE INFRAESTRUCTURA TI Y SISTEMAS INFORMÁTICOS";"-";"";40972;1;40972;"CLF";40972;2048,6;0;38923,4;0;38923,4;"61.603.000-0";"FONASA, Nivel Central";"FONDO NACIONAL DE SALUD";"Jose Miguel Carrera Nº 1725";"Rancagua";"Metropolitana";"FONDO NACIONAL DE SALUD";"Salud";"76.516.485-0";"Apiux Tecnología";"APIUX TECNOLOGIA SPA";"";"NA";"Orden de Compra codigo: 591-86-CM26 dirigida a APIUX TECNOLOGIA SPA";"30 dias contra la recepcion conforme de la factura";1587;6954;864497;1459899
"2239-9-LR24";5802368;"Convenio Marco para la adquisición de Alimentos (Magento)";"1057431-1436-CM26";"Orden de Compra: 1057431-1436-CM26";"2026-08-13";"Recepcion Conforme";"No";"NA";"(4519064) POROTO VERDE CONGELADO FRUTOS DEL MAIPO CORTE FRANCES BOLSA 1K UNIDAD VIII REGIÓN";4519064;"POROTO VERDE CONGELADO FRUTOS DEL MAIPO CORTE FRANCES BOLSA 1K UNIDAD VIII REGIÓN";"Verduras congeladas";"POROTO VERDE CONGELADO";"FRUTOS DEL MAIPO";"CORTE FRANCES BOLSA 1K UNIDAD";3546;1500;5319000;"CLP";70089120;0;0;70089120;0;70089120;"61.602.295-4";"1057431 Bienes y Servicios HTC";"SERVICIO NAC DE SALUD HOSPITAL TRAUMATOLOGICO";"San Martín N°1580";"Concepción";"Bío-Bío";"SERVICIO NAC DE SALUD HOSPITAL TRAUMATOLOGICO";"Salud";"8.693.714-k";"Jose Vicente Suazo";"JOSÉ VICENTE SUAZO BENÍTEZ";"";"NA";"Orden de Compra codigo: 1057431-1436-CM26 dirigida a JOSE VICENTE SUAZO BENITEZ";"30 dias contra la recepcion conforme de la factura";1057431;7479;524451;1051567
"2239-21-LR23";5802355;"Convenio Marco de Insumos y Dispositivos Médicos (Magento)";"800-2774-CM26";"MAV_ 280251	COMPRESAS LAPAROTOMIA DESECHABLES ( 1 X 5 uN) / 214872";"2026-08-09";"Recepcion Conforme";"No";"NA";"(2230238) COMPRESA RADIOPACA CRANBERRY ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES";2230238;"COMPRESA RADIOPACA CRANBERRY ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES";"Compresas de presión alternativa o bombas";"COMPRESA RADIOPACA";"CRANBERRY";"ESTÉRIL TIRA AZUL 45 X 45 CM 5 UNIDADES";875;66500;58187500;"CLP";58187500;0;0;58187500;11055625;69243125;"60.910.000-1";"Hospital Clínico Univ. de Chile - Insumos Clínicos";"UNIVERSIDAD DE CHILE";"Dr. Carlos Lorca Tobar 999 (Ex Santos Dumont)";"Independencia";"Metropolitana";"Universidad de Chile";"Gob. Central, Universidades";"81.210.400-4";"REUTTER CM";"REUTTER S A";"";"NA";"OCI: 214872
FACTURAR:
Razón Social: Universidad de Chile
Giro: Actividad de Hospitales y Clínicas Públicas
Rut: 60.910.000-1
Dirección: Dr. Carlos Lorca Tobar N° 999, Independencia, Santiago
Correo envió de Factura: dte-recepcion@intercambio-planecloud.cl";"30 dias contra la recepcion conforme de la factura";1796;7251;742992;31590
```

### Maestra de productos — 1 fila

```
GAS,2239-1-LR25,5802379,26592,ABASTIBLE S.A.,91.806.000-6,4510558,15111510,GAS LICUADO CILINDRO MEDIANTE VALE DE RECARGA 11 KG REGIÓN DE TARAPACÁ,10010,GAS LICUADO CILINDRO MEDIANTE VALE DE RECARGA,TARAPACÁ,-,11 KG,REGIÓN DE TARAPACÁ,SI,14368,14368,,2026-09-21
```

## (d) Columnas que identifican el convenio marco y valores vistos en agosto 2026

### En el archivo de OC (`oc-da`)

- **`Codigo_ConvenioMarco`**: número de licitación del convenio (ej. `2239-1-LR25`). Es la ÚNICA columna que identifica el convenio; **no trae el nombre**. Vale `NA` en toda OC que no sea de convenio marco. Este campo no existe en la API.
- `Tipo` / `CodigoAbreviadoTipoOC` = `CM`, `CodigoTipo` = `9`, `DescripcionTipoOC` = `Convenio Marco`, `ProcedenciaOC` = `Proveniente de convenio marco`.
- Para OC de CM: `CodigoLicitacion` vacío; `codigoCategoria`, `Categoria`, `RubroN1..3` en `NA`/vacío; `codigoProductoONU` = 0. El producto solo se ve en `NombreroductoGenerico` / `EspecificacionComprador` (con el `IDProductoCM` entre paréntesis).

Conteo de OC por convenio en `oc-da/2026-8` (18 valores distintos; OC únicas, líneas de ítem y monto en pesos sumado por OC única):

| Codigo_ConvenioMarco | OC únicas | Líneas | Monto total OC (CLP) |
|---|---|---|---|
| 2239-16-LR23 | 5721 | 11060 | 1,828,759,388 |
| 2239-9-LR24 | 2778 | 28804 | 13,220,680,813 |
| 2239-21-LR23 | 2433 | 5639 | 9,883,610,985 |
| 2239-1-LR25 | 2113 | 2615 | 5,257,014,906 |
| 2239-8-LR25 | 952 | 7259 | 4,504,567,805 |
| 2239-13-LR25 | 795 | 1024 | 7,501,933,551 |
| 2239-8-LR24 | 741 | 1992 | 7,342,133,017 |
| 2239-16-LR24 | 689 | 9416 | 2,114,385,842 |
| 2239-9-LR23 | 411 | 2246 | 2,933,691,312 |
| 2239-5-LR25 | 329 | 392 | 3,737,556,455 |
| 2239-1-LR26 | 317 | 317 | 6,279,911,928 |
| 2239-15-LR25 | 119 | 223 | 1,768,719,546 |
| 2239-12-LR25 | 75 | 75 | 1,882,438,995 |
| 2239-19-LR23 | 72 | 72 | 6,034,528,552 |
| 2239-11-LR24 | 62 | 67 | 1,602,320,324 |
| 2239-6-LR25 | 59 | 63 | 1,799,964,425 |
| 2239-4-LR25 | 51 | 51 | 1,071,181,519 |
| 2239-12-LR23 | 16 | 17 | 239,381,332 |

### En el archivo de Convenio Marco (`planillas-cm`)

- **`Nro Licitacion Publica`** = mismo valor que `Codigo_ConvenioMarco` (clave de cruce entre ambos archivos y con la maestra).
- **`Id Convenio Marco`** = ID numérico interno del convenio (ej. `5802379`).
- **`Convenio Marco`** = nombre del convenio.
- Producto: `IDProductoCM`, `Producto`, `Nombre Producto ONU` (rubro ONU), `Tipo de Producto`, `Marca`, `Modelo`.

Valores distintos en `planillas-cm/2026-8` (23 combinaciones, ordenadas por OC únicas):

| Nro Licitacion Publica | Id Convenio Marco | Convenio Marco | OC únicas | Líneas |
|---|---|---|---|---|
| 2239-16-LR23 | 5802364 | Convenio Marco para la adquisición de pasajes aéreos nacionales | 5736 | 11096 |
| 2239-9-LR24 | 5802368 | Convenio Marco para la adquisición de Alimentos (Magento) | 2800 | 29007 |
| 2239-21-LR23 | 5802355 | Convenio Marco de Insumos y Dispositivos Médicos (Magento) | 2441 | 5662 |
| 2239-1-LR25 | 5802379 | Convenio Marco Gas Licuado de Petróleo (Magento) | 2117 | 2620 |
| 2239-8-LR25 | 5802374 | CM Artículos de Aseo e Higiene (Magento) | 973 | 7437 |
| 2239-13-LR25 | 5802392 | Convenio Marco para suministro de combustibles (Magento) | 796 | 1025 |
| 2239-8-LR24 | 5802366 | Convenio Marco para Emergencias y Prevención | 745 | 1996 |
| 2239-16-LR24 | 5802377 | Convenio Marco Artículos de Escritorio y Papelería (2024) | 697 | 9534 |
| 2239-9-LR23 | 5802338 | Convenio Marco Productos de Ferreteria y Servicios (Magento) | 436 | 2526 |
| 2239-5-LR25 | 5802388 | Convenio Marco de Venta y Arriendo de Computadoras y Accesorios (Magento) | 339 | 402 |
| 2239-1-LR26 | 5802384 | Administración y entrega de beneficios de alimentación, sala cuna, jardínes infantiles y tarjetas de | 319 | 319 |
| 2239-23-LP10 | 5800143 | PASAJES AEREOS NACIONALES REGULARES | 304 | 312 |
| 2239-15-LR25 | 5802396 | Convenio Marco Convenio Marco de Endoprótesis, Ortopedia y Trauma (Magento) | 119 | 223 |
| NA | NA | NA | 118 | 343 |
| 2239-12-LR25 | 5802394 | CM de Transporte Privado de Pasajeros, Arriendo de Vehículos y Arriendo de Maquinaria(Magento) | 75 | 75 |
| 2239-19-LR23 | 5802363 | ADQUISICIÓN DE LOS SERVICIOS DE DESARROLLO Y MANTENCIÓN DE SOFTWARE, SERVICIOS PROFESIONALES TI E IN | 73 | 73 |
| 2239-11-LR24 | 5802370 | Convenio Marco para la adquisición de licencias de software de ofimática (Magento) | 66 | 74 |
| 2239-6-LR25 | 5802386 | Convenio Marco de Compra de Vehículos y Maquinaria (Magento) | 63 | 67 |
| 2239-4-LR25 | 5802381 | Convenio Marco de Mobiliario General (Magento) | 51 | 51 |
| 2239-12-LR23 | 5802348 | Convenio Marco para la adquisición seguros de vida con adicional de salud | 18 | 19 |
| 2239-13-LR23 | 5802346 | CM Administración,Entrega de Beneficios y Tarjetas de Beneficios Institucionales y Sociales(Magento) | 1 | 1 |
| 2239-4-LR22 | 5802327 | LIC. SW. OFIMÁTICA Y SERV. INSTALACIÓN Y MIGRACIÓN(Magento) | 1 | 2 |
| 2239-2-LR21 | 5800295 | Administración y entrega de beneficios de alimentación y tarjetas giftcard | 1 | 1 |

Observaciones: hay 343 líneas (118 OC) con `NA` en las tres columnas de convenio. Sufijos de `CodigoOC` en este archivo: CM 72.193, SE 656, CC 16 — es decir, algunas OC de convenio se emiten con tipo SE/CC (convenios antiguos como `2239-23-LP10` y Grandes Compras). Estados: Recepcion Conforme 37.358, Aceptada 32.585, Enviada a Proveedor 1.363, En Proceso 759, No aceptada 416, Cancelada 247, Cancelada por Comprador 78, Solicitud de Cancelacion 59.

Convenios vigentes según `CM_publicados.csv` (21-09-2026): 2239-1-lr25, 2239-1-lr26, 2239-11-lr24, 2239-12-lr23, 2239-12-lr25, 2239-13-lr25, 2239-15-lr25, 2239-16-lr23, 2239-16-lr24, 2239-19-lr23, 2239-21-lr23, 2239-4-lr25, 2239-5-lr25, 2239-6-lr25, 2239-8-lr24, 2239-8-lr25, 2239-9-lr23, 2239-9-lr24.

## (e) Cómo cruzar con la tabla de OC

- Clave: **`planillas-cm.CodigoOC` = `oc-da.Codigo`** (código de la OC, ej. `4778-495-CM25`). Ambos también traen el `Link` implícito `http://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=[Codigo]`.
- Para el nombre del convenio: **`oc-da.Codigo_ConvenioMarco` = `planillas-cm."Nro Licitacion Publica"` = `maestra."NÚMERO LICITACIÓN"`** (ojo: la maestra usa minúsculas en el nombre del archivo, `2239-1-lr25`, pero mayúsculas dentro del CSV).
- Para el producto: `planillas-cm.IDProductoCM` = `maestra."ID PRODUCTO"`; en `oc-da` el mismo ID va entre paréntesis al inicio de `EspecificacionComprador` (`(4510619) GAS LICUADO...`).
- Cruce verificado agosto 2026: 18.165 de 18.288 OC del archivo CM (99,3 %) están en `oc-da/2026-8`. Las 123 restantes (ej. `1057379-433-CM26`) tienen `FechaEnvio` en otro mes, así que el cruce debe hacerse contra varios meses de `oc-da` (los meses se definen por `FechaEnvio`).
- Regla empírica validada sobre 433.887 líneas: sufijo del código de OC ⇔ `Tipo` (AG=183.899, SE=157.227, CM=71.332, TD=18.666, CC=2.712, CT=51; 100 % de coincidencia), y `Codigo_ConvenioMarco` tiene valor solo cuando el sufijo es `-CM`. `ProcedenciaOC = "Proveniente de convenio marco"` aparece en 72.004 líneas (672 más que `Tipo=CM`): OC de convenio emitidas como SE/CC.

## (f) Documentación oficial de la API de Órdenes de Compra

PDF: `https://www.chilecompra.cl/wp-content/uploads/2026/03/Documentacion-API-Mercado-Publico-oc.pdf` (340.993 bytes, 6 páginas, "Diccionario de Datos - Órdenes de Compra / Api.Mercadopublico.cl"). Endpoint: `http://api.mercadopublico.cl/servicios/v1/publico/OrdenCompra.json?codigo=[Codigo orden de Compra]&ticket=[Ticket de Acceso]` (también `.xml` y `.jsonp`).

**Sobre "-CM": el PDF NO contiene ninguna frase que diga que los códigos terminados en "-CM" son de Convenio Marco.** Lo único que dice, textualmente (anexo 3.1):

> "3.1 Tipo de orden de compra.
> Ruta <Ordenes>/<Listado>/<OrdenCompra>/<Tipo>
> Descripción ID del tipo de Orden de compra de Mercado Publico
> Codigo Abreviación Descripción
> 8 SE Sin emisión automática.
> 9 CM Convenio Marco."

La página web de la API (`https://api.mercadopublico.cl/modules/OrdenCompra.aspx`, sección "ANEXOS – Tipo orden de compra") publica la tabla completa, textualmente:

> "1 OC Automática | 2 D1 Trato directo que genera Orden de Compra por proveedor único. | 3 C1 Trato directo que genera Orden de Compra por emergencia, urgencia e imprevisto. | 4 F3 Trato directo que genera Orden de Compra por confidencialidad. | 5 G1 Trato directo que genera Orden de Compra por naturaleza de negociación. | 6 R1 Orden de compra menor a 3UTM | 7 CA Orden de compra sin resolución. | 8 SE Sin emisión automática | 9 CM Convenio Marco | 10 FG Trato Directo (Art. 8 letras f y g - Ley 19.886) | 11 TL Convenio Marco – Tienda de Libros (Obsoleto) | 12 MC Microcompra | 13 AG Compra Ágil | 14 CC Compra Coordinada"

En los datos abiertos de 2026 aparecen además `TD` (16, "Proveniente de Ficha de Trato Directo") y `CT` (17, "Proveniente de compra por Cotización"), no listados en la web.

**La API NO devuelve el ID ni el nombre del convenio marco.** Solo `Tipo=CM`/`CodigoTipo=9`; `CodigoLicitacion` viene vacío para OC de CM. El campo `Codigo_ConvenioMarco` existe únicamente en los CSV de datos abiertos.

Campos del servicio de OC según el PDF (sección 2, "INFORMACION DE CAMPOS DISPONIBLES EN Órdenes de Compra"):

| # | Campo | Descripción | Tipo | Largo |
|---|---|---|---|---|
| 1 | Cantidad | Cantidad de Licitaciones consultadas | Int | |
| 2 | FechaCreacion | Fecha de consulta | DateTime | |
| 3 | Version | Versión del API de Mercado Público | texto | |
| 4 | Listado/Codigo | Código de la Orden de compra de Mercado Publico | Nvarchar | 50 |
| 5 | Listado/Nombre | Nombre de la Orden de Compra | Nvarchar | 255 |
| 6 | Listado/CodigoEstado | Código del estado en el que se encuentra la Orden de compra | Int | 4 |
| 7 | Listado/CodigoLicitacion | Código de la Licitación asociada a la Orden de Compra | Nvarchar | 50 |
| 8 | Listado/Descripcion | Descripción de la Orden de Compra | Nvarchar | 2000 |
| 9 | Listado/CodigoTipo | Código del tipo de Orden de Compra | Nvarchar | 80 |
| 10 | Listado/Tipo | Tipo de Orden de compra | Nvarchar | 2 |
| 11 | Listado/TipoMoneda | Tipo Moneda de la Orden de Compra | Nvarchar | 255 |
| 12 | Listado/CodigoEstadoProveedor | Código estado del Proveedor | Int | |
| 13 | Listado/EstadoProveedor | Estado del Proveedor | Nvarchar | 255 |
| 14 | Listado/Fechas/FechaCreacion | Fecha de creación de la Orden de compra | DateTime | |
| 15 | Listado/Fechas/FechaEnvio | Fecha de envío de la Orden de compra | DateTime | |
| 16 | Listado/Fechas/FechaAceptacion | Fecha de aceptación Orden de compra | DateTime | |
| 17 | Listado/Fechas/FechaCancelacion | Fecha cancelación de orden de compra | DateTime | |
| 18 | Listado/Fechas/FechaUltimaModificacion | Fecha de Ultima Modificación de la Orden de compra | DateTime | |
| 19 | Listado/TieneItems | Indica si tiene Items. 1 = SI, 0 = NO | Nvarchar | 255 |
| 20 | Listado/PromedioCalificacion | Promedio de calificación del proveedor | Float | |
| 21 | Listado/CantidadEvaluacion | Evaluación del proveedor | Int | |
| 22 | Listado/Descuentos | Descuento aplicado a la Orden de compra | Float | |
| 23 | Listado/Cargos | Cargos aplicados a la Orden de compra | Float | |
| 24 | Listado/TotalNeto | Total neto de la Orden de compra | Float | |
| 25 | Listado/PorcentajeIva | Porcentaje del IVA aplicado a la Orden de compra | Float | |
| 26 | Listado/Impuestos | Impuesto aplicado a la Orden de compra | Float | |
| 27 | Listado/Total | Total de la Orden de compra | Float | |
| 28 | Listado/Financiamiento | Fuente de Financiamiento | Nvarchar | 255 |
| 29 | Listado/Pais | País al que pertenece la Orden de compra | Nvarchar | 255 |
| 30 | Listado/TipoDespacho | Código que identifica el Tipo de Despacho. Anexo 3.3 | Nvarchar | 255 |
| 31 | Listado/FormaPago | Código que identifica la forma de pago. Anexo 3.4 | Nvarchar | 255 |
| 32 | Listado/Comprador/CodigoOrganismo | Código que identifica al organismo comprador | Nvarchar | 20 |
| 33 | Listado/Comprador/NombreOrganismo | Nombre del organismo del comprador | Nvarchar | 255 |
| 34 | Listado/Comprador/RutUnidad | Rut de la Unidad | Nvarchar | 20 |
| 35 | Listado/Comprador/CodigoUnidad | Código de Unidad | Nvarchar | 20 |
| 36 | Listado/Comprador/NombreUnidad | Nombre de Unidad | Nvarchar | 255 |
| 37 | Listado/Comprador/Actividad | Actividad del Comprador | Nvarchar | 255 |
| 38 | Listado/Comprador/DireccionUnidad | Dirección de la unidad compradora | Nvarchar | 255 |
| 39 | Listado/Comprador/ComunaUnidad | Comuna de la unidad compradora | Nvarchar | 255 |
| 40 | Listado/Comprador/RegionUnidad | Región de la unidad compradora | Nvarchar | 255 |
| 41 | Listado/Comprador/Pais | País de la unidad compradora | Nvarchar | 255 |
| 42 | Listado/Comprador/NombreContacto | Nombre contacto | Nvarchar | 255 |
| 43 | Listado/Comprador/CargoContacto | Cargo del contacto | Nvarchar | 255 |
| 44 | Listado/Comprador/FonoContacto | Teléfono del Contacto | Nvarchar | 100 |
| 45 | Listado/Comprador/MailContacto | E Mail del contacto | Nvarchar | 50 |
| 46 | Listado/Proveedor/Codigo | Código del proveedor | Nvarchar | 20 |
| 47 | Listado/Proveedor/Nombre | Nombre del proveedor | Nvarchar | 255 |
| 48 | Listado/Proveedor/Actividad | Actividad del Proveedor | Nvarchar | 255 |
| 49 | Listado/Proveedor/CodigoSucursal | Código de la sucursal del proveedor | Nvarchar | 20 |
| 50 | Listado/Proveedor/NombreSucursal | Nombre de la sucursal del proveedor | Nvarchar | 255 |
| 51 | Listado/Proveedor/RutSucursal | Rut del Proveedor | Nvarchar | 20 |
| 52 | Listado/Proveedor/Direccion | Dirección del proveedor | Nvarchar | 255 |
| 53 | Listado/Proveedor/Comuna | Comuna del proveedor | Nvarchar | 255 |
| 54 | Listado/Proveedor/Region | Región del proveedor | Nvarchar | 255 |
| 55 | Listado/Proveedor/Pais | País del proveedor | Nvarchar | 255 |
| 56 | Listado/Proveedor/NombreContacto | Nombre contacto del proveedor | Nvarchar | 255 |
| 57 | Listado/Proveedor/CargoContacto | Cargo del contacto del proveedor | Nvarchar | 255 |
| 58 | Listado/Proveedor/FonoContacto | Teléfono del contacto del proveedor | Nvarchar | 255 |
| 59 | Listado/Proveedor/MailContacto | E Mail del contacto del proveedor | Nvarchar | 255 |
| 60 | Listado/Items/Cantidad | Cantidad de Items (Productos) de la orden de compra | Int | |
| 61 | Listado/Items/Listado | Listado de Items | | |
| 62 | Listado/Items/Listado/Correlativo | Correlativo de Items | BitInt | |
| 63 | Listado/Items/Listado/CodigoCategoria | Código de categoría a la que pertenece el producto | Int | |
| 64 | Listado/Items/Listado/Categoria | Categoría a la que pertenece el producto | Varchar | 400 |
| 65 | Listado/Items/Listado/CodigoProducto | Codigo del producto | Int | |
| 66 | Listado/Items/Listado/EspecificacionComprador | Especificaciones del producto que necesita el comprador | Nvarchar | -1 |
| 67 | Listado/Items/Listado/EspecificacionProveedor | Especificaciones del producto proveído por el proveedor | Nvarchar | 510 |
| 68 | Listado/Items/Listado/Cantidad | Cantidad de productos | Float | |
| 69 | Listado/Items/Listado/Moneda | Tipo de moneda del producto | Nvarchar | 100 |
| 70 | Listado/Items/Listado/PrecioNeto | Precio neto o precio unitario del producto | Float | |
| 71 | Listado/Items/Listado/TotalCargos | Total cargos asociados a la multiplicación del Precioneto * Cantidad | Float | |
| 72 | Listado/Items/Listado/TotalDescuentos | Total Descuentos asociados a la multiplicación del Precioneto * Cantidad | Float | |
| 73 | Listado/Items/Listado/TotalImpuestos | Total de impuesto asociados a la multiplicación del Precioneto * Cantidad | Float | |
| 74 | Listado/Items/Listado/Total | Total final de precios de los productos | Float | |

Otros anexos del PDF: 3.2 TipoMoneda (CLP, CLF, USD, UTM, EUR); 3.3 TipoDespacho (7 Despachar a Dirección de envío; 9 según programa adjuntado; 12 Otra forma; 14 Retiramos de su bodega; 20 courier aéreo; 21 courier terrestre; 22 A convenir); 3.4 FormaPago (1 = 15 días; 2 = 30 días; 39 = Otra; 46 = 50 días; 47 = 60 días contra recepción de la factura).

## (g) Limitaciones y advertencias

1. **Retraso de publicación**: `planillas-cm` se publica ~día 11 del mes siguiente (2026-8 apareció el 11-09-2026); `oc-da` se regenera diariamente y el mes en curso está disponible parcialmente. Al 26-09-2026 no existe `planillas-cm/2026-9.zip` (404).
2. **Los archivos mensuales se reescriben**: todos los `oc-da/2026-*.zip` tienen Last-Modified 25-09-2026 (se regeneran cada día, con estados y montos actualizados). Un mes descargado hace tiempo puede diferir del actual.
3. **Codificación**: el portal declara UTF-8, pero los CSV de `oc-da` y `planillas-cm` de 2026 vienen en Latin-1/Windows-1252 (caracteres como `Petr�leo` si se leen como UTF-8). La maestra `maestrascm` sí es UTF-8 con BOM y separada por coma (no punto y coma).
4. **Nombre de mes sin cero**: `2026-8.zip` funciona; `2026-08.zip` no es el patrón del portal.
5. **Campos multilínea**: `Descripcion/Obervaciones` (OC) y `Observaciones` (CM) contienen saltos de línea dentro de comillas; `wc -l` no da el número de registros (2.345.798 líneas físicas vs 433.887 registros en `oc-da/2026-8`).
6. **Sin diccionario de datos** para las columnas de `oc-da`/`planillas-cm`; el significado de `Codigo_ConvenioMarco` se infirió de los datos. La página `/datos-abiertos/definiciones` es un glosario (estados de OC, mecanismos de compra), no un diccionario columna a columna.
7. **Portal antiguo** `datosabiertos.chilecompra.cl` (URL `/Home/TransaccionConvenioMarcoHistorica`) no resolvió DNS desde el entorno de prueba; el nuevo portal lo sigue enlazando, pero los archivos están en el blob de Azure indicado arriba.
8. **OC de convenio con tipo distinto de CM**: 672 líneas (656 SE + 16 CC) del archivo CM tienen código que no termina en `-CM`; si se filtra solo por sufijo `-CM` se pierden.
9. **Granularidad**: ambos CSV son por ítem/línea, no por OC. Para contar OC hay que deduplicar por `Codigo`/`CodigoOC`.
10. Los montos son compromisos, no pagos (texto oficial del portal). Montos en `TipoMonedaOC` distintos de CLP requieren `MontoTotalOC_PesosChilenos` o `ParidadMoneda.csv`.
