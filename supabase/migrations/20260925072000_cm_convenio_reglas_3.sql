-- Tercera pasada de reglas con lo que seguía 'Sin clasificar' en 2026 (insumos quirúrgicos con marca,
-- alimentos por producto, obras menores, papel multiuso, manga plástica de prevención).
create or replace function public.cm_convenio_de(p_texto text)
returns text language sql immutable as $$
  select case
    when t is null or t = '' then 'Sin clasificar'
    when t ~ '(emergencia|mediagua|kit de alimentos|colchon|frazada|habitabilidad|sabana|almohada|carpa|manga plastica|prevencion)' then 'Emergencias'
    when t ~ '(pasaje aereo|pasajes aereos|boleto aereo|pasaje|pasajes|comision de servicio|latam|sky airline|jetsmart)' then 'Pasajes aéreos'
    when t ~ '(gas licuado|gas de petroleo|estacion de servicio|bencin|diesel|petroleo|combustible|kerosene|parafina|lubricante|vales? de gas|pelet|pellet|lena|carbon)' then 'Combustibles y lubricantes'
    when t ~ '(seguro complementario|seguro colectivo|seguro de|seguros|poliza)' then 'Seguros'
    when t ~ '(licencia|software|suscripcion|microsoft|adobe|antivirus|office 365|autodesk|oracle|saas|windows server|sql server|paquetes de software)' then 'Software'
    when t ~ '(iaas|paas|nube publica|nube privada|datacenter|data center|hosting|infraestructura t(i|ecnologica)|mantenimiento de software|soporte de infraestructura|ciberseguridad|firewall|ecosistema digital|ventanilla unica)' then 'Servicios TI y nube'
    when t ~ '(computador|laptop|notebook|\maio\M|all in one|monitor|impresora|multifuncional|servidor|tablet|thinkcentre|proone|probook|thinkpad|elitebook|toner|cartucho|disco duro|memoria ram|proyector|scanner|escaner|equipos informaticos|equipos computacionales|ups )' then 'Hardware y computación'
    when t ~ '(guante|quirurgic|jeringa|mascarilla|cateter|panal|aposito|examinacion|hospitalia|muncare|nemocare|sonda|gasa|suero|insumos? medicos?|clinico|medicamento|farmac|pabellon|laparoscop|drenaje|canister|engrapadora|sutura|compresa|curacion|esteril|odontolog|barniz de fluor|nutricional|clip titanio|bisturi|electrodo|venda|cateter|hemostasia|radiopac)' then 'Insumos médicos'
    when t ~ '(toalla de papel|bolsa de basura|desinfectante|detergente|cloro|jabon|papel higienico|limpieza|aseo|escobillon|trapero|alcohol gel|lavaloza|interfoliada|wypall)' then 'Aseo e higiene'
    when t ~ '(resma|papel impresion|papel de impresion|lapiz|carpeta|archivador|cuaderno|corchete|destacador|plumon|escritorio y papel|articulos de escritorio|post-it|cinta adhesiva|utiles de oficina|materiales de oficina|papel multiuso)' then 'Artículos de escritorio'
    when t ~ '(mobiliario|silla|escritorio|mueble|estante|kardex|mesa de|sillon|cajonera)' then 'Mobiliario'
    when t ~ '(vestuario|calzado|zapato|polera|uniforme|chaqueta|pantalon|parka|bototo|ropa)' then 'Vestuario y calzado'
    when t ~ '(transporte privado de pasajeros|transporte de pasajeros|arriendo de bus|servicio de transporte)' then 'Transporte de pasajeros'
    when t ~ '(camioneta|automovil|vehiculo|furgon|camion|neumatico|minibus|motocicleta)' then 'Vehículos'
    when t ~ '(esmalte|pintura|cemento|tornillo|herramienta|madera|plancha|fierro|ferreter|electric|cable|ampolleta|luminaria|griferia|sanitario|materiales para mejoramiento|materiales de construccion|instalacion de|aire acondicionado|aires acondicionados|pisos|puertas y ventanas|arriendo de maquinaria|retroexcavadora|maquinaria)' then 'Ferretería y construcción'
    when t ~ '(alimentaci|alimento|viveres|economato|rancho|aceite|lacteo|leche|carne|verdura|fruta|bebida|abarrote|colacion|almuerzo|mercaderia|chuleta|congelad|fresca|hallulla|empanada|supermercado|agua purificada|pollo|pescado|arroz|fideos|azucar|harina|huevo|queso|yogur|sala cuna|jardin infantil)' then 'Alimentos'
    when t ~ '(impresion de|servicio de impresion|imprenta|publicidad|difusion)' then 'Impresión y publicidad'
    when t ~ '(procedimientos administrativos|servicio de|servicios de|consultor|capacitacion|curso|mantencion)' then 'Servicios generales'
    else 'Sin clasificar' end
  from (select public.f_unaccent(lower(coalesce(p_texto, ''))) as t) x;
$$;
