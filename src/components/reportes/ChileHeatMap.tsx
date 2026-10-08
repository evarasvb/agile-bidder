import { useMemo, useState } from 'react';
import chileRegionesGeo from '@/data/chileRegionesGeo.json';
import { formatCompact, formatNumber } from '@/hooks/useReportes';
import type { RegionCalor } from '@/hooks/useMapaCalor';

type RingCoords = [number, number][];
type PolyRings = RingCoords[];
type GeoData = Record<string, PolyRings[]>;

const GEO = chileRegionesGeo as unknown as GeoData;

export type Capa = 'todas' | 'lic' | 'ca';

function valorDe(r: RegionCalor, capa: Capa) {
  if (capa === 'lic') return { monto: r.monto_lic, count: r.count_lic };
  if (capa === 'ca') return { monto: r.monto_ca, count: r.count_ca };
  return { monto: r.monto_lic + r.monto_ca, count: r.count_lic + r.count_ca };
}

// Rampa secuencial de un solo tono (el azul de marca), de claro a oscuro según
// intensidad — nunca arcoíris: es magnitud, no categoría.
const RAMPA = ['#eef1fa', '#ccd4ee', '#9aa8d9', '#6578bf', '#3d4f9e', '#242f66'];

function colorPorIntensidad(monto: number, max: number): string {
  if (max <= 0 || monto <= 0) return '#f1f2f6';
  const t = Math.min(1, monto / max);
  const idx = Math.min(RAMPA.length - 1, Math.floor(t * (RAMPA.length - 1) + 0.0001));
  return RAMPA[idx];
}

// Proyección simple: equirrectangular corregida por coseno de la latitud media
// (Chile es angosto y muy alargado, así que una proyección exacta no aporta
// nada aquí; esto basta para que la forma se vea correcta).
function construirProyeccion(bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number }) {
  const { minLon, maxLon, minLat, maxLat } = bbox;
  const latMedia = (minLat + maxLat) / 2;
  const corr = Math.cos((latMedia * Math.PI) / 180);
  const w = (maxLon - minLon) * corr;
  const h = maxLat - minLat;
  const alto = 640;
  const ancho = (w / h) * alto;
  const pad = 16;
  return {
    ancho: ancho + pad * 2,
    alto: alto + pad * 2,
    proyectar: ([lon, lat]: [number, number]): [number, number] => {
      const x = (lon - minLon) * corr * (ancho / w) + pad;
      const y = (maxLat - lat) * (alto / h) + pad;
      return [x, y];
    },
  };
}

function anillosAPath(rings: PolyRings[], proyectar: (p: [number, number]) => [number, number]): string {
  return rings
    .map((poly) =>
      poly
        .map((ring) => {
          const pts = ring.map(proyectar);
          return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
        })
        .join(' ')
    )
    .join(' ');
}

interface Props {
  data: RegionCalor[];
  capa: Capa;
  regionActiva: string | null;
  onSelectRegion: (region: string) => void;
}

export function ChileHeatMap({ data, capa, regionActiva, onSelectRegion }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const bbox = useMemo(() => {
    let minLon = 999, maxLon = -999, minLat = 999, maxLat = -999;
    for (const polys of Object.values(GEO)) {
      for (const poly of polys) {
        for (const ring of poly) {
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
    }
    return { minLon, maxLon, minLat, maxLat };
  }, []);

  const { ancho, alto, proyectar } = useMemo(() => construirProyeccion(bbox), [bbox]);

  const maxMonto = useMemo(
    () => data.reduce((m, r) => Math.max(m, valorDe(r, capa).monto), 0),
    [data, capa]
  );

  const porGeoKey = useMemo(() => {
    const m = new Map<string, RegionCalor>();
    for (const r of data) m.set(r.geo_key, r);
    return m;
  }, [data]);

  const activo = hover ?? regionActiva;
  const regionActivaData = activo ? data.find((r) => r.geo_key === activo || r.region === activo) : null;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1 flex justify-center">
        <svg
          viewBox={`0 0 ${ancho} ${alto}`}
          className="w-full max-w-[280px] h-auto"
          role="img"
          aria-label="Mapa de calor de Chile por región"
        >
          {Object.entries(GEO).map(([geoKey, polys]) => {
            const r = porGeoKey.get(geoKey);
            const { monto } = r ? valorDe(r, capa) : { monto: 0 };
            const fill = colorPorIntensidad(monto, maxMonto);
            const esActiva = regionActiva && r?.region === regionActiva;
            const esHover = hover === geoKey;
            return (
              <path
                key={geoKey}
                d={anillosAPath(polys, proyectar)}
                fill={fill}
                stroke={esActiva ? '#242f66' : '#ffffff'}
                strokeWidth={esActiva ? 1.5 : 0.6}
                opacity={esHover ? 0.85 : 1}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setHover(geoKey)}
                onMouseLeave={() => setHover((h) => (h === geoKey ? null : h))}
                onClick={() => r && onSelectRegion(r.region)}
              />
            );
          })}
        </svg>

        {regionActivaData && (
          <div className="absolute top-2 left-2 right-2 sm:right-auto rounded-md border bg-background/95 backdrop-blur px-3 py-2 text-xs shadow-sm max-w-[220px]">
            <p className="font-semibold text-foreground leading-tight">{regionActivaData.region}</p>
            {(() => {
              const v = valorDe(regionActivaData, capa);
              return (
                <p className="text-muted-foreground mt-0.5">
                  {formatNumber(v.count)} procesos · {formatCompact(v.monto)}
                </p>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex sm:flex-col items-center sm:items-start gap-2 text-xs text-muted-foreground shrink-0">
        <span className="font-medium">Volumen</span>
        <div className="flex sm:flex-col gap-1">
          {RAMPA.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm border" style={{ backgroundColor: c }} />
              {i === 0 && <span>bajo</span>}
              {i === RAMPA.length - 1 && <span>alto</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
