# Iconos de la Extensión

Los iconos se proporcionan en formato SVG. Para que Chrome los use correctamente, 
convierte los SVG a PNG en los siguientes tamaños:

- icon16.svg → icon16.png (16x16 px)
- icon48.svg → icon48.png (48x48 px)  
- icon128.svg → icon128.png (128x128 px)

## Conversión rápida

Puedes usar herramientas online como:
- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

O desde la línea de comandos con ImageMagick:
```bash
convert -background none icon16.svg -resize 16x16 icon16.png
convert -background none icon48.svg -resize 48x48 icon48.png
convert -background none icon128.svg -resize 128x128 icon128.png
```
