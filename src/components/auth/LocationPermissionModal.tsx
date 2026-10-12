import React, { useState } from 'react';
import { UserLocation, reverseGeocode } from '../../utils/geolocation';
import { MapPin, Navigation, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { UserRole } from '../../types';

interface LocationPermissionModalProps {
  isOpen: boolean;
  userRole: UserRole;
  userName: string;
  onLocationGranted: (location: UserLocation) => void;
  onDismiss?: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  userRole,
  userName,
  onLocationGranted,
  onDismiss,
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestGPS = () => {
    setIsDetecting(true);
    setError(null);

    if (!('geolocation' in navigator)) {
      applyFallbackLocation('El navegador no soporta GPS nativo. Se asignó ubicación de prueba.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        const address = await reverseGeocode(latitude, longitude);

        const location: UserLocation = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 15,
          speed: speed || 0,
          heading: heading || 0,
          address,
          timestamp: Date.now(),
          isSimulated: false,
        };

        setIsDetecting(false);
        onLocationGranted(location);
      },
      (geoError) => {
        // Provide friendly fallback with Campana / Malvinas / Zárate coordinates so user is not blocked
        applyFallbackLocation('No se pudo acceder al sensor físico. Se activó ubicación simulada en el corredor.');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000,
      }
    );
  };

  const applyFallbackLocation = async (msg: string) => {
    // Default to Barrio Malvinas / Campana Centro for testing
    const defaultCoords =
      userRole === 'driver'
        ? { lat: -34.1950, lng: -58.9720, address: 'Barrio Malvinas, Campana (Punto de Partida)' }
        : { lat: -34.1683, lng: -58.9592, address: 'Plaza Eduardo Costa, Campana Centro' };

    const location: UserLocation = {
      lat: defaultCoords.lat,
      lng: defaultCoords.lng,
      accuracy: 25,
      speed: 0,
      heading: 0,
      address: defaultCoords.address,
      timestamp: Date.now(),
      isSimulated: true,
    };

    setIsDetecting(false);
    onLocationGranted(location);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d1019] border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 text-slate-100 flex flex-col gap-4">
        {/* Top Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/60">
          <Navigation className="w-7 h-7 animate-pulse text-cyan-400" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-white font-display">
            Ubicación en Tiempo Real Requerida
          </h2>
          <p className="text-xs text-slate-300">
            ¡Hola, <strong className="text-cyan-400">{userName}</strong>! Para ingresar información en UPPA y ver los micros o taxis más cercanos, es necesario acceder al GPS de tu móvil.
          </p>
        </div>

        {userRole === 'driver' && (
          <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-emerald-200">Modo Conductor Conectado:</strong>
              Tu ubicación GPS se transmitirá en vivo al mapa de UPPA para que los pasajeros vean tu proximidad en tiempo real.
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs text-slate-400 bg-[#121624] p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Validación anti-spam de reportes de tránsito y demoras</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Distancia exacta en km hacia las paradas y coches en ruta</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Cálculo automático del barrio (Malvinas / Zárate / Campana)</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={handleRequestGPS}
            disabled={isDetecting}
            className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-98 transition-all"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Sincronizando satélites GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Activar GPS y Continuar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => applyFallbackLocation('Activando modo simulado para desarrollo')}
            className="text-[11px] text-slate-500 hover:text-slate-300 py-1 transition-colors"
          >
            Usar ubicación simulada de prueba (Barrio Malvinas)
          </button>
        </div>
      </div>
    </div>
  );
};
