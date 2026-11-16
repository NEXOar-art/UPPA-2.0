import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SolicitudTransporteFirestore, TaxiListing } from '../../types';
import { getDistanceKm } from '../../utils/geolocation';
import { playMicroSound } from '../../utils/soundEffects';
import { LottieMicroIcon } from './LottieMicroIcon';
import {
  Check,
  Star,
  Car,
  Bike,
  MapPin,
  Navigation,
  Sparkles,
  X,
} from 'lucide-react';

export interface ActiveRideGlassWidgetProps {
  solicitud: SolicitudTransporteFirestore;
  matchedDriver?: TaxiListing | null;
  userLocation?: { lat: number; lng: number; address?: string } | null;
  isDriverViewer?: boolean;
  onLocateOnMap?: () => void;
  onOpenTaxiTab?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

const PROGRESS_STEPS = [
  { id: 'searching', label: 'Buscando conductor' },
  { id: 'found', label: 'Conductor encontrado' },
  { id: 'en_route', label: 'En camino' },
  { id: 'arriving', label: 'Llegando' },
  { id: 'started', label: 'Viaje iniciado' },
  { id: 'finished', label: 'Viaje finalizado' },
] as const;

export const ActiveRideGlassWidget: React.FC<ActiveRideGlassWidgetProps> = ({
  solicitud,
  matchedDriver,
  userLocation,
  isDriverViewer = false,
  onLocateOnMap,
  onOpenTaxiTab,
  onClose,
  compact = false,
}) => {
  const isMoto =
    solicitud.tipoVehiculoRequerido === 'moto' ||
    matchedDriver?.vehicleType === 'moto';

  // Compute real GPS distance and ETA if coordinates exist
  const { distKm, etaMin, isNear } = useMemo(() => {
    const pLat = solicitud.origenCoords?.lat ?? userLocation?.lat;
    const pLng = solicitud.origenCoords?.lng ?? userLocation?.lng;
    const dLat = matchedDriver?.lat;
    const dLng = matchedDriver?.lng;

    if (
      typeof pLat === 'number' &&
      typeof pLng === 'number' &&
      typeof dLat === 'number' &&
      typeof dLng === 'number'
    ) {
      const km = getDistanceKm(dLat, dLng, pLat, pLng);
      const speedKmh = isMoto ? 34 : 30;
      const mins = Math.max(1, Math.round((km / speedKmh) * 60));
      return {
        distKm: Number(km.toFixed(2)),
        etaMin: mins,
        isNear: km <= 0.5 || mins <= 2,
      };
    }

    return {
      distKm: null as number | null,
      etaMin: null as number | null,
      isNear: false,
    };
  }, [solicitud.origenCoords, userLocation, matchedDriver, isMoto]);

  // Real 6-step intelligent progress index (0..5)
  // Paso 5 (index 4 - Viaje iniciado): se cumple cuando el prestador presiona el botón de GPS hacia el pasajero.
  // Paso 6 (index 5 - Viaje finalizado): SOLO queda completo cuando el prestador aprieta DESOCUPADO.
  const currentStepIndex = useMemo(() => {
    if (solicitud.estado === 'completado') return 5;
    if (solicitud.gpsActivadoChofer) return 4;
    if (solicitud.estado === 'aceptado' || solicitud.estado === 'en_camino') {
      if (isNear) return 3; // Llegando
      if (solicitud.estado === 'en_camino' || matchedDriver) return 2; // En camino
      return 1; // Conductor encontrado
    }
    return 0; // Buscando conductor
  }, [solicitud.estado, solicitud.gpsActivadoChofer, isNear, matchedDriver]);

  // Trigger subtle micro-sound when progress advances or match happens
  const prevStepRef = useRef<number>(currentStepIndex);
  const prevEstadoRef = useRef<string>(solicitud.estado);
  const [showMatchBanner, setShowMatchBanner] = useState<boolean>(false);

  useEffect(() => {
    const prevEstado = prevEstadoRef.current;
    const currEstado = solicitud.estado;
    prevEstadoRef.current = currEstado;

    if (
      prevEstado === 'pendiente' &&
      (currEstado === 'aceptado' || currEstado === 'en_camino')
    ) {
      setShowMatchBanner(true);
      playMicroSound('ride_accepted');
      const t = setTimeout(() => setShowMatchBanner(false), 5500);
      return () => clearTimeout(t);
    }
  }, [solicitud.estado]);

  useEffect(() => {
    const prev = prevStepRef.current;
    if (currentStepIndex > prev) {
      prevStepRef.current = currentStepIndex;
      if (currentStepIndex === 3) {
        playMicroSound('driver_near');
      } else if (currentStepIndex === 1) {
        setShowMatchBanner(true);
        playMicroSound('ride_accepted');
        const t = setTimeout(() => setShowMatchBanner(false), 5500);
        return () => clearTimeout(t);
      } else {
        playMicroSound('step_progress');
      }
    } else {
      prevStepRef.current = currentStepIndex;
    }
  }, [currentStepIndex]);

  const driverName =
    solicitud.choferNombre || matchedDriver?.driverName || 'Buscando chofer...';
  const hasDriverAssigned =
    solicitud.estado !== 'pendiente' &&
    Boolean(solicitud.choferNombre || matchedDriver);

  const etaHeadline =
    solicitud.estado === 'pendiente'
      ? 'Buscando móvil'
      : solicitud.estado === 'completado'
      ? 'Finalizado'
      : solicitud.gpsActivadoChofer
      ? 'Viaje iniciado'
      : etaMin !== null
      ? `${etaMin} min`
      : 'En camino';

  const realRatingText =
    typeof matchedDriver?.rating === 'number' && matchedDriver.rating > 0
      ? matchedDriver.rating.toFixed(1)
      : '0';

  const realVehicleModel =
    matchedDriver?.vehicleModel ||
    (isMoto ? 'Moto Taxi Habilitada' : 'Auto Taxi Habilitado');

  const realLocationText =
    matchedDriver?.zone || solicitud.origen || 'Zárate ↔ Campana';

  const progressPercent = Math.round(((currentStepIndex + 1) / PROGRESS_STEPS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="uppa-glass-ios rounded-3xl p-3.5 sm:p-4 text-white space-y-3 relative overflow-hidden"
    >
      {/* Subtle luminous top shimmer hairline */}
      <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none" />

      {/* iOS Glass Header: Viaje activo · Nombre · ETA */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LottieMicroIcon
            variant={solicitud.estado === 'pendiente' ? 'radar' : 'spark'}
            className="w-5 h-5"
          />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#9299A5] leading-none">
              {isDriverViewer ? 'Servicio activo' : 'Viaje activo'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-sm font-black text-white truncate max-w-[160px]">
                {isDriverViewer ? solicitud.nombrePasajero : driverName}
              </span>
              <span className="text-[#9299A5] text-xs">·</span>
              <span className="text-xs font-mono font-black text-[#B7F36B]">
                {etaHeadline}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onLocateOnMap && (
            <button
              type="button"
              onClick={onLocateOnMap}
              title="Ver ubicación y ruta en el mapa"
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-bold text-[#FFF19A] flex items-center gap-1 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mapa</span>
            </button>
          )}
          {onOpenTaxiTab && (
            <button
              type="button"
              onClick={onOpenTaxiTab}
              title="Ver detalle completo en Taxis & Motos"
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Detalle</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Ocultar tarjeta de viaje activo"
              aria-label="Ocultar"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Efecto Especial UPPA: Match Colaborativo (👤 + 🚗 se unen) */}
      {(showMatchBanner || (hasDriverAssigned && currentStepIndex === 1)) && (
        <div className="rounded-2xl bg-[#B7F36B]/12 border border-[#B7F36B]/50 px-3 py-2 flex items-center justify-between gap-2 uppa-card-enter">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#101114]/75 border border-white/15 rounded-xl px-2.5 py-1 overflow-hidden">
              <span className="text-sm inline-block uppa-match-left" aria-hidden="true">
                👤
              </span>
              <span className="text-[10px] font-black text-[#B7F36B] mx-1 uppa-match-pop">
                +
              </span>
              <span className="text-sm inline-block uppa-match-right" aria-hidden="true">
                {isMoto ? '🛵' : '🚗'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black text-[#B7F36B] flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Match Colaborativo</span>
              </div>
              <div className="text-[10px] text-white/85 truncate">
                {isDriverViewer
                  ? `Conectado con ${solicitud.nombrePasajero}`
                  : `${driverName} aceptó tu traslado`}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-black text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded-lg shrink-0">
            Unidos
          </span>
        </div>
      )}

      {/* Avatar Vivo del Conductor (con Foto, Calificación, Vehículo, Ubicación) */}
      {hasDriverAssigned && (
        <div className="rounded-2xl bg-[#101114]/65 border border-white/15 p-2.5 sm:p-3 flex items-center justify-between gap-2.5 uppa-card-enter">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-11 h-11 rounded-2xl bg-[#202329] border border-[#FFF19A]/50 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              {matchedDriver?.avatarUrl ? (
                <img
                  src={matchedDriver.avatarUrl}
                  alt={driverName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-black text-[#FFF19A]">
                  {driverName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#B7F36B] border-2 border-[#101114]" />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-white truncate">
                  {driverName}
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-mono font-black text-[#FFF19A]"
                  title="Calificación real del conductor"
                >
                  <Star className="w-3 h-3 fill-[#FFF19A] text-[#FFF19A]" />
                  <span>{realRatingText}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[10.5px] text-white/90 truncate">
                {isMoto ? (
                  <Bike className="w-3 h-3 text-[#B7F36B] shrink-0" />
                ) : (
                  <Car className="w-3 h-3 text-[#FFF19A] shrink-0" />
                )}
                <span className="truncate font-semibold">{realVehicleModel}</span>
                {matchedDriver?.patente && (
                  <span className="px-1.5 py-0.2 rounded bg-white text-[#101114] font-mono font-black text-[9.5px] uppercase shrink-0">
                    {matchedDriver.patente}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-[#9299A5] truncate">
                <MapPin className="w-3 h-3 text-[#B7F36B] shrink-0" />
                <span className="truncate">
                  {realLocationText}
                  {distKm !== null
                    ? ` · a ${distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm} km`}`
                    : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Efecto Especial UPPA: Vehículo acercándose (🚗 ---------> 📍) */}
      {hasDriverAssigned && !solicitud.codigoValidado && solicitud.estado !== 'completado' && (
        <div className="rounded-xl bg-[#101114]/60 border border-white/15 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-[#B7F36B]">
              {isDriverViewer ? 'Acercándose al pasajero' : 'Vehículo acercándose'}
            </span>
            <span className="text-[#FFF19A] font-mono">
              {etaMin !== null ? `~${etaMin} min` : 'En trayecto'}
            </span>
          </div>
          <div className="relative h-6 flex items-center justify-between overflow-hidden px-1">
            <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF19A]/45" />
            <div className="relative z-10 flex-1 pr-6 overflow-hidden">
              <div className="w-full uppa-vehicle-approach-track">
                <span
                  className="text-base leading-none inline-block"
                  aria-hidden="true"
                >
                  {isMoto ? '🛵' : '🚗'}
                </span>
              </div>
            </div>
            <span className="relative z-10 text-sm leading-none shrink-0" aria-hidden="true">
              📍
            </span>
          </div>
        </div>
      )}

      {/* Barra de Progreso Inteligente (6 pasos con animación y check verde) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-[#FFF19A]">
            {PROGRESS_STEPS[currentStepIndex]?.label}
          </span>
          <span className="font-mono text-[#9299A5] tabular-nums">
            Paso {currentStepIndex + 1}/{PROGRESS_STEPS.length} · {progressPercent}%
          </span>
        </div>

        {/* Track bar */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FFF19A] to-[#B7F36B]"
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          />
        </div>

        {/* Step checklist */}
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1.5 pt-0.5`}>
          {PROGRESS_STEPS.map((step, idx) => {
            const isCompleted =
              idx < currentStepIndex ||
              (idx === 4 && Boolean(solicitud.gpsActivadoChofer)) ||
              (idx === 5 && solicitud.estado === 'completado');
            const isCurrent =
              idx === currentStepIndex &&
              !(idx === 4 && Boolean(solicitud.gpsActivadoChofer)) &&
              !(idx === 5 && solicitud.estado === 'completado');
            return (
              <div
                key={step.id}
                className={`px-2 py-1.5 rounded-xl border text-[10px] flex items-center gap-1.5 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#B7F36B]/15 border-[#B7F36B]/50 text-[#B7F36B] font-bold'
                    : isCurrent
                    ? 'bg-[#FFF19A]/15 border-[#FFF19A]/70 text-white font-black'
                    : 'bg-white/[0.03] border-white/10 text-[#9299A5]'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? 'bg-[#B7F36B] text-[#101114] uppa-check-pop'
                      : isCurrent
                      ? 'bg-[#FFF19A] text-[#101114] animate-pulse'
                      : 'bg-white/10 text-[#9299A5]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ) : (
                    <span className="text-[8.5px] font-mono font-black">{idx + 1}</span>
                  )}
                </span>
                <span className="truncate leading-tight">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
