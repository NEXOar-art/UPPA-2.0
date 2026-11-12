import React, { useState } from 'react';
import { UserLocation, reverseGeocode } from '../../utils/geolocation';
import { Navigation, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
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
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestGPS = () => {
    setIsDetecting(true);
    setError(null);

    if (!('geolocation' in navigator)) {
      applyFallbackLocation();
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
      () => {
        applyFallbackLocation();
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000,
      }
    );
  };

  const applyFallbackLocation = async () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#202329] border-2 border-white/20 rounded-3xl shadow-[0_8px_0_rgba(0,0,0,0.65)] p-6 text-white flex flex-col gap-4 relative overflow-hidden">
        <div className="h-1.5 bg-[#FFF19A] absolute top-0 left-0 right-0" />

        <div className="w-14 h-14 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/50 flex items-center justify-center text-[#FFF19A] mx-auto mt-1">
          <Navigation className="w-7 h-7 animate-pulse text-[#FFF19A]" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-black text-white font-display">
            Ubicación en Tiempo Real Requerida
          </h2>
          <p className="text-xs text-[#9299A5]">
            ¡Hola, <strong className="text-[#FFF19A]">{userName}</strong>! Para ver los micros, taxis y reportar alertas cercanas en UPPA, es necesario acceder al GPS de tu móvil.
          </p>
        </div>

        {userRole === 'driver' && (
          <div className="p-3 rounded-xl bg-[#101114] border border-[#B7F36B]/45 text-[#B7F36B] text-xs flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white">Modo Conductor Conectado:</strong>
              <span className="text-[#9299A5]">
                Tu ubicación GPS se transmitirá en vivo al mapa de UPPA para que los pasajeros vean tu proximidad en tiempo real.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs text-[#9299A5] bg-[#101114] p-3.5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0" />
            <span>Validación anti-spam de reportes de tránsito y demoras</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0" />
            <span>Distancia exacta en km hacia las paradas y coches en ruta</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0" />
            <span>Cálculo automático del barrio (Malvinas / Zárate / Campana)</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-400/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRequestGPS}
            disabled={isDetecting}
            title="Solicitar permiso GPS del navegador para ubicar tu posición en tiempo real"
            className="w-full min-h-[48px] uppa-cta-yellow disabled:opacity-50 font-black text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            {isDetecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
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
            onClick={() => applyFallbackLocation()}
            title="Continuar con una ubicación de referencia en Barrio Malvinas sin sensor GPS"
            className="text-[11px] text-[#9299A5] hover:text-white py-2 transition-colors cursor-pointer"
          >
            Usar ubicación de referencia (Barrio Malvinas)
          </button>
        </div>
      </div>
    </div>
  );
};
