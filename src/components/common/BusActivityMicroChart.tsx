import React, { useMemo, useRef, useState } from 'react';

export interface BusActivitySample {
  id?: string;
  direction?: string;
  createdAtMs?: number;
}

interface BusActivityMicroChartProps {
  events: BusActivitySample[];
  nowTs: number;
}

interface HourBucket {
  hour: number;
  label: string;
  haciaZarate: number; // Malvinas -> Zárate
  haciaMalvinas: number; // Zárate -> Malvinas
}

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>, minY: number, maxY: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  const clampY = (val: number) => Math.max(minY, Math.min(maxY, val));
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Monotone-safe Catmull-Rom tension control points clamped inside chart bounds
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export const BusActivityMicroChart: React.FC<BusActivityMicroChartProps> = ({ events, nowTs }) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [seriesFilter, setSeriesFilter] = useState<'all' | 'zarate' | 'malvinas'>('all');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const currentHour = new Date(nowTs).getHours();

  const { buckets, totalZarate, totalMalvinas, maxCount, peakHour } = useMemo(() => {
    const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      haciaZarate: 0,
      haciaMalvinas: 0,
    }));

    const cutoffMs = nowTs - 24 * 60 * 60 * 1000;
    const seenKeys = new Set<string>();

    events.forEach((ev, idx) => {
      const ts = ev.createdAtMs;
      if (typeof ts !== 'number' || !Number.isFinite(ts)) return;
      if (ts < cutoffMs || ts > nowTs + 60000) return;

      const isZarate = ev.direction === 'hacia_zarate';
      const isMalvinas = ev.direction === 'hacia_malvinas';
      if (!isZarate && !isMalvinas) return;

      const dedupKey = ev.id
        ? `${ev.id}_${isZarate ? 'z' : 'm'}`
        : `${Math.floor(ts / 2000)}_${isZarate ? 'z' : 'm'}_${idx}`;
      if (seenKeys.has(dedupKey)) return;
      seenKeys.add(dedupKey);

      const h = new Date(ts).getHours();
      if (h >= 0 && h < 24) {
        if (isZarate) hours[h].haciaZarate += 1;
        if (isMalvinas) hours[h].haciaMalvinas += 1;
      }
    });

    let sumZ = 0;
    let sumM = 0;
    let maxVal = 0;
    let bestHour = -1;
    let bestHourTotal = 0;

    hours.forEach((b) => {
      sumZ += b.haciaZarate;
      sumM += b.haciaMalvinas;
      maxVal = Math.max(maxVal, b.haciaZarate, b.haciaMalvinas);
      const totalH = b.haciaZarate + b.haciaMalvinas;
      if (totalH > bestHourTotal) {
        bestHourTotal = totalH;
        bestHour = b.hour;
      }
    });

    return {
      buckets: hours,
      totalZarate: sumZ,
      totalMalvinas: sumM,
      maxCount: Math.max(2, maxVal),
      peakHour: bestHourTotal > 0 ? bestHour : null,
    };
  }, [events, nowTs]);

  // Geometría SVG Dark FinTech Analytics (sparkline limpio sin ejes ni grillas punteadas)
  const SVG_W = 360;
  const SVG_H = 72;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_T = 7;
  const PAD_B = 5;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;
  const BASELINE_Y = PAD_T + PLOT_H;

  const getX = (hourIdx: number) => PAD_L + (hourIdx / 23) * PLOT_W;
  const getY = (val: number) => BASELINE_Y - (val / maxCount) * PLOT_H;

  const zaratePoints = useMemo(
    () => buckets.map((b) => ({ x: getX(b.hour), y: getY(b.haciaZarate) })),
    [buckets, maxCount]
  );
  const malvinasPoints = useMemo(
    () => buckets.map((b) => ({ x: getX(b.hour), y: getY(b.haciaMalvinas) })),
    [buckets, maxCount]
  );

  const zarateLinePath = useMemo(
    () => buildSmoothSvgPath(zaratePoints, PAD_T, BASELINE_Y),
    [zaratePoints]
  );
  const malvinasLinePath = useMemo(
    () => buildSmoothSvgPath(malvinasPoints, PAD_T, BASELINE_Y),
    [malvinasPoints]
  );

  const zarateAreaPath = useMemo(() => {
    if (!zarateLinePath || zaratePoints.length === 0) return '';
    return `${zarateLinePath} L ${zaratePoints[zaratePoints.length - 1].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} L ${zaratePoints[0].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} Z`;
  }, [zarateLinePath, zaratePoints]);

  const malvinasAreaPath = useMemo(() => {
    if (!malvinasLinePath || malvinasPoints.length === 0) return '';
    return `${malvinasLinePath} L ${malvinasPoints[malvinasPoints.length - 1].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} L ${malvinasPoints[0].x.toFixed(2)} ${BASELINE_Y.toFixed(2)} Z`;
  }, [malvinasLinePath, malvinasPoints]);

  const handleScrub = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((clientX - rect.left) / rect.width) * SVG_W;
    const ratio = Math.max(0, Math.min(1, (relX - PAD_L) / PLOT_W));
    setHoveredHour(Math.round(ratio * 23));
  };

  const activeBucket = hoveredHour !== null ? buckets[hoveredHour] : null;

  const showZarate = seriesFilter === 'all' || seriesFilter === 'zarate';
  const showMalvinas = seriesFilter === 'all' || seriesFilter === 'malvinas';

  return (
    <div
      className="rounded-xl bg-[#090B10] border border-white/10 px-2.5 pt-2 pb-1.5 select-none"
      aria-label="Gráfico analítico: Actividad de viajes en colectivo hacia Zárate y hacia Malvinas en 24 horas"
    >
      {/* Cabecera FinTech compacta: Título + Leyenda interactiva con contadores tabulares */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="text-[10.5px] sm:text-[11px] font-bold tracking-tight text-white truncate">
            Actividad de Viajes en Colectivo
          </span>
          <span className="text-[9px] font-mono tabular-nums text-[#7C8594] shrink-0">
            24 hs
          </span>
        </div>

        {/* Selector / Leyenda interactiva de las 2 tendencias */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSeriesFilter((prev) => (prev === 'zarate' ? 'all' : 'zarate'))}
            title="Hacia Zárate (de Malvinas a Zárate) · Tocá para destacar"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold transition-opacity cursor-pointer border ${
              seriesFilter === 'malvinas'
                ? 'opacity-40 border-transparent bg-transparent'
                : 'border-rose-400/25 bg-rose-500/10 text-rose-200'
            }`}
          >
            <span className="w-2 h-0.5 rounded-full bg-rose-400 shrink-0" />
            <span className="whitespace-nowrap">Malvinas→Zárate</span>
            <span className="font-mono tabular-nums font-bold text-rose-300">
              {totalZarate}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSeriesFilter((prev) => (prev === 'malvinas' ? 'all' : 'malvinas'))}
            title="Hacia Malvinas (de Zárate a Malvinas) · Tocá para destacar"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold transition-opacity cursor-pointer border ${
              seriesFilter === 'zarate'
                ? 'opacity-40 border-transparent bg-transparent'
                : 'border-sky-400/25 bg-sky-500/10 text-sky-200'
            }`}
          >
            <span className="w-2 h-0.5 rounded-full bg-sky-400 shrink-0" />
            <span className="whitespace-nowrap">Zárate→Malvinas</span>
            <span className="font-mono tabular-nums font-bold text-sky-300">
              {totalMalvinas}
            </span>
          </button>
        </div>
      </div>

      {/* Lectura de punto inspeccionado o estado 24h (mantiene altura constante sin saltos) */}
      <div className="flex items-center justify-between text-[9px] font-mono tabular-nums text-[#8B93A3] mb-0.5 px-0.5 min-h-[14px]">
        {activeBucket ? (
          <div className="flex items-center gap-2 text-white/90">
            <span className="text-[#FFF19A] font-bold">{activeBucket.label} hs</span>
            <span className="text-white/30">·</span>
            <span className="text-rose-300">
              A Zárate: <strong>{activeBucket.haciaZarate}</strong>
            </span>
            <span className="text-white/30">·</span>
            <span className="text-sky-300">
              A Malvinas: <strong>{activeBucket.haciaMalvinas}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 truncate text-[#7C8594]">
            <span>Tendencia últimas 24 hs · Tocá para inspeccionar</span>
          </div>
        )}

        <span className="shrink-0 text-[8.5px] text-[#7C8594]">
          {peakHour !== null
            ? `Pico ${String(peakHour).padStart(2, '0')}:00 hs`
            : `Ahora ${String(currentHour).padStart(2, '0')}:00`}
        </span>
      </div>

      {/* Lienzo SVG Analítico Dark FinTech limpio */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-[68px] sm:h-[74px] overflow-visible touch-pan-y cursor-crosshair"
          onPointerMove={(e) => handleScrub(e.clientX)}
          onPointerDown={(e) => handleScrub(e.clientX)}
          onPointerLeave={() => setHoveredHour(null)}
          role="img"
          aria-label="Tendencia horaria de reportes de colectivo hacia Zárate y hacia Malvinas en 24 horas"
        >
          <defs>
            <linearGradient id="uppaGradZarate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#FB7185" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="uppaGradMalvinas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Línea base limpia sin grillas ni valores de ejes */}
          <line
            x1={PAD_L}
            y1={BASELINE_Y}
            x2={SVG_W - PAD_R}
            y2={BASELINE_Y}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1"
          />

          {/* Áreas degradadas FinTech */}
          {showMalvinas && malvinasAreaPath && (
            <path d={malvinasAreaPath} fill="url(#uppaGradMalvinas)" />
          )}
          {showZarate && zarateAreaPath && (
            <path d={zarateAreaPath} fill="url(#uppaGradZarate)" />
          )}

          {/* Tendencia 1: Zárate -> Malvinas (Azul / Sky) */}
          {showMalvinas && malvinasLinePath && (
            <path
              d={malvinasLinePath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Tendencia 2: Malvinas -> Zárate (Rojo / Coral) */}
          {showZarate && zarateLinePath && (
            <path
              d={zarateLinePath}
              fill="none"
              stroke="#FB7185"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Puntos activos cuando hay reportes reales en esa hora */}
          {buckets.map((b) => (
            <React.Fragment key={b.hour}>
              {showMalvinas && b.haciaMalvinas > 0 && (
                <circle
                  cx={getX(b.hour)}
                  cy={getY(b.haciaMalvinas)}
                  r={hoveredHour === b.hour ? 3.6 : 2.2}
                  fill="#38BDF8"
                  stroke="#090B10"
                  strokeWidth="1"
                />
              )}
              {showZarate && b.haciaZarate > 0 && (
                <circle
                  cx={getX(b.hour)}
                  cy={getY(b.haciaZarate)}
                  r={hoveredHour === b.hour ? 3.6 : 2.2}
                  fill="#FB7185"
                  stroke="#090B10"
                  strokeWidth="1"
                />
              )}
            </React.Fragment>
          ))}

          {/* Crosshair interactivo al pasar mouse o deslizar dedo */}
          {hoveredHour !== null && (
            <g>
              <line
                x1={getX(hoveredHour)}
                y1={PAD_T}
                x2={getX(hoveredHour)}
                y2={BASELINE_Y}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1"
              />
              {showMalvinas && (
                <circle
                  cx={getX(hoveredHour)}
                  cy={getY(buckets[hoveredHour].haciaMalvinas)}
                  r="3.5"
                  fill="#38BDF8"
                  stroke="#090B10"
                  strokeWidth="1.2"
                />
              )}
              {showZarate && (
                <circle
                  cx={getX(hoveredHour)}
                  cy={getY(buckets[hoveredHour].haciaZarate)}
                  r="3.5"
                  fill="#FB7185"
                  stroke="#090B10"
                  strokeWidth="1.2"
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
