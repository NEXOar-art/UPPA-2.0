import { getDistanceKm } from './geolocation';

export interface GpsPositionSample {
  lat: number;
  lng: number;
  timestamp: number;
  speedMps: number | null;
  headingDeg: number | null;
  accuracy: number;
}

// Buffer continuo en segundo plano (hasta 10 muestras GPS recientes)
let gpsSampleBuffer: GpsPositionSample[] = [];

/**
 * Calcula el rumbo geográfico (bearing 0°–360°) entre dos coordenadas.
 */
export function computeBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lon2 - lon1);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(brng);
}

export function formatHeadingCardinal(headingDeg: number | null | undefined): string {
  if (headingDeg === null || headingDeg === undefined || !Number.isFinite(headingDeg)) {
    return '—';
  }
  const normalized = ((headingDeg % 360) + 360) % 360;
  const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round(normalized / 45) % 8;
  return `${sectors[idx]} (${Math.round(normalized)}°)`;
}

/**
 * Deduce el sentido probable del corredor (Malvinas ↔ Campana ↔ Zárate)
 * según el rumbo en grados. Zárate se ubica al NO respecto a Campana/Malvinas.
 */
export function inferCorridorDirectionFromHeading(
  headingDeg: number | null | undefined
): 'hacia_zarate' | 'hacia_malvinas' | null {
  if (headingDeg === null || headingDeg === undefined || !Number.isFinite(headingDeg)) {
    return null;
  }
  const h = ((headingDeg % 360) + 360) % 360;
  // Rumbo Norte / Noroeste / Noreste (260°..360° o 0°..65°) -> hacia Zárate
  if (h >= 260 || h <= 65) {
    return 'hacia_zarate';
  }
  // Rumbo Sur / Sureste / Suroeste (95°..245°) -> hacia Malvinas
  if (h >= 95 && h <= 245) {
    return 'hacia_malvinas';
  }
  return null;
}

/**
 * Registra una muestra continua de GPS (velocidad, rumbo y precisión) en segundo plano.
 */
export function recordGpsSample(coords: {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number;
  timestamp?: number;
}) {
  const now = coords.timestamp || Date.now();
  const prev = gpsSampleBuffer[gpsSampleBuffer.length - 1];

  let resolvedHeading: number | null =
    coords.heading != null && Number.isFinite(coords.heading) && coords.heading >= 0
      ? Math.round(((coords.heading % 360) + 360) % 360)
      : null;

  if (resolvedHeading === null && prev) {
    const movedKm = getDistanceKm(prev.lat, prev.lng, coords.latitude, coords.longitude);
    if (movedKm >= 0.004) {
      resolvedHeading = computeBearingDeg(
        prev.lat,
        prev.lng,
        coords.latitude,
        coords.longitude
      );
    } else if (prev.headingDeg !== null) {
      resolvedHeading = prev.headingDeg;
    }
  }

  gpsSampleBuffer.push({
    lat: coords.latitude,
    lng: coords.longitude,
    timestamp: now,
    speedMps: coords.speed != null && Number.isFinite(coords.speed) && coords.speed >= 0 ? coords.speed : null,
    headingDeg: resolvedHeading,
    accuracy: coords.accuracy && Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : 15,
  });

  if (gpsSampleBuffer.length > 10) {
    gpsSampleBuffer = gpsSampleBuffer.slice(-10);
  }
}

/**
 * Retorna las muestras GPS registradas actualmente
 */
export function getGpsSamples(): GpsPositionSample[] {
  return [...gpsSampleBuffer];
}

export interface HeadingCalculationResult {
  headingDeg: number | null;
  cardinalLabel: string;
  inferredDirection: 'hacia_zarate' | 'hacia_malvinas' | null;
  method: 'gps_hardware' | 'differential_bearing' | 'unavailable';
}

export function calculateRealBusHeading(): HeadingCalculationResult {
  for (let i = gpsSampleBuffer.length - 1; i >= 0; i--) {
    const s = gpsSampleBuffer[i];
    if (s.headingDeg !== null && Number.isFinite(s.headingDeg)) {
      return {
        headingDeg: s.headingDeg,
        cardinalLabel: formatHeadingCardinal(s.headingDeg),
        inferredDirection: inferCorridorDirectionFromHeading(s.headingDeg),
        method: 'gps_hardware',
      };
    }
  }

  if (gpsSampleBuffer.length >= 2) {
    const oldest = gpsSampleBuffer[Math.max(0, gpsSampleBuffer.length - 4)];
    const newest = gpsSampleBuffer[gpsSampleBuffer.length - 1];
    const distKm = getDistanceKm(oldest.lat, oldest.lng, newest.lat, newest.lng);
    if (distKm >= 0.005) {
      const deg = computeBearingDeg(oldest.lat, oldest.lng, newest.lat, newest.lng);
      return {
        headingDeg: deg,
        cardinalLabel: formatHeadingCardinal(deg),
        inferredDirection: inferCorridorDirectionFromHeading(deg),
        method: 'differential_bearing',
      };
    }
  }

  return {
    headingDeg: null,
    cardinalLabel: '—',
    inferredDirection: null,
    method: 'unavailable',
  };
}

export interface SpeedCalculationResult {
  speedKmH: number;
  method: 'gps_hardware' | 'differential_samples' | 'inter_reports' | 'standard';
  description: string;
}

/**
 * Calcula la velocidad real del transporte teniendo en cuenta velocidad GPS y muestras continuas en segundo plano.
 */
export function calculateRealBusSpeed(
  currentLat?: number,
  currentLng?: number,
  previousReport?: { lat: number; lng: number; createdAtMs?: number } | null
): SpeedCalculationResult {
  // 1. Detección directa por hardware GPS (m/s convertidos a km/h)
  const lastSample = gpsSampleBuffer[gpsSampleBuffer.length - 1];
  if (lastSample && lastSample.speedMps !== null && lastSample.speedMps > 1.2) {
    const kmh = Math.round(lastSample.speedMps * 3.6);
    if (kmh >= 5 && kmh <= 95) {
      return {
        speedKmH: kmh,
        method: 'gps_hardware',
        description: `Velocidad real de GPS: ${kmh} km/h`,
      };
    }
  }

  // 2. Cálculo diferencial usando las últimas muestras continuas en segundo plano
  if (gpsSampleBuffer.length >= 2) {
    const windowSamples = gpsSampleBuffer.slice(-4);
    const oldest = windowSamples[0];
    const newest = windowSamples[windowSamples.length - 1];
    const deltaMs = newest.timestamp - oldest.timestamp;
    const deltaHours = deltaMs / (1000 * 60 * 60);

    if (deltaHours > 0.0002) {
      const distKm = getDistanceKm(oldest.lat, oldest.lng, newest.lat, newest.lng);
      if (distKm > 0.005) {
        const computedKmH = Math.round(distKm / deltaHours);
        if (computedKmH >= 6 && computedKmH <= 95) {
          return {
            speedKmH: computedKmH,
            method: 'differential_samples',
            description: `Velocidad calculada con ${windowSamples.length} lecturas GPS: ${computedKmH} km/h`,
          };
        }
      }
    }
  }

  // 3. Comparación entre reportes consecutivos en el corredor
  if (
    currentLat &&
    currentLng &&
    previousReport &&
    previousReport.createdAtMs &&
    previousReport.lat &&
    previousReport.lng
  ) {
    const elapsedMs = Date.now() - previousReport.createdAtMs;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    if (elapsedHours > 0.005 && elapsedHours < 0.15) {
      const distBetweenReports = getDistanceKm(
        previousReport.lat,
        previousReport.lng,
        currentLat,
        currentLng
      );
      if (distBetweenReports > 0.2 && distBetweenReports < 8) {
        const speedFromReports = Math.round(distBetweenReports / elapsedHours);
        if (speedFromReports >= 10 && speedFromReports <= 85) {
          return {
            speedKmH: speedFromReports,
            method: 'inter_reports',
            description: `Velocidad estimada entre reportes sucesivos: ${speedFromReports} km/h`,
          };
        }
      }
    }
  }

  // 4. Velocidad urbana promedio del corredor
  return {
    speedKmH: 32,
    method: 'standard',
    description: 'Velocidad promedio del corredor: 32 km/h',
  };
}

export interface MultiSamplePrecisionResult {
  lat: number;
  lng: number;
  accuracyMeters: number;
  speedKmH: number;
  rawSpeedMps: number | null;
  headingDeg: number | null;
  headingCardinal: string;
  samplesCollected: number;
  discardedCount: number;
  inferredDirection: 'hacia_zarate' | 'hacia_malvinas' | null;
  usedRealGps: boolean;
  geoErrorCode: number | null;
}

/**
 * Solicita 6 lecturas GPS de alta precisión (watchPosition + ráfagas con maximumAge: 0 + muestras muy recientes
 * en segundo plano), descarta las menos exactas y selecciona automáticamente LA MEJOR LECTURA (menor error en metros),
 * preservando la velocidad y el rumbo continuo calculados en segundo plano.
 */
export async function captureMostPreciseGpsReading(options: {
  fallbackLat: number;
  fallbackLng: number;
  fallbackAccuracy?: number;
  fallbackSpeedMps?: number | null;
  fallbackHeadingDeg?: number | null;
  previousReport?: { lat: number; lng: number; createdAtMs?: number } | null;
  maxDurationMs?: number;
  targetSamples?: number;
  onProgress?: (info: {
    samplesCollected: number;
    bestAccuracyMeters: number;
    speedKmH: number;
    headingCardinal: string;
  }) => void;
}): Promise<MultiSamplePrecisionResult> {
  const {
    fallbackLat,
    fallbackLng,
    fallbackAccuracy = 25,
    fallbackSpeedMps = null,
    fallbackHeadingDeg = null,
    previousReport = null,
    maxDurationMs = 2800,
    targetSamples = 6,
    onProgress,
  } = options;

  const now = Date.now();
  const candidates: GpsPositionSample[] = [];
  let geoErrorCode: number | null = null;

  // Incluir hasta 2 lecturas reales muy recientes (< 5s y <= 200m) del seguimiento continuo en segundo plano
  const recentBackground = gpsSampleBuffer
    .filter((s) => now - s.timestamp <= 5000 && s.accuracy <= 200)
    .slice(-2);
  candidates.push(...recentBackground);

  const sortByPrecision = (list: GpsPositionSample[]) =>
    [...list].sort((a, b) => {
      const accDiff = a.accuracy - b.accuracy;
      if (Math.abs(accDiff) >= 0.5) return accDiff;
      return b.timestamp - a.timestamp;
    });

  const getBestCandidate = (): GpsPositionSample | null => {
    if (candidates.length === 0) return null;
    return sortByPrecision(candidates)[0];
  };

  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    await new Promise<void>((resolve) => {
      let finished = false;
      let watchId: number | null = null;
      let pollTimer: number | null = null;
      let timeoutTimer: number | null = null;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (watchId !== null) {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch {}
        }
        if (pollTimer !== null) window.clearInterval(pollTimer);
        if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
        resolve();
      };

      const pushPosition = (pos: GeolocationPosition) => {
        if (finished) return;
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const ts = pos.timestamp || Date.now();
        recordGpsSample({
          latitude,
          longitude,
          speed,
          heading,
          accuracy,
          timestamp: ts,
        });
        const latest = gpsSampleBuffer[gpsSampleBuffer.length - 1];
        if (latest) {
          candidates.push(latest);
        }

        const best = getBestCandidate();
        const liveSpeed = calculateRealBusSpeed(
          best?.lat ?? latitude,
          best?.lng ?? longitude,
          previousReport
        );
        const liveHeading = calculateRealBusHeading();
        onProgress?.({
          samplesCollected: Math.min(targetSamples, candidates.length),
          bestAccuracyMeters: best
            ? Math.round(best.accuracy)
            : Math.round(accuracy || fallbackAccuracy),
          speedKmH: liveSpeed.speedKmH,
          headingCardinal: liveHeading.cardinalLabel,
        });

        if (candidates.length >= targetSamples) {
          finish();
        }
      };

      const handleGeoError = (err: GeolocationPositionError) => {
        if (err && typeof err.code === 'number') {
          geoErrorCode = err.code;
          if (err.code === 1 && candidates.length === 0) {
            finish();
          }
        }
      };

      const geoOpts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: Math.max(1500, maxDurationMs - 200),
      };

      try {
        watchId = navigator.geolocation.watchPosition(pushPosition, handleGeoError, geoOpts);
        navigator.geolocation.getCurrentPosition(pushPosition, handleGeoError, geoOpts);
        pollTimer = window.setInterval(() => {
          if (!finished && candidates.length < targetSamples) {
            navigator.geolocation.getCurrentPosition(pushPosition, handleGeoError, geoOpts);
          }
        }, 350);
      } catch {
        finish();
        return;
      }

      timeoutTimer = window.setTimeout(finish, maxDurationMs);
    });
  }

  // Descartar explícitamente las lecturas menos exactas y seleccionar LA MEJOR LECTURA
  const sorted = sortByPrecision(candidates);
  let retained = sorted;
  if (sorted.length >= 2) {
    const minAcc = sorted[0].accuracy;
    const accuracyCutoff = Math.max(minAcc * 1.5, minAcc + 10);
    const filtered = sorted.filter((s) => s.accuracy <= accuracyCutoff);
    const topSliceCount = Math.max(1, Math.ceil(filtered.length / 2));
    retained = filtered.slice(0, topSliceCount);
  }

  const usedRealGps = candidates.length > 0;
  const discardedCount = Math.max(0, candidates.length - retained.length);
  const best = retained[0] || sorted[0] || null;
  const chosenLat = best ? best.lat : fallbackLat;
  const chosenLng = best ? best.lng : fallbackLng;
  const chosenAccuracy = best ? Math.round(best.accuracy) : Math.round(fallbackAccuracy);
  const chosenSpeedMps = best ? best.speedMps : fallbackSpeedMps;

  // Solo registrar en el buffer continuo cuando proviene de una lectura GPS real del dispositivo
  if (best) {
    recordGpsSample({
      latitude: chosenLat,
      longitude: chosenLng,
      speed: best.speedMps,
      heading: best.headingDeg,
      accuracy: chosenAccuracy,
      timestamp: Date.now(),
    });
  }

  const speedRes = calculateRealBusSpeed(chosenLat, chosenLng, previousReport);
  const headingRes = calculateRealBusHeading();
  const finalHeadingDeg = headingRes.headingDeg ?? (fallbackHeadingDeg ?? null);

  return {
    lat: chosenLat,
    lng: chosenLng,
    accuracyMeters: chosenAccuracy,
    speedKmH: speedRes.speedKmH,
    rawSpeedMps: chosenSpeedMps,
    headingDeg: finalHeadingDeg,
    headingCardinal: formatHeadingCardinal(finalHeadingDeg),
    samplesCollected: candidates.length,
    discardedCount,
    inferredDirection: headingRes.inferredDirection,
    usedRealGps,
    geoErrorCode,
  };
}
