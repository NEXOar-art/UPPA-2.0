export type MicroSoundType =
  | 'ride_accepted'
  | 'payment_done'
  | 'driver_near'
  | 'step_progress';

let sharedAudioCtx: AudioContext | null = null;
let lastPlayedAt: Record<string, number> = {};

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Reproduces subtle, ~0.2s Uber-style micro-sounds using Web Audio API.
 * Gracefully degrades to no-op if audio context is unavailable or blocked.
 */
export function playMicroSound(type: MicroSoundType): void {
  try {
    const nowMs = Date.now();
    // Prevent duplicate rapid triggers within 350ms
    if (lastPlayedAt[type] && nowMs - lastPlayedAt[type] < 350) {
      return;
    }
    lastPlayedAt[type] = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;

    const playTone = (
      startOffset: number,
      freqStart: number,
      freqEnd: number,
      duration: number,
      peakGain: number = 0.032,
      wave: OscillatorType = 'sine'
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freqStart, t0 + startOffset);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + startOffset + duration);
      }

      gain.gain.setValueAtTime(0.0001, t0 + startOffset);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + startOffset);
      osc.stop(t0 + startOffset + duration + 0.02);
    };

    switch (type) {
      case 'ride_accepted':
        // 🔔 Warm two-note chime (~0.20s)
        playTone(0, 659.25, 659.25, 0.09, 0.032, 'sine');
        playTone(0.08, 880.0, 987.77, 0.14, 0.035, 'sine');
        break;

      case 'payment_done':
        // ✅ Crisp subtle harmonic confirmation (~0.22s)
        playTone(0, 523.25, 523.25, 0.08, 0.028, 'triangle');
        playTone(0.07, 659.25, 783.99, 0.14, 0.032, 'sine');
        break;

      case 'driver_near':
        // 📍 Gentle double proximity ping (~0.20s)
        playTone(0, 740.0, 783.99, 0.08, 0.028, 'sine');
        playTone(0.1, 987.77, 1046.5, 0.11, 0.03, 'sine');
        break;

      case 'step_progress':
        // ✅ Soft minimal tick-chime (~0.18s)
        playTone(0, 587.33, 783.99, 0.17, 0.025, 'sine');
        break;
    }
  } catch {
    // Ignore audio errors on restricted environments
  }
}
