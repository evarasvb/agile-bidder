"""
Bancos de hashtags segmentados. El generador toma una muestra de cada
grupo para armar un set de ~15-20 hashtags por post (mezcla de nicho
+ alcance medio + alcance amplio, que es lo que mejor funciona en IG).
"""

NICHO_COMPRAS_PUBLICAS = [
    "#MercadoPublico", "#ComprasPublicas", "#LicitacionesChile",
    "#ChileCompra", "#LicitacionesPublicas", "#ProveedoresDelEstado",
    "#ComprasAgiles", "#VenderleAlEstado",
]

EMPRENDIMIENTO_PYME_CHILE = [
    "#PymesChile", "#EmprendimientoChile", "#PymeChilena",
    "#NegociosChile", "#EmpresariosChile", "#Sercotec",
    "#Corfo", "#PymesDeChile",
]

LIBROS_NEGOCIO = [
    "#LibrosDeNegocios", "#LibroRecomendado", "#LecturaEmpresarial",
    "#BookTokNegocios", "#AutorChileno", "#LibroNuevo",
    "#EmprendedoresLectores",
]

AMPLIOS = [
    "#Emprendimiento", "#Negocios", "#Ventas", "#Marketing",
    "#Chile", "#Pymes", "#Liderazgo",
]

TODOS = {
    "nicho": NICHO_COMPRAS_PUBLICAS,
    "pyme": EMPRENDIMIENTO_PYME_CHILE,
    "libros": LIBROS_NEGOCIO,
    "amplios": AMPLIOS,
}
