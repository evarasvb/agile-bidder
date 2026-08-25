#!/usr/bin/env python3
"""
Publica en Facebook Page / Instagram Business usando la API oficial de
Meta Graph API. Requiere que ya exista la Página de Facebook y la cuenta
de Instagram Business vinculada (ver README.md, pasos 1-3).

Lee contenido/calendario_lanzamiento.csv, toma la primera fila con
estado="pendiente" para la red indicada, la publica, y marca la fila
como "publicado".

Uso:
    python meta_poster.py --dry-run      # solo muestra qué publicaría
    python meta_poster.py                # publica de verdad
    python meta_poster.py --red Facebook # fuerza una red específica
"""
import argparse
import csv
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

GRAPH_API_VERSION = "v21.0"
GRAPH_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

PAGE_ID = os.environ.get("META_PAGE_ID")
IG_BUSINESS_ID = os.environ.get("META_IG_BUSINESS_ID")
ACCESS_TOKEN = os.environ.get("META_PAGE_ACCESS_TOKEN")

CALENDARIO_PATH = ROOT / "contenido" / "calendario_lanzamiento.csv"


def cargar_calendario():
    if not CALENDARIO_PATH.exists():
        sys.exit(
            f"No existe {CALENDARIO_PATH}. Genera el calendario primero:\n"
            "  python contenido/generador_captions.py"
        )
    with open(CALENDARIO_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def guardar_calendario(filas):
    with open(CALENDARIO_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=filas[0].keys())
        writer.writeheader()
        writer.writerows(filas)


def texto_final(fila):
    return f"{fila['caption']}\n\n{fila['cta']}\n\n{fila['hashtags']}"


def publicar_facebook(texto, dry_run):
    if dry_run:
        print("[DRY-RUN] Publicaría en Facebook Page:\n", texto)
        return True
    resp = requests.post(
        f"{GRAPH_URL}/{PAGE_ID}/feed",
        data={"message": texto, "access_token": ACCESS_TOKEN},
        timeout=30,
    )
    if resp.status_code != 200:
        print("Error publicando en Facebook:", resp.text)
        return False
    print("Publicado en Facebook:", resp.json())
    return True


def publicar_instagram(texto, imagen_url, dry_run):
    """Requiere una imagen pública (imagen_url) — Instagram no acepta posts solo de texto."""
    if dry_run:
        print(f"[DRY-RUN] Publicaría en Instagram (imagen: {imagen_url}):\n{texto}")
        return True
    if not imagen_url:
        print(
            "Falta imagen_url para el post de Instagram de hoy. "
            "Agrega la columna 'imagen_url' al CSV o publica manualmente este formato."
        )
        return False
    contenedor = requests.post(
        f"{GRAPH_URL}/{IG_BUSINESS_ID}/media",
        data={"image_url": imagen_url, "caption": texto, "access_token": ACCESS_TOKEN},
        timeout=30,
    )
    if contenedor.status_code != 200:
        print("Error creando contenedor de Instagram:", contenedor.text)
        return False
    creation_id = contenedor.json()["id"]
    publicacion = requests.post(
        f"{GRAPH_URL}/{IG_BUSINESS_ID}/media_publish",
        data={"creation_id": creation_id, "access_token": ACCESS_TOKEN},
        timeout=30,
    )
    if publicacion.status_code != 200:
        print("Error publicando en Instagram:", publicacion.text)
        return False
    print("Publicado en Instagram:", publicacion.json())
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--red", choices=["Instagram", "Facebook"], default=None)
    args = parser.parse_args()

    if not args.dry_run and not (PAGE_ID and ACCESS_TOKEN):
        sys.exit(
            "Faltan credenciales en .env (META_PAGE_ID / META_PAGE_ACCESS_TOKEN). "
            "Usa --dry-run para probar sin credenciales, o completa el README paso 3."
        )

    filas = cargar_calendario()
    candidatas = [
        f for f in filas
        if f["estado"] == "pendiente" and (args.red is None or f["red"] == args.red)
    ]

    if not candidatas:
        print("No hay filas pendientes para publicar hoy.")
        return

    fila = candidatas[0]
    texto = texto_final(fila)

    if fila["red"] == "Facebook":
        ok = publicar_facebook(texto, args.dry_run)
    else:
        ok = publicar_instagram(texto, fila.get("imagen_url", ""), args.dry_run)

    if ok and not args.dry_run:
        fila["estado"] = "publicado"
        guardar_calendario(filas)


if __name__ == "__main__":
    main()
