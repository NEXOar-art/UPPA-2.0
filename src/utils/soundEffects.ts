import { Howl, Howler } from 'howler';

export type MicroSoundType =
  | 'ride_accepted'
  | 'payment_done'
  | 'driver_near'
  | 'step_progress'
  | 'ad_spark'
  | 'ui_tap'
  | 'passenger_approach_alarm'
  | 'driver_request_alarm';

interface ToneSegment {
  startSec: number;
  durSec: number;
  freqStart: number;
  freqEnd: number;
  gain: number;
  wave?: 'sine' | 'triangle';
}

const SOUND_RECIPES: Record<MicroSoundType, { totalSec: number; volume: number; tones: ToneSegment[] }> = {
  ride_accepted: {
    totalSec: 0.24,
    volume: 0.45,
    tones: [
      { startSec: 0, durSec: 0.09, freqStart: 659.25, freqEnd: 659.25, gain: 0.22, wave: 'sine' },
      { startSec: 0.08, durSec: 0.15, freqStart: 880, freqEnd: 987.77, gain: 0.25, wave: 'sine' },
    ],
  },
  payment_done: {
    totalSec: 0.24,
    volume: 0.42,
    tones: [
      { startSec: 0, durSec: 0.08, freqStart: 523.25, freqEnd: 523.25, gain: 0.2, wave: 'triangle' },
      { startSec: 0.07, durSec: 0.15, freqStart: 659.25, freqEnd: 783.99, gain: 0.24, wave: 'sine' },
    ],
  },
  driver_near: {
    totalSec: 0.23,
    volume: 0.4,
    tones: [
      { startSec: 0, durSec: 0.08, freqStart: 740, freqEnd: 783.99, gain: 0.2, wave: 'sine' },
      { startSec: 0.1, durSec: 0.12, freqStart: 987.77, freqEnd: 1046.5, gain: 0.22, wave: 'sine' },
    ],
  },
  step_progress: {
    totalSec: 0.18,
    volume: 0.35,
    tones: [
      { startSec: 0, durSec: 0.17, freqStart: 587.33, freqEnd: 783.99, gain: 0.2, wave: 'sine' },
    ],
  },
  ad_spark: {
    totalSec: 0.16,
    volume: 0.28,
    tones: [
      { startSec: 0, durSec: 0.07, freqStart: 987.77, freqEnd: 1174.66, gain: 0.18, wave: 'sine' },
      { startSec: 0.05, durSec: 0.1, freqStart: 1318.51, freqEnd: 1567.98, gain: 0.16, wave: 'sine' },
    ],
  },
  ui_tap: {
    totalSec: 0.09,
    volume: 0.24,
    tones: [
      { startSec: 0, durSec: 0.075, freqStart: 520, freqEnd: 660, gain: 0.16, wave: 'triangle' },
    ],
  },
  passenger_approach_alarm: {
    totalSec: 0.42,
    volume: 0.5,
    tones: [
      { startSec: 0, durSec: 0.14, freqStart: 880, freqEnd: 987.77, gain: 0.26, wave: 'sine' },
      { startSec: 0.17, durSec: 0.2, freqStart: 1174.66, freqEnd: 1318.51, gain: 0.28, wave: 'triangle' },
    ],
  },
  driver_request_alarm: {
    totalSec: 0.66,
    volume: 0.92,
    tones: [
      { startSec: 0, durSec: 0.15, freqStart: 987.77, freqEnd: 1174.66, gain: 0.36, wave: 'triangle' },
      { startSec: 0.18, durSec: 0.15, freqStart: 1318.51, freqEnd: 1567.98, gain: 0.4, wave: 'sine' },
      { startSec: 0.37, durSec: 0.24, freqStart: 1567.98, freqEnd: 1760.0, gain: 0.44, wave: 'triangle' },
    ],
  },
};

function encodeWavBase64(totalSec: number, tones: ToneSegment[]): string {
  const sampleRate = 22050;
  const numSamples = Math.max(1, Math.floor(sampleRate * totalSec));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;

    for (const seg of tones) {
      if (t >= seg.startSec && t <= seg.startSec + seg.durSec) {
        const localT = t - seg.startSec;
        const progress = localT / seg.durSec;
        const env =
          localT < 0.012
            ? localT / 0.012
            : Math.pow(Math.max(0, 1 - (localT - 0.012) / Math.max(0.01, seg.durSec - 0.012)), 2);
        const freq = seg.freqStart + (seg.freqEnd - seg.freqStart) * progress;
        const phase = 2 * Math.PI * freq * localT;
        const osc =
          seg.wave === 'triangle'
            ? (2 / Math.PI) * Math.asin(Math.sin(phase))
            : Math.sin(phase);
        sampleVal += osc * seg.gain * env;
      }
    }

    const clamped = Math.max(-1, Math.min(1, sampleVal));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const howlCache: Partial<Record<MicroSoundType, Howl>> = {};
let lastPlayedAt: Record<string, number> = {};

function getOrCreateHowl(type: MicroSoundType): Howl | null {
  if (typeof window === 'undefined') return null;
  if (howlCache[type]) return howlCache[type]!;
  try {
    const recipe = SOUND_RECIPES[type];
    const wavUri = encodeWavBase64(recipe.totalSec, recipe.tones);
    const howl = new Howl({
      src: [wavUri],
      format: ['wav'],
      volume: recipe.volume,
      preload: true,
    });
    howlCache[type] = howl;
    return howl;
  } catch {
    return null;
  }
}

/**
 * Reproduce micro-sonidos con Howler.js a partir de audio procedural WAV en memoria (cero 404).
 * En caso de restricción del entorno, degrada silenciosamente sin errores.
 */
export function playMicroSound(type: MicroSoundType): void {
  try {
    const nowMs = Date.now();
    if (lastPlayedAt[type] && nowMs - lastPlayedAt[type] < 260) {
      return;
    }
    lastPlayedAt[type] = nowMs;

    const howl = getOrCreateHowl(type);
    if (howl) {
      howl.play();
    }
  } catch {
    // Graceful no-op on restricted autoplay environments
  }
}

let passengerAlarmInterval: ReturnType<typeof setInterval> | null = null;
let passengerAlarmTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Detiene inmediatamente la alarma sonora de acercamiento al pasajero.
 */
export function stopPassengerApproachAlarm(): void {
  if (passengerAlarmInterval) {
    clearInterval(passengerAlarmInterval);
    passengerAlarmInterval = null;
  }
  if (passengerAlarmTimeout) {
    clearTimeout(passengerAlarmTimeout);
    passengerAlarmTimeout = null;
  }
  try {
    const howl = howlCache['passenger_approach_alarm'];
    if (howl) {
      howl.stop();
    }
  } catch {}
}

/**
 * Reproduce únicamente la alarma estilo radar acercándose al pasajero durante 10 segundos,
 * silenciando cualquier síntesis de voz previa para evitar superposición de audio.
 */
export function startPassengerApproachAlarm(durationMs: number = 10000): () => void {
  stopPassengerApproachAlarm();

  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}

  const playAlarmPulse = () => {
    try {
      const howl = getOrCreateHowl('passenger_approach_alarm');
      if (howl) {
        howl.play();
      }
    } catch {}
  };

  playAlarmPulse();
  passengerAlarmInterval = setInterval(playAlarmPulse, 1100);
  passengerAlarmTimeout = setTimeout(() => {
    stopPassengerApproachAlarm();
  }, durationMs);

  return () => stopPassengerApproachAlarm();
}

let driverRequestAlarmInterval: ReturnType<typeof setInterval> | null = null;
let driverRequestAlarmTimeout: ReturnType<typeof setTimeout> | null = null;
let driverRequestAlarmActive = false;
let driverUnlockCleanup: (() => void) | null = null;

function clearDriverUnlockListeners(): void {
  if (driverUnlockCleanup) {
    driverUnlockCleanup();
    driverUnlockCleanup = null;
  }
}

function playDriverRequestPulse(): void {
  try {
    const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const howl = getOrCreateHowl('driver_request_alarm');
    if (howl) {
      howl.volume(0.92);
      howl.play();
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 90, 200]);
    }
  } catch {
    // Graceful no-op on restricted autoplay environments
  }
}

export function isDriverRequestAlarmActive(): boolean {
  return driverRequestAlarmActive;
}

/**
 * Detiene inmediatamente la alarma sonora de pedido de transporte para prestadores.
 */
export function stopDriverRequestAlarm(): void {
  driverRequestAlarmActive = false;
  clearDriverUnlockListeners();
  if (driverRequestAlarmInterval) {
    clearInterval(driverRequestAlarmInterval);
    driverRequestAlarmInterval = null;
  }
  if (driverRequestAlarmTimeout) {
    clearTimeout(driverRequestAlarmTimeout);
    driverRequestAlarmTimeout = null;
  }
  try {
    const howl = howlCache['driver_request_alarm'];
    if (howl) {
      howl.stop();
    }
  } catch {}
}

/**
 * Inicia una alarma sonora audible y repetitiva para alertar rápidamente al prestador
 * cuando un pasajero solicita transporte. Incluye desbloqueo automático tras interacción
 * si el navegador bloqueó el autoplay inicial.
 */
export function startDriverRequestAlarm(
  durationMs: number = 60000,
  onAutoStop?: () => void
): () => void {
  stopDriverRequestAlarm();
  driverRequestAlarmActive = true;

  playDriverRequestPulse();

  // Si el navegador aún tiene el AudioContext suspendido, re-disparar al primer toque/tecla
  try {
    const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
    if (typeof window !== 'undefined' && (!ctx || ctx.state === 'suspended')) {
      const handleUnlock = () => {
        clearDriverUnlockListeners();
        if (driverRequestAlarmActive) {
          playDriverRequestPulse();
        }
      };
      window.addEventListener('pointerdown', handleUnlock, { passive: true, once: true });
      window.addEventListener('keydown', handleUnlock, { passive: true, once: true });
      window.addEventListener('touchstart', handleUnlock, { passive: true, once: true });
      driverUnlockCleanup = () => {
        window.removeEventListener('pointerdown', handleUnlock);
        window.removeEventListener('keydown', handleUnlock);
        window.removeEventListener('touchstart', handleUnlock);
      };
    }
  } catch {}

  driverRequestAlarmInterval = setInterval(() => {
    if (!driverRequestAlarmActive) return;
    playDriverRequestPulse();
  }, 2200);

  driverRequestAlarmTimeout = setTimeout(() => {
    stopDriverRequestAlarm();
    onAutoStop?.();
  }, durationMs);

  return () => stopDriverRequestAlarm();
}

