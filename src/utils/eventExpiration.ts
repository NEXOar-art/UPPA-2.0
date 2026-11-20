import { EventType, MapEvent, ReporteFirestore } from '../types';

export const BUS_LOCATION_TTL_MS = 60 * 1000; // 1 minuto
export const CONTROL_EVENT_TTL_MS = 3.5 * 60 * 60 * 1000; // 3.5 horas (12,600,000 ms)
export const INUNDACION_EVENT_TTL_MS = 10 * 60 * 60 * 1000; // 10 horas (36,000,000 ms)

export function getEventTtlMs(
  type?: EventType | ReporteFirestore['tipo'] | string
): number | null {
  if (type === 'bus_location' || type === 'ubicacion_colectivo') {
    return BUS_LOCATION_TTL_MS;
  }
  if (type === 'control' || type === 'control_policial') {
    return CONTROL_EVENT_TTL_MS;
  }
  if (type === 'inundacion') {
    return INUNDACION_EVENT_TTL_MS;
  }
  return null;
}

export function computeEventExpiresAtMs(
  type: EventType | ReporteFirestore['tipo'] | string | undefined,
  createdAtMs: number,
  explicitExpiresAtMs?: number
): number | undefined {
  if (typeof explicitExpiresAtMs === 'number' && Number.isFinite(explicitExpiresAtMs)) {
    return explicitExpiresAtMs;
  }
  const ttl = getEventTtlMs(type);
  if (ttl !== null) {
    return createdAtMs + ttl;
  }
  return undefined;
}

export function isMapEventExpired(
  ev: Partial<MapEvent>,
  nowMs: number = Date.now()
): boolean {
  const created =
    typeof ev.createdAtMs === 'number'
      ? ev.createdAtMs
      : typeof ev.reportedAt === 'number'
      ? ev.reportedAt
      : undefined;
  const expiresAt =
    typeof ev.expiresAtMs === 'number'
      ? ev.expiresAtMs
      : created !== undefined
      ? computeEventExpiresAtMs(ev.type, created)
      : undefined;

  return typeof expiresAt === 'number' && nowMs >= expiresAt;
}

export function isReporteExpired(
  rep: Partial<ReporteFirestore>,
  nowMs: number = Date.now()
): boolean {
  const created =
    typeof rep.creadoEnMs === 'number'
      ? rep.creadoEnMs
      : typeof rep.creadoEn === 'number'
      ? rep.creadoEn
      : typeof rep.creadoEn?.seconds === 'number'
      ? rep.creadoEn.seconds * 1000
      : undefined;
  const expiresAt =
    typeof rep.expiresAtMs === 'number'
      ? rep.expiresAtMs
      : created !== undefined
      ? computeEventExpiresAtMs(rep.tipo, created)
      : undefined;

  return typeof expiresAt === 'number' && nowMs >= expiresAt;
}
