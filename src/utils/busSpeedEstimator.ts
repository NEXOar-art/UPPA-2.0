import { getDistanceKm } from './geolocation';

export interface GpsPositionSample {
  lat: number;
  lng: number;
  timestamp: number;
  speedMps: number | null;
  accuracy: number;
}

// Buffer de las últimas 1 a 3 muestras GPS tomadas mediante navigator.geolocation.watchPosition()
let gpsSampleBuffer: GpsPositionSample[] = [];

/**
 * Registra una muestra de GPS proveniente de navigator.geolocation.watchPosition()
 * Guarda únicamente las últimas 3 muestras para calcular desplazamientos y velocidad real.
 */
export function recordGpsSample(coords: {
  latitude: number;
  longitude: number;
  speed?: number | null;
  accuracy?: number;
}) {
  const now = Date.now();
  gpsSampleBuffer.push({
    lat: coords.latitude,
    lng: coords.longitude,
    timestamp: now,
    speedMps: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    accuracy: coords.accuracy || 15,
  });

  // Mantener estrictamente de 1 a 3 muestras recientes
  if (gpsSampleBuffer.length > 3) {
    gpsSampleBuffer = gpsSampleBuffer.slice(-3);
  }
}

/**
 * Retorna las muestras GPS registradas actualmente
 */
export function getGpsSamples(): GpsPositionSample[] {
  return [...gpsSampleBuffer];
}

export interface SpeedCalculationResult {
  speedKmH: number;
  method: 'gps_hardware' | 'differential_samples' | 'inter_reports' | 'standard';
  description: string;
}

/**
 * Calcula la velocidad real del transporte:
 * 1. Primero verifica la velocidad directa del hardware GPS (coords.speed) de las muestras recientes.
 * 2. Si no está disponible o el usuario viaja dentro del colectivo, toma de 1 a 3 muestras temporales
 *    y calcula la velocidad por desplazamiento (distancia / tiempo).
 * 3. Si el usuario está parado en la parada y reporta el paso, compara con el último reporte
 *    previo de ubicación de colectivo en la misma traza para deducir la velocidad de avance real.
 */
export function calculateRealBusSpeed(
  currentLat?: number,
  currentLng?: number,
  previousReport?: { lat: number; lng: number; createdAtMs?: number } | null
): SpeedCalculationResult {
  // 1. Detección directa por hardware GPS (m/s convertidos a km/h)
  const lastSample = gpsSampleBuffer[gpsSampleBuffer.length - 1];
  if (lastSample && lastSample.speedMps !== null && lastSample.speedMps > 1.2) {
    // Si la velocidad supera ~4.3 km/h está en movimiento
    const kmh = Math.round(lastSample.speedMps * 3.6);
    if (kmh >= 5 && kmh <= 90) {
      return {
        speedKmH: kmh,
        method: 'gps_hardware',
        description: `Velocidad real de GPS: ${kmh} km/h`,
      };
    }
  }

  // 2. Cálculo diferencial de 1 a 3 muestras tomadas con watchPosition()
  if (gpsSampleBuffer.length >= 2) {
    const oldest = gpsSampleBuffer[0];
    const newest = gpsSampleBuffer[gpsSampleBuffer.length - 1];
    const deltaMs = newest.timestamp - oldest.timestamp;
    const deltaHours = deltaMs / (1000 * 60 * 60);

    if (deltaHours > 0.0002) {
      // Al menos 1 segundo de diferencia
      const distKm = getDistanceKm(oldest.lat, oldest.lng, newest.lat, newest.lng);
      if (distKm > 0.005) {
        // Al menos 5 metros de desplazamiento medido
        const computedKmH = Math.round(distKm / deltaHours);
        if (computedKmH >= 6 && computedKmH <= 90) {
          return {
            speedKmH: computedKmH,
            method: 'differential_samples',
            description: `Velocidad calculada con ${gpsSampleBuffer.length} muestras GPS: ${computedKmH} km/h`,
          };
        }
      }
    }
  }

  // 3. Si el pasajero está quieto en la parada y reporta, pero existe un reporte anterior de colectivo:
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
    // Dentro de los últimos 1 a 8 minutos
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

  // 4. Velocidad urbana promedio real del corredor (Ruta 6 / Colectora / Malvinas: 32 km/h)
  return {
    speedKmH: 32,
    method: 'standard',
    description: 'Velocidad promedio del corredor: 32 km/h',
  };
}
