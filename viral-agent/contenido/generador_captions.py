#!/usr/bin/env python3
"""
Multiplicador de contenido: combina pilares x plantillas x formatos x
hashtags para generar un calendario de lanzamiento listo para publicar.

Uso:
    python generador_captions.py [--dias 30] [--salida calendario_lanzamiento.csv]
"""
import argparse
import csv
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pilares import PILARES, BOOK_TITLE  # noqa: E402
from banco_hashtags import TODOS  # noqa: E402

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass

BOOK_URL = os.environ.get("BOOK_URL", "https://www.amazon.com/-/es/dp/B0G4NLY5TL")
SITE_URL = os.environ.get("SITE_URL", "https://www.firmavb.cl")
IG_HANDLE = os.environ.get("IG_HANDLE", "surfeandolicitaciones")

# Imágenes reales (ver plantillas-diseno/generar_variantes.mjs): un pool por
# pilar en vez de una sola imagen fija, para no repetir la misma foto cada
# vez que el pilar rota. Regenerar con: cd plantillas-diseno && npm run render:variantes
IMAGENES_BASE_URL = os.environ.get(
    "IMAGENES_BASE_URL",
    "https://raw.githubusercontent.com/evarasvb/agile-bidder/main/viral-agent/imagenes",
)
POOL_POR_PILAR = {
    "mitos": [f"variantes/mitos-{i:02d}.jpg" for i in range(1, 18)],
    "tips": [f"variantes/tips-{i:02d}.jpg" for i in range(1, 18)],
    "historias": [f"variantes/historias-{i:02d}.jpg" for i in range(1, 18)],
    "backstage": [f"variantes/backstage-{i:02d}.jpg" for i in range(1, 18)],
    "prueba_social": [f"variantes/prueba-social-{i:02d}.jpg" for i in range(1, 17)],
    "cta_directo": [f"variantes/cta-{i:02d}.jpg" for i in range(1, 17)],
}

CITAS_LECTOR_EJEMPLO = [
    "Ojalá lo hubiera leído antes de mi primera postulación",
    "Por fin alguien explica esto en simple",
    "Lo recomendé a todo mi equipo de ventas",
]


def armar_hashtags(rng):
    seleccion = (
        rng.sample(TODOS["nicho"], k=min(4, len(TODOS["nicho"])))
        + rng.sample(TODOS["pyme"], k=min(3, len(TODOS["pyme"])))
        + rng.sample(TODOS["libros"], k=min(2, len(TODOS["libros"])))
        + rng.sample(TODOS["amplios"], k=min(3, len(TODOS["amplios"])))
    )
    return " ".join(seleccion)


def armar_calendario(dias, seed=42):
    rng = random.Random(seed)
    filas = []
    usados_por_pilar = {p["clave"]: 0 for p in PILARES}

    cta_pilar = next(p for p in PILARES if p["clave"] == "cta_directo")
    rotacion = [p for p in PILARES if p["clave"] != "cta_directo"]
    idx_rotacion = 0

    for dia in range(1, dias + 1):
        # cta_directo cae cada 6 días (pilar de venta directa); el resto
        # rota en orden por su propio contador, para que ningún pilar quede
        # fuera solo por coincidir con el día del CTA.
        if dia % 6 == 0:
            pilar = cta_pilar
        else:
            pilar = rotacion[idx_rotacion % len(rotacion)]
            idx_rotacion += 1

        usos_previos = usados_por_pilar[pilar["clave"]]
        idx_caption = usos_previos % len(pilar["captions"])
        caption_tpl = pilar["captions"][idx_caption]

        pool_imagenes = POOL_POR_PILAR[pilar["clave"]]
        imagen = pool_imagenes[usos_previos % len(pool_imagenes)]

        usados_por_pilar[pilar["clave"]] += 1

        caption = caption_tpl.format(
            titulo=BOOK_TITLE,
            cita_lector=rng.choice(CITAS_LECTOR_EJEMPLO),
        )
        formato = rng.choice(pilar["formatos"])

        # Facebook Page aún no existe: primeros 14 días solo Instagram,
        # desde el día 15 se asume que ya está creada (ver README paso 1-2).
        red = "Instagram" if dia <= 14 else rng.choice(["Instagram", "Facebook"])

        filas.append(
            {
                "dia": dia,
                "red": red,
                "formato": formato,
                "pilar": pilar["nombre"],
                "caption": caption,
                "hashtags": armar_hashtags(rng),
                "cta": f"Link del libro: {BOOK_URL} · Más info: {SITE_URL} · Síguenos en @{IG_HANDLE}",
                "imagen_url": f"{IMAGENES_BASE_URL}/{imagen}",
                "estado": "pendiente",
            }
        )
    return filas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dias", type=int, default=30)
    parser.add_argument(
        "--salida",
        default=str(Path(__file__).parent / "calendario_lanzamiento.csv"),
    )
    args = parser.parse_args()

    filas = armar_calendario(args.dias)

    with open(args.salida, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["dia", "red", "formato", "pilar", "caption", "hashtags", "cta", "imagen_url", "estado"],
        )
        writer.writeheader()
        writer.writerows(filas)

    print(f"Calendario de {args.dias} días generado en: {args.salida}")
    print("Revísalo y edita las filas antes de publicar — el agente multiplica variantes,")
    print("tú decides el tono final.")


if __name__ == "__main__":
    main()
