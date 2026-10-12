import { MAP_CONFIG } from '../config/api';

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

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Attempt LocationIQ reverse geocode with provided API key
    const response = await fetch(
      `https://us1.locationiq.com/v1/reverse?key=${MAP_CONFIG.API_KEY}&lat=${lat}&lon=${lng}&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        return `${parts[0]?.trim() || ''}, ${parts[1]?.trim() || ''}`;
      }
    }
  } catch {
    // ignore network errors and fallback
  }

  // Fallback heuristic based on Zárate / Campana / Malvinas coordinates
  const dZarate = getDistanceKm(lat, lng, -34.1023, -59.0354);
  const dCampana = getDistanceKm(lat, lng, -34.1683, -58.9592);
  const dMalvinas = getDistanceKm(lat, lng, -34.1950, -58.9720);

  if (dMalvinas < 1.8) return 'Barrio Malvinas, Campana';
  if (dCampana < 2.5) return 'Centro de Campana / Plaza Eduardo Costa';
  if (dZarate < 2.5) return 'Zárate Centro / Terminal';
  if (lat < -34.13 && lat > -34.16) return 'Ruta 6 & Colectora Panamericana';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
