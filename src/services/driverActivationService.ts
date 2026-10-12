import { DriverActivationCode, TaxiListing, PaymentProof } from '../types';

const CODES_STORAGE_KEY = 'UPPA_DRIVER_ACTIVATION_CODES';
const SESSION_STORAGE_KEY = 'UPPA_ACTIVE_DRIVER_SESSION';

// Initial pre-configured activation codes ready for immediate testing or demo
const INITIAL_DEMO_CODES: DriverActivationCode[] = [
  {
    code: 'UPPA-TX-12H',
    driverName: 'Carlos Chofer Zárate',
    vehicleType: 'auto',
    vehicleModel: 'Chevrolet Corsa Blanco',
    whatsapp: '5493487401122',
    hours: 12,
    isUsed: false,
    createdAt: '2026-10-08 12:00',
  },
  {
    code: 'UPPA-MOTO-6H',
    driverName: 'Marcos Moto Express',
    vehicleType: 'moto',
    vehicleModel: 'Honda Titan 150 Azul',
    whatsapp: '5493487556677',
    hours: 6,
    isUsed: false,
    createdAt: '2026-10-08 14:30',
  },
  {
    code: 'UPPA-VIP-24H',
    driverName: 'Chofer VIP Zárate ↔ Campana',
    vehicleType: 'auto',
    vehicleModel: 'Toyota Corolla Gris',
    whatsapp: '5493487998811',
    hours: 24,
    isUsed: false,
    createdAt: '2026-10-08 10:00',
  },
];

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

// Get all codes
export function getAllActivationCodes(): DriverActivationCode[] {
  try {
    const raw = localStorage.getItem(CODES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_CODES));
      return INITIAL_DEMO_CODES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_CODES));
      return INITIAL_DEMO_CODES;
    }
    return parsed;
  } catch {
    return INITIAL_DEMO_CODES;
  }
}

// Save codes
function saveActivationCodes(codes: DriverActivationCode[]) {
  try {
    localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(codes));
    window.dispatchEvent(new CustomEvent('uppa-codes-updated'));
  } catch (err) {
    console.error('Error saving activation codes:', err);
  }
}

// Generate code for a driver payment
export function generateActivationCode(
  data: {
    driverName: string;
    vehicleType: 'auto' | 'moto';
    vehicleModel: string;
    whatsapp: string;
    hours: number;
    paymentId?: string;
  }
): DriverActivationCode {
  const codes = getAllActivationCodes();
  const prefix = data.vehicleType === 'moto' ? 'MOTO' : 'TX';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const codeString = `UPPA-${prefix}-${randomSuffix}`;

  const newCodeObj: DriverActivationCode = {
    code: codeString,
    driverName: data.driverName.trim(),
    vehicleType: data.vehicleType,
    vehicleModel: data.vehicleModel.trim(),
    whatsapp: data.whatsapp.replace(/\D/g, ''),
    hours: data.hours,
    paymentId: data.paymentId,
    isUsed: false,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
  };

  const updated = [newCodeObj, ...codes];
  saveActivationCodes(updated);
  return newCodeObj;
}

// Get active driver session
export function getActiveDriverSession(): ActiveDriverSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: ActiveDriverSession = JSON.parse(raw);
    if (session && session.endsAt && session.endsAt > Date.now()) {
      return session;
    }
    // Expired
    return null;
  } catch {
    return null;
  }
}

// Save active driver session
export function saveActiveDriverSession(session: ActiveDriverSession) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('uppa-driver-session-updated', { detail: session }));
  } catch (err) {
    console.error('Error saving active driver session:', err);
  }
}

// Clear active driver session
export function clearActiveDriverSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('uppa-driver-session-updated', { detail: null }));
  } catch (err) {
    console.error('Error clearing active driver session:', err);
  }
}

// Activate driver with code
export function validateAndActivateCode(
  codeStr: string,
  driverFallback?: {
    driverName?: string;
    vehicleType?: 'auto' | 'moto';
    vehicleModel?: string;
    whatsapp?: string;
    zone?: string;
  }
): { success: boolean; session?: ActiveDriverSession; message: string } {
  const cleanCode = codeStr.trim().toUpperCase();
  const codes = getAllActivationCodes();
  const foundIdx = codes.findIndex((c) => c.code.toUpperCase() === cleanCode);

  if (foundIdx === -1) {
    return {
      success: false,
      message: `El código "${cleanCode}" no es válido. Verificá los caracteres o solicitá uno nuevo.`,
    };
  }

  const codeData = codes[foundIdx];

  // If already used, check if it's the currently active session
  const currentSession = getActiveDriverSession();
  if (codeData.isUsed && (!currentSession || currentSession.activationCode !== cleanCode)) {
    return {
      success: false,
      message: `El código "${cleanCode}" ya fue utilizado y no se puede reutilizar.`,
    };
  }

  const hours = codeData.hours || 12;
  const now = Date.now();
  const durationMs = hours * 3600 * 1000;
  const endsAt = now + durationMs;

  const session: ActiveDriverSession = {
    driverId: `tx-driver-${Date.now()}`,
    driverName: driverFallback?.driverName?.trim() || codeData.driverName || 'Conductor UPPA',
    vehicleType: driverFallback?.vehicleType || codeData.vehicleType || 'auto',
    vehicleModel: driverFallback?.vehicleModel?.trim() || codeData.vehicleModel || 'Vehículo Habilitado',
    whatsapp: driverFallback?.whatsapp?.replace(/\D/g, '') || codeData.whatsapp || '5493487552190',
    zone: driverFallback?.zone?.trim() || 'Zárate ↔ Campana',
    activationCode: cleanCode,
    hoursPaid: hours,
    startsAt: now,
    endsAt,
    isOnline: true,
  };

  // Mark code as used
  const updatedCodes = [...codes];
  updatedCodes[foundIdx] = {
    ...codeData,
    isUsed: true,
    activatedAt: now,
    expiresAt: endsAt,
  };
  saveActivationCodes(updatedCodes);

  // Save session
  saveActiveDriverSession(session);

  return {
    success: true,
    session,
    message: `¡Servicio activado con éxito! Temporizador iniciado con ${hours} horas pagadas.`,
  };
}

// Timer countdown calculator
export function getTimerState(endsAt: number): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
  totalSeconds: number;
  percentageRemaining: number;
  totalDurationMs?: number;
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
