import { apiRequest } from './api';
import { ApiHabilitacionRecord } from '../types/api';
import { TaxiListing, HabilitacionChofer } from '../types';

export interface ActiveDriverSession {
  driverId: string;
  driverName: string;
  vehicleType: 'auto' | 'moto';
  vehicleModel: string;
  whatsapp: string;
  zone: string;
  activationCode: string;
  hoursPaid: number;
  startsAt: number;
  endsAt: number;
  isOnline: boolean;
}

const DRIVER_SESSION_KEY = 'UPPA_ACTIVE_DRIVER_SESSION';

export function getActiveDriverSession(): ActiveDriverSession | null {
  try {
    const raw = localStorage.getItem(DRIVER_SESSION_KEY);
    if (!raw) return null;
    const session: ActiveDriverSession = JSON.parse(raw);
    if (session && session.endsAt && session.endsAt > Date.now()) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveDriverSession(session: ActiveDriverSession) {
  try {
    localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('uppa-driver-session-updated', { detail: session }));
  } catch {}
}

export function clearActiveDriverSession() {
  try {
    localStorage.removeItem(DRIVER_SESSION_KEY);
    window.dispatchEvent(new CustomEvent('uppa-driver-session-updated', { detail: null }));
  } catch {}
}

export function formatHabilitacionToTaxiListing(h: ApiHabilitacionRecord, index = 0): TaxiListing {
  return {
    id: h.id || `tx-${h.driverId}`,
    userId: h.driverId,
    driverName: h.driverName,
    vehicleType: h.vehicleType,
    vehicleModel: h.vehicleModel,
    whatsapp: h.whatsapp,
    zone: h.zone,
    lat: -34.195 + (index * 0.007) - 0.003,
    lng: -58.945 + (index * 0.007) - 0.003,
    hoursPaid: h.horas,
    startsAt: h.startsAt,
    endsAt: h.endsAt,
    status: 'active',
    rating: 4.9,
    completedRides: 38,
    activationCode: h.activationCode,
    isOnline: true,
  };
}

export const driverService = {
  async getActiveDrivers(): Promise<TaxiListing[]> {
    const res = await apiRequest<ApiHabilitacionRecord[]>('getActiveDrivers', { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map(formatHabilitacionToTaxiListing);
    }
    return [];
  },

  async validateCode(code: string): Promise<boolean> {
    const res = await apiRequest('validateActivationCode', {
      method: 'POST',
      body: { code },
    });
    return res.ok;
  },

  async activateDriver(payload: {
    code: string;
    driverId: string;
    driverName: string;
    vehicleType: 'auto' | 'moto';
    vehicleModel: string;
    whatsapp: string;
    zone: string;
    hours: number;
  }): Promise<ActiveDriverSession> {
    const res = await apiRequest<ApiHabilitacionRecord>('activateDriver', {
      method: 'POST',
      body: payload,
    });

    if (!res.ok || !res.data) {
      throw new Error(res.error?.message || 'Error al activar chofer');
    }

    const session: ActiveDriverSession = {
      driverId: res.data.driverId,
      driverName: res.data.driverName,
      vehicleType: res.data.vehicleType,
      vehicleModel: res.data.vehicleModel,
      whatsapp: res.data.whatsapp,
      zone: res.data.zone,
      activationCode: res.data.activationCode || payload.code,
      hoursPaid: res.data.horas,
      startsAt: res.data.startsAt,
      endsAt: res.data.endsAt,
      isOnline: true,
    };

    saveActiveDriverSession(session);
    return session;
  },

  async updateLocation(driverId: string, lat: number, lng: number, speed?: number, heading?: number): Promise<void> {
    await apiRequest('updateDriverLocation', {
      method: 'POST',
      body: { driverId, lat, lng, speed, heading },
    });
  },
};

export function subscribeToHabilitaciones(
  callback: (habs: HabilitacionChofer[]) => void
): () => void {
  let isMounted = true;

  const fetchHabs = async () => {
    try {
      const res = await apiRequest<ApiHabilitacionRecord[]>('getActiveDrivers', { method: 'GET' });
      if (res.ok && res.data && isMounted) {
        callback(
          res.data.map((h) => ({
            id: h.id,
            driverId: h.driverId,
            driverName: h.driverName,
            vehicleType: h.vehicleType,
            vehicleModel: h.vehicleModel,
            whatsapp: h.whatsapp,
            zone: h.zone,
            horas: h.horas,
            startsAt: h.startsAt,
            endsAt: h.endsAt,
            estado: (h.estado === 'cancelado' ? 'revocado' : h.estado) as 'pendiente' | 'activo' | 'expirado' | 'revocado',
            activationCode: h.activationCode,
            activadoConClaveAdmin: false,
            alias: 'luciaveronicag',
            cvu: '0000003100020253501840',
            titular: 'Lucia Veronica Gimenez',
            createdAt: h.creadoEn || h.startsAt || Date.now(),
          }))
        );
      }
    } catch {}
  };

  fetchHabs();
  const timer = setInterval(fetchHabs, 5000);

  return () => {
    isMounted = false;
    clearInterval(timer);
  };
}

export function getTimerState(endsAt: number): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
  totalSeconds: number;
  percentageRemaining: number;
} {
  const diff = endsAt - Date.now();
  if (diff <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: '00:00:00',
      isExpired: true,
      totalSeconds: 0,
      percentageRemaining: 0,
    };
  }

  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    hours,
    minutes,
    seconds,
    formatted,
    isExpired: false,
    totalSeconds: totalSec,
    percentageRemaining: Math.min(100, Math.max(0, (totalSec / (24 * 3600)) * 100)),
  };
}
