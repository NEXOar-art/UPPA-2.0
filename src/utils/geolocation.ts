import { MAP_CONFIG } from '../config/api';

export const GPS_UPDATE_INTERVAL_MS = 3000;

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  address?: string;
  timestamp: number;
  isSimulated?: boolean;
}

// Haversine formula to compute distance in km
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const streetGeocodeCache = new Map<string, string>();
const inflightGeocodeRequests = new Map<string, Promise<string>>();
const GEOCODE_STORAGE_KEY = 'uppa_reverse_geocode_cache_v2';

export function isCoordinateAddress(addr?: string | null): boolean {
  if (!addr) return false;
  return /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/.test(addr);
}

const GENERIC_FALLBACK_ZONES = new Set([
  'Barrio Malvinas, Campana',
  'Centro de Campana / Plaza Eduardo Costa',
  'Zárate Centro / Terminal',
  'Ruta 6 & Colectora Panamericana',
]);

export function isFallbackZoneAddress(addr?: string | null): boolean {
  if (!addr) return true;
  const trimmed = addr.trim();
  return !trimmed || isCoordinateAddress(trimmed) || GENERIC_FALLBACK_ZONES.has(trimmed);
}

// Hydrate persisted street cache once on startup (discarding any stale coordinate-only entries)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(GEOCODE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' && !isFallbackZoneAddress(v)) {
          streetGeocodeCache.set(k, v);
        }
      });
    }
  }
} catch {}

function persistGeocodeEntry(key: string, value: string) {
  if (isFallbackZoneAddress(value)) return;
  streetGeocodeCache.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const entries = Array.from(streetGeocodeCache.entries()).slice(-180);
      window.localStorage.setItem(GEOCODE_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }
  } catch {}
}

function getCoordCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getCachedStreetName(lat: number, lng: number): string | null {
  const val = streetGeocodeCache.get(getCoordCacheKey(lat, lng)) || null;
  return val && !isCoordinateAddress(val) ? val : null;
}

function getZoneFallback(lat: number, lng: number): string {
  const dZarate = getDistanceKm(lat, lng, -34.1023, -59.0354);
  const dCampana = getDistanceKm(lat, lng, -34.1683, -58.9592);
  const dMalvinas = getDistanceKm(lat, lng, -34.1950, -58.9720);

  if (dMalvinas < 1.8) return 'Barrio Malvinas, Campana';
  if (dCampana < 2.5) return 'Centro de Campana / Plaza Eduardo Costa';
  if (dZarate < 2.5) return 'Zárate Centro / Terminal';
  if (lat < -34.13 && lat > -34.16) return 'Ruta 6 & Colectora Panamericana';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

async function queryNominatimReverse(
  lat: number,
  lng: number
): Promise<{ exactStreet?: string; locality?: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!response.ok) return {};
    const data = await response.json();
    const addr = data?.address || {};
    const road =
      addr.road ||
      addr.pedestrian ||
      addr.highway ||
      addr.footway ||
      addr.street ||
      addr.path ||
      '';
    const houseNum = addr.house_number ? ` ${addr.house_number}` : '';
    const barrio = addr.neighbourhood || addr.suburb || addr.quarter || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const locality =
      barrio && city && barrio !== city
        ? `${barrio}, ${city}`
        : city || barrio || '';

    if (road) {
      const streetPart = `${road}${houseNum}`.trim();
      const areaPart = city || barrio;
      const exactStreet =
        areaPart && !streetPart.toLowerCase().includes(areaPart.toLowerCase())
          ? `${streetPart}, ${areaPart}`
          : streetPart;
      return { exactStreet, locality };
    }

    if (data?.name && !/^\d+$/.test(String(data.name).trim())) {
      const exactStreet = locality ? `${data.name}, ${locality}` : String(data.name).trim();
      return { exactStreet, locality };
    }

    return { locality };
  } catch {
    return {};
  }
}

async function queryPhotonReverse(
  lat: number,
  lng: number,
  fallbackLocality?: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=es`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return null;

    const street =
      props.street ||
      (props.type === 'street' ? props.name : '') ||
      '';
    const houseNum = props.housenumber ? ` ${props.housenumber}` : '';
    const district = props.district || props.locality || '';
    const city = props.city || props.county || fallbackLocality || '';
    const area = city || district;

    if (street) {
      const streetLine = `${street}${houseNum}`.trim();
      return area && !streetLine.toLowerCase().includes(area.toLowerCase())
        ? `${streetLine}, ${area}`
        : streetLine;
    }

    if (props.name) {
      return area && props.name !== area ? `${props.name}, ${area}` : String(props.name);
    }

    return area || null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Ubicación desconocida';
  }

  const key = getCoordCacheKey(lat, lng);
  const cached = streetGeocodeCache.get(key);
  if (cached && !isFallbackZoneAddress(cached)) return cached;

  const inflight = inflightGeocodeRequests.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<string> => {
    // 1. OpenStreetMap Nominatim (precisión calle + altura)
    const nom = await queryNominatimReverse(lat, lng);
    if (nom.exactStreet && !isFallbackZoneAddress(nom.exactStreet)) {
      persistGeocodeEntry(key, nom.exactStreet);
      return nom.exactStreet;
    }

    // 2. Photon Komoot (excelente cobertura de rutas y calles secundarias)
    const photonStreet = await queryPhotonReverse(lat, lng, nom.locality);
    if (photonStreet && !isFallbackZoneAddress(photonStreet)) {
      persistGeocodeEntry(key, photonStreet);
      return photonStreet;
    }

    // 3. Localidad detectada por Nominatim si no hubo nombre de calle
    if (nom.locality && !isCoordinateAddress(nom.locality)) {
      persistGeocodeEntry(key, nom.locality);
      return nom.locality;
    }

    // 4. Fallback zonal sin cachear permanentemente coordenadas puras
    return getZoneFallback(lat, lng);
  })();

  inflightGeocodeRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightGeocodeRequests.delete(key);
  }
}
