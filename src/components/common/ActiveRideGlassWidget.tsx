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
  KeyRound,
  CheckCircle2,
  MessageCircle,
  Flag,
  Clock,
  Radio,
} from 'lucide-react';

export interface ActiveRideGlassWidgetProps {
  solicitud: SolicitudTransporteFirestore;
  matchedDriver?: TaxiListing | null;
  userLocation?: { lat: number; lng: number; address?: string } | null;
  isDriverViewer?: boolean;
  nowTimestamp?: number;
  onLocateOnMap?: () => void;
  onOpenTaxiTab?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

const PROGRESS_STEPS = [
  { id: 'searching', label: 'Buscando unidad' },
  { id: 'found', label: 'Unidad asignada' },
  { id: 'en_route', label: 'En camino' },
  { id: 'arriving', label: 'GPS / Llegando' },
  { id: 'started', label: 'Viaje en curso' },
  { id: 'finished', label: 'Viaje finalizado' },
] as const;

function resolveTimestampMs(ts: unknown): number {
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) return ts;
  if (ts && typeof ts === 'object') {
    const maybeSeconds = (ts as { seconds?: unknown }).seconds;
    if (typeof maybeSeconds === 'number' && Number.isFinite(maybeSeconds)) {
      return maybeSeconds * 1000;
    }
    const maybeToMillis = (ts as { toMillis?: () => number }).toMillis;
    if (typeof maybeToMillis === 'function') {
      try {
        return maybeToMillis();
      } catch {}
    }
  }
  return Date.now();
}

function formatElapsedMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const ActiveRideGlassWidget: React.FC<ActiveRideGlassWidgetProps> = ({
  solicitud,
  matchedDriver,
  userLocation,
  isDriverViewer = false,
  nowTimestamp,
  onLocateOnMap,
  onOpenTaxiTab,
  onClose,
  compact = false,
}) => {
  const [internalNow, setInternalNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (typeof nowTimestamp === 'number') return;
    const id = setInterval(() => setInternalNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nowTimestamp]);

  const effectiveNow = typeof nowTimestamp === 'number' ? nowTimestamp : internalNow;

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

  const isTripInTransit = Boolean(solicitud.codigoValidado) && solicitud.estado !== 'completado';
  const isWaitingForPassengerPickup =
    (solicitud.estado === 'aceptado' || solicitud.estado === 'en_camino') &&
    !solicitud.codigoValidado;

  const elapsedSeconds = useMemo(() => {
    const anchorMs =
      solicitud.estado === 'pendiente'
        ? resolveTimestampMs(solicitud.fechaSolicitud)
        : resolveTimestampMs(solicitud.fechaAceptado || solicitud.fechaSolicitud);
    return Math.max(0, Math.floor((effectiveNow - anchorMs) / 1000));
  }, [effectiveNow, solicitud.estado, solicitud.fechaAceptado, solicitud.fechaSolicitud]);

  // Real 6-step intelligent progress index (0..5)
  // Paso 5 (index 4 - Viaje en curso): activo con GPS o código validado.
  // Paso 6 (index 5 - Viaje finalizado): SOLO queda completo cuando el prestador aprieta FINALIZAR Y PASAR A DESOCUPADO.
  const currentStepIndex = useMemo(() => {
    if (solicitud.estado === 'completado') return 5;
    if (solicitud.codigoValidado) return 5; // Paso 5 completado, esperando que el chofer finalice al llegar
    if (solicitud.gpsActivadoChofer) return 4;
    if (solicitud.estado === 'aceptado' || solicitud.estado === 'en_camino') {
      if (isNear) return 3; // Llegando
      if (solicitud.estado === 'en_camino' || matchedDriver) return 2; // En camino
      return 1; // Conductor encontrado
    }
    return 0; // Buscando unidad
  }, [solicitud.estado, solicitud.codigoValidado, solicitud.gpsActivadoChofer, isNear, matchedDriver]);

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
      : isTripInTransit
      ? 'Viaje en transcurso'
      : solicitud.gpsActivadoChofer
      ? 'GPS hacia pasajero'
      : etaMin !== null
      ? `~${etaMin} min`
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

  const progressPercent =
    solicitud.estado === 'completado'
      ? 100
      : isTripInTransit
      ? 88
      : Math.round(((currentStepIndex + 1) / PROGRESS_STEPS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="uppa-glass-ios rounded-3xl p-3.5 sm:p-4 text-white space-y-3 relative overflow-hidden"
    >
      {/* Subtle luminous top shimmer hairline */}
      <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none" />

      {/* iOS Glass Header: Viaje activo · Nombre · Estado + Tiempo en curso */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LottieMicroIcon
            variant={solicitud.estado === 'pendiente' ? 'radar' : 'spark'}
            className="w-5 h-5"
          />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#9299A5] leading-none flex items-center gap-1.5">
              <span>{isDriverViewer ? 'Servicio en transcurso' : 'Viaje en transcurso'}</span>
              {solicitud.estado !== 'completado' && (
                <span className="inline-flex items-center gap-0.5 text-[#FFF19A] font-mono">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatElapsedMMSS(elapsedSeconds)}</span>
                </span>
              )}
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

      {/* Avatar Vivo del Conductor (solo vista Pasajero para no redundar al chofer consigo mismo) */}
      {!isDriverViewer && hasDriverAssigned && (
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

      {/* Código de Viaje para el Pasajero al concretarse la asignación */}
      {!isDriverViewer &&
        (solicitud.estado === 'aceptado' || solicitud.estado === 'en_camino') &&
        solicitud.codigoSeguridad && (
          <div
            className={`rounded-2xl border-2 p-3 space-y-2 uppa-card-enter ${
              solicitud.codigoValidado
                ? 'bg-[#B7F36B]/15 border-[#B7F36B]'
                : 'bg-[#101114]/90 border-[#FFF19A]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-[#FFF19A] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>Código de Viaje</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                  solicitud.codigoValidado
                    ? 'bg-[#B7F36B] text-[#101114]'
                    : 'bg-[#FFF19A] text-[#101114]'
                }`}
              >
                {solicitud.codigoValidado ? 'Viaje verificado' : 'Verificá tu móvil'}
              </span>
            </div>

            {solicitud.codigoValidado ? (
              <div className="flex items-center gap-2 text-xs text-[#B7F36B] font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Código {solicitud.codigoSeguridad} validado · Es tu viaje indicado.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-1.5 rounded-xl bg-[#202329] border-2 border-[#FFF19A] font-mono text-xl font-black tracking-widest text-[#FFF19A] select-all shrink-0">
                    {solicitud.codigoSeguridad}
                  </div>
                  <div className="text-[11px] text-white/90 leading-snug">
                    Mostrá o enviá este código a <strong className="text-[#B7F36B]">{driverName}</strong> para confirmar que es el viaje indicado.
                  </div>
                </div>
                {solicitud.choferTelefono && (
                  <a
                    href={`https://wa.me/${solicitud.choferTelefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hola ${driverName}! Soy ${solicitud.nombrePasajero}. Mi código de viaje en UPPA es: ${solicitud.codigoSeguridad}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-xl uppa-cta-green font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Enviar Código ({solicitud.codigoSeguridad}) por WhatsApp</span>
                  </a>
                )}
              </>
            )}
          </div>
        )}

      {/* ANIMACIÓN INTELIGENTE DEL TRANSCURSO DEL VIAJE (Buscando -> Acercándose al encuentro -> Viaje en Transcurso hacia Destino) */}
      {solicitud.estado !== 'completado' && (
        <div
          className={`rounded-2xl border px-3 py-2.5 space-y-2 transition-colors ${
            isTripInTransit
              ? 'bg-[#B7F36B]/10 border-[#B7F36B]/55'
              : solicitud.gpsActivadoChofer
              ? 'bg-[#FFF19A]/10 border-[#FFF19A]/50'
              : 'bg-[#101114]/70 border-white/15'
          }`}
        >
          {/* Cabecera contextual inteligente */}
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5 text-[#B7F36B] min-w-0 truncate">
              <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
              <span className="truncate">
                {solicitud.estado === 'pendiente'
                  ? 'Buscando unidad disponible en tu zona...'
                  : isTripInTransit
                  ? isDriverViewer
                    ? `En viaje hacia: ${solicitud.destino}`
                    : `Viajando hacia: ${solicitud.destino}`
                  : solicitud.gpsActivadoChofer
                  ? isDriverViewer
                    ? `GPS activo hacia ${solicitud.nombrePasajero}`
                    : `${driverName} en camino con GPS en vivo`
                  : isDriverViewer
                  ? `Acercándose al punto de encuentro (${solicitud.nombrePasajero})`
                  : `${driverName} acercándose al punto de encuentro`}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#101114] border border-white/15 text-[#FFF19A] font-mono text-[10px] shrink-0">
              {solicitud.estado === 'pendiente'
                ? formatElapsedMMSS(elapsedSeconds)
                : isTripInTransit
                ? `En curso · ${formatElapsedMMSS(elapsedSeconds)}`
                : etaMin !== null
                ? `~${etaMin} min`
                : formatElapsedMMSS(elapsedSeconds)}
            </span>
          </div>

          {/* Corredor animado acorde a la etapa real */}
          {solicitud.estado === 'pendiente' && (
            <div className="relative h-8 flex items-center justify-between px-2 rounded-xl bg-[#101114]/75 border border-white/10 overflow-hidden">
              <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#FFF19A]/40 uppa-beacon-ring" />
                <span className="relative z-10 text-xs">📍</span>
              </div>
              <div className="flex-1 mx-2 h-1 rounded-full bg-white/10 overflow-hidden relative">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#FFF19A] to-[#B7F36B]"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-[#FFF19A] shrink-0">
                <span>{isMoto ? '🛵' : '🚗'}</span>
                <span>?</span>
              </div>
            </div>
          )}

          {isWaitingForPassengerPickup && (
            <div className="relative h-8 flex items-center justify-between overflow-hidden px-2 rounded-xl bg-[#101114]/80 border border-white/10">
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#FFF19A]/50" />
              <div className="relative z-10 flex-1 pr-7 overflow-hidden">
                <div className="w-full uppa-vehicle-approach-track">
                  <span
                    className="text-base leading-none inline-block"
                    aria-hidden="true"
                  >
                    {isMoto ? '🛵' : '🚗'}
                  </span>
                </div>
              </div>
              <div className="relative z-10 w-6 h-6 flex items-center justify-center shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#B7F36B]/45 uppa-beacon-ring" />
                <span className="relative text-sm leading-none" aria-hidden="true">
                  📍
                </span>
              </div>
            </div>
          )}

          {isTripInTransit && (
            <div className="space-y-1.5">
              <div className="relative h-10 flex items-center justify-between px-2.5 rounded-xl bg-[#101114]/90 border border-[#B7F36B]/45 overflow-hidden">
                {/* Ruta dinámica deslizándose bajo el vehículo */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-[3px] uppa-road-scroll opacity-90" />

                {/* Origen */}
                <div className="relative z-10 flex items-center gap-1 bg-[#202329] px-1.5 py-0.5 rounded-md border border-white/15 shrink-0">
                  <span className="text-[11px]" aria-hidden="true">📍</span>
                  <span className="text-[9px] font-black text-[#9299A5] uppercase">Inicio</span>
                </div>

                {/* Vehículo en movimiento continuo hacia Destino */}
                <div className="relative z-10 flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#202329]/90 border border-[#B7F36B]/50 shadow-[0_0_12px_rgba(183,243,107,0.3)]">
                    <span className="uppa-vehicle-cruise text-base leading-none" aria-hidden="true">
                      {isMoto ? '🛵' : '🚗'}
                    </span>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#B7F36B]">
                      En curso
                    </span>
                  </div>
                </div>

                {/* Destino con pulso */}
                <div className="relative z-10 flex items-center justify-center w-7 h-7 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-[#B7F36B]/45 uppa-beacon-ring" />
                  <span className="relative z-10 w-6 h-6 rounded-lg bg-[#B7F36B] text-[#101114] flex items-center justify-center">
                    <Flag className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] text-[#9299A5] px-0.5">
                <span className="truncate">
                  <strong className="text-white">Origen:</strong> {solicitud.origen}
                </span>
                <span className="truncate text-right text-[#FFF19A]">
                  <strong>Destino:</strong> {solicitud.destino}
                </span>
              </div>

              <p className="text-[10px] text-[#B7F36B]/95 font-semibold leading-tight">
                {isDriverViewer
                  ? 'El viaje permanece activo en pantalla hasta que presiones "FINALIZAR Y PASAR A DESOCUPADO".'
                  : 'Tu viaje está en transcurso y permanecerá activo hasta que el chofer finalice el traslado.'}
              </p>
            </div>
          )}
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
              (idx === 4 && (Boolean(solicitud.gpsActivadoChofer) || Boolean(solicitud.codigoValidado))) ||
              (idx === 5 && solicitud.estado === 'completado');
            const isCurrent =
              idx === currentStepIndex &&
              !(idx === 4 && (Boolean(solicitud.gpsActivadoChofer) || Boolean(solicitud.codigoValidado))) &&
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
