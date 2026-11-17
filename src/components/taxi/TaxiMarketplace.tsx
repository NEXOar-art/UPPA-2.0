import React, { useState, useEffect, useMemo } from 'react';
import { TaxiListing, SolicitudTransporteFirestore, CalificacionChoferFirestore } from '../../types';
import {
  subscribeToSolicitudesTransporte,
  crearSolicitudTransporte,
  aceptarSolicitudTransporte,
  isSolicitudExpired,
  getSolicitudRemainingSeconds,
  isSolicitudAceptadaExpired,
  getSolicitudAceptadaRemainingSeconds,
  subscribeToRankingChoferes,
  getCalificacionInfo,
  getDriversDisponibilidadMap,
  subscribeToDriversDisponibilidad,
  setDriverDisponibilidad,
  validarCodigoSeguridadViaje,
  anularViajePorCodigo,
  activarGpsHaciaPasajero,
  finalizarViajeDeChofer,
  anunciarVehiculoDesocupado,
  RANKING_WINDOW_MS,
} from '../../services/realtimeFirebaseService';
import { UserLocation } from '../../utils/geolocation';
import { playMicroSound } from '../../utils/soundEffects';
import { ActiveRideGlassWidget } from '../common/ActiveRideGlassWidget';
import {
  Car,
  Bike,
  MessageCircle,
  Star,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  Navigation,
  KeyRound,
  Send,
  Zap,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Trophy,
  ExternalLink,
  Info,
  Phone,
  Lock,
} from 'lucide-react';
import { PoliticasTransporteModal } from './PoliticasTransporteModal';
import { CalificarChoferModal } from './CalificarChoferModal';

interface TaxiMarketplaceProps {
  taxis: TaxiListing[];
  onOpenPublishModal: (tab?: 'transfer' | 'enter-code') => void;
  onSelectTaxiOnMap?: (taxi: TaxiListing) => void;
  onLocatePassengerOnMap?: (solicitud: SolicitudTransporteFirestore) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserPhone?: string;
  currentUserRole?: string;
  isDriverHabilitado?: boolean;
  userLocation?: UserLocation | null;
  onOpenInfo?: () => void;
}

export const TaxiMarketplace: React.FC<TaxiMarketplaceProps> = ({
  taxis,
  onOpenPublishModal,
  onSelectTaxiOnMap,
  onLocatePassengerOnMap,
  currentUserId = 'usr-anon',
  currentUserName = 'Pasajero',
  currentUserPhone = '',
  currentUserRole = 'passenger',
  isDriverHabilitado = false,
  userLocation,
  onOpenInfo,
}) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);

  // Rol del usuario: ¿Es prestador de servicio habilitado?
  const isPrestadorLogueado = useMemo(() => {
    if (
      currentUserRole === 'admin' ||
      currentUserRole === 'administrador' ||
      currentUserRole === 'passenger' ||
      currentUserRole === 'pasajero'
    ) {
      return false;
    }
    return Boolean(
      isDriverHabilitado &&
        (currentUserRole === 'driver' ||
          currentUserRole === 'chofer' ||
          currentUserRole === 'chofer_auto' ||
          currentUserRole === 'chofer_moto')
    );
  }, [isDriverHabilitado, currentUserRole]);

  // Modal de pedido de transporte alternativo
  const [isRequestRideOpen, setIsRequestRideOpen] = useState(false);
  const [reqOrigin, setReqOrigin] = useState('');
  const [reqDestination, setReqDestination] = useState('');
  const [reqType, setReqType] = useState<'moto' | 'auto'>('auto');
  const [aceptaPoliticasRide, setAceptaPoliticasRide] = useState(false);
  const [reqPhone, setReqPhone] = useState(currentUserPhone || '');
  const [isSubmittingRide, setIsSubmittingRide] = useState(false);
  const [rideSuccessNotice, setRideSuccessNotice] = useState<string | null>(null);
  const [rideActionError, setRideActionError] = useState<string | null>(null);
  const [confirmingAnularId, setConfirmingAnularId] = useState<string | null>(null);
  const [isPoliticasOpen, setIsPoliticasOpen] = useState(false);

  const showActionError = (msg: string) => {
    setRideActionError(msg);
    setTimeout(() => setRideActionError(null), 5000);
  };

  useEffect(() => {
    if (!reqOrigin && userLocation?.address) {
      setReqOrigin(userLocation.address);
    }
  }, [userLocation, reqOrigin]);

  useEffect(() => {
    if (currentUserPhone && !reqPhone) {
      setReqPhone(currentUserPhone);
    }
  }, [currentUserPhone, reqPhone]);

  // Ticker de 1 segundo para contadores de vigencia (12 min / 16 min)
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a solicitudes de transporte alternativo
  useEffect(() => {
    const unsub = subscribeToSolicitudesTransporte((list) => {
      setSolicitudes(list);
    });
    return () => unsub();
  }, []);

  // Ranking en vivo de los últimos prestadores (últimas 3 horas)
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

  // Calificación post-viaje
  const [calificarTarget, setCalificarTarget] = useState<{
    driverId: string;
    driverName: string;
    solicitudId: string;
  } | null>(null);
  const [ratedSolicitudIds, setRatedSolicitudIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`);
      setRatedSolicitudIds(raw ? JSON.parse(raw) : []);
    } catch {
      setRatedSolicitudIds([]);
    }
  }, [currentUserId]);

  const markSolicitudAsRated = (solId: string) => {
    setRatedSolicitudIds((prev) => {
      if (prev.includes(solId)) return prev;
      const next = [...prev, solId];
      try {
        localStorage.setItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const unsub = subscribeToRankingChoferes((list) => {
      setRankingList(list);
    });
    return () => unsub();
  }, []);

  // Estado de ocupado / desocupado en tiempo real
  const [disponibilidadMap, setDisponibilidadMap] = useState<Record<string, 'desocupado' | 'ocupado'>>(() =>
    getDriversDisponibilidadMap()
  );

  useEffect(() => {
    const unsub = subscribeToDriversDisponibilidad((map) => {
      setDisponibilidadMap(map);
    });
    return () => unsub();
  }, []);

  const getTaxiDisponibilidad = (taxi: TaxiListing): 'desocupado' | 'ocupado' => {
    const keys = [
      taxi.id,
      taxi.userId,
      taxi.driverName,
      taxi.driverName?.toLowerCase()?.trim(),
      taxi.whatsapp,
    ].filter(Boolean) as string[];

    for (const key of keys) {
      if (disponibilidadMap[key]) {
        return disponibilidadMap[key];
      }
    }
    return taxi.disponibilidad || 'desocupado';
  };

  const isDriverCardOwnedByMe = (taxi: TaxiListing): boolean => {
    if (!isPrestadorLogueado) return false;
    const cleanMyPhone = (currentUserPhone || '').replace(/\D/g, '');
    const cleanTaxiPhone = (taxi.whatsapp || '').replace(/\D/g, '');
    const matchPhone =
      cleanMyPhone.length >= 6 &&
      cleanTaxiPhone.length >= 6 &&
      (cleanTaxiPhone.endsWith(cleanMyPhone.slice(-8)) ||
        cleanMyPhone.endsWith(cleanTaxiPhone.slice(-8)));
    const matchId = Boolean(
      currentUserId &&
        (taxi.userId === currentUserId ||
          taxi.id === currentUserId ||
          taxi.userId === `tx-driver-${currentUserId}`)
    );
    const matchName = Boolean(
      currentUserName &&
        taxi.driverName &&
        taxi.driverName.trim().toLowerCase() === currentUserName.trim().toLowerCase()
    );
    return matchId || matchPhone || matchName;
  };

  const myOwnedTaxis = useMemo(() => {
    if (!isPrestadorLogueado) return [];
    return taxis.filter((t) => t.endsAt > nowTimestamp && isDriverCardOwnedByMe(t));
  }, [isPrestadorLogueado, taxis, nowTimestamp, currentUserId, currentUserName, currentUserPhone]);

  const doesSolicitudMatchMeAsDriver = (sol: SolicitudTransporteFirestore): boolean => {
    if (!isPrestadorLogueado) return false;
    if (sol.choferId && currentUserId && sol.choferId === currentUserId) return true;
    const cleanMyName = (currentUserName || '').trim().toLowerCase();
    const cleanSolDriver = (sol.choferNombre || '').trim().toLowerCase();
    return Boolean(cleanMyName && cleanSolDriver && cleanSolDriver === cleanMyName);
  };

  const doesSolicitudBelongToMeAsPassenger = (sol: SolicitudTransporteFirestore): boolean => {
    if (currentUserId && currentUserId !== 'usr-anon' && sol.pasajeroId) {
      if (sol.pasajeroId === currentUserId) return true;
    }
    const cleanUser = (currentUserName || '').trim().toLowerCase();
    const cleanPass = (sol.nombrePasajero || '').trim().toLowerCase();
    return Boolean(cleanUser && cleanPass && cleanPass === cleanUser);
  };

  // Solicitudes activas (pendientes o aceptadas/en curso no expiradas)
  const visibleSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      if (sol.estado === 'cancelado' || sol.estado === 'expirada' || sol.estado === 'anulado' || sol.estado === 'completado') {
        return false;
      }
      if (sol.estado === 'pendiente') {
        return !isSolicitudExpired(sol, nowTimestamp);
      }
      if (sol.estado === 'aceptado' || sol.estado === 'en_camino') {
        if (isSolicitudAceptadaExpired(sol, nowTimestamp)) return false;
        return doesSolicitudBelongToMeAsPassenger(sol) || doesSolicitudMatchMeAsDriver(sol);
      }
      return false;
    });
  }, [solicitudes, nowTimestamp, currentUserId, currentUserName, isPrestadorLogueado]);

  // Solicitud aceptada activa del prestador logueado
  const myAcceptedSolicitud = useMemo(() => {
    if (!isPrestadorLogueado) return null;
    return (
      visibleSolicitudes.find(
        (sol) =>
          (sol.estado === 'aceptado' || sol.estado === 'en_camino') &&
          doesSolicitudMatchMeAsDriver(sol)
      ) || null
    );
  }, [isPrestadorLogueado, visibleSolicitudes, currentUserId, currentUserName]);

  // Disponibilidad real del chofer logueado (DESOCUPADO vs OCUPADO)
  const isLoggedDriverOcupado = useMemo(() => {
    if (!isPrestadorLogueado) return false;
    if (myAcceptedSolicitud) return true;

    const keys = [
      currentUserId,
      currentUserName,
      currentUserName?.toLowerCase()?.trim(),
      currentUserPhone,
      ...myOwnedTaxis.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
    ].filter(Boolean) as string[];

    for (const k of keys) {
      if (disponibilidadMap[k] === 'ocupado') return true;
    }
    return myOwnedTaxis.some((t) => getTaxiDisponibilidad(t) === 'ocupado');
  }, [isPrestadorLogueado, myAcceptedSolicitud, currentUserId, currentUserName, currentUserPhone, myOwnedTaxis, disponibilidadMap]);

  // Solicitudes pendientes: SOLO visibles para choferes habilitados que están DISPONIBLES (DESOCUPADO)
  const driverPendingSolicitudes = useMemo(() => {
    if (!isPrestadorLogueado || isLoggedDriverOcupado) return [];
    return visibleSolicitudes.filter((sol) => sol.estado === 'pendiente');
  }, [isPrestadorLogueado, isLoggedDriverOcupado, visibleSolicitudes]);

  // Solicitudes propias del pasajero
  const myPassengerSolicitudes = useMemo(() => {
    return visibleSolicitudes.filter((sol) => doesSolicitudBelongToMeAsPassenger(sol));
  }, [visibleSolicitudes, currentUserId, currentUserName]);

  // Viajes completados elegibles para calificar (del pasajero, últimas 3 horas)
  const eligibleCompletedRides = useMemo(() => {
    if (isPrestadorLogueado) return [];
    const cutoff = nowTimestamp - RANKING_WINDOW_MS;
    return solicitudes
      .filter((s) => {
        if (s.estado !== 'completado') return false;
        if (!doesSolicitudBelongToMeAsPassenger(s)) return false;
        if (ratedSolicitudIds.includes(s.id)) return false;
        const ts = Number(s.fechaCompletado || s.fechaAceptado || s.fechaSolicitud || 0);
        return !ts || ts >= cutoff;
      })
      .sort(
        (a, b) =>
          Number(b.fechaCompletado || b.fechaAceptado || 0) -
          Number(a.fechaCompletado || a.fechaAceptado || 0)
      );
  }, [isPrestadorLogueado, solicitudes, ratedSolicitudIds, nowTimestamp, currentUserId, currentUserName]);

  // Conteo informativo real de móviles disponibles (sin mostrar fichas de chofer)
  const availableDriversCount = useMemo(() => {
    return taxis.filter((t) => t.endsAt > nowTimestamp && getTaxiDisponibilidad(t) === 'desocupado').length;
  }, [taxis, nowTimestamp, disponibilidadMap]);

  const handleToggleMyDisponibilidad = async (forceNext?: 'desocupado' | 'ocupado') => {
    const nextDisp: 'desocupado' | 'ocupado' =
      forceNext || (isLoggedDriverOcupado ? 'desocupado' : 'ocupado');

    const driverVehicleType: 'auto' | 'moto' =
      myOwnedTaxis[0]?.vehicleType === 'moto' || currentUserRole === 'chofer_moto'
        ? 'moto'
        : 'auto';

    if (nextDisp === 'desocupado') {
      try {
        await finalizarViajeDeChofer(currentUserId, currentUserName);
      } catch {}
      await anunciarVehiculoDesocupado(currentUserId, currentUserName, driverVehicleType);
    }

    const keys = [
      currentUserId,
      currentUserName,
      currentUserName?.toLowerCase()?.trim(),
      currentUserPhone,
      ...myOwnedTaxis.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
    ].filter(Boolean) as string[];

    keys.forEach((k) => setDriverDisponibilidad(k, nextDisp));
    setDisponibilidadMap((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = nextDisp;
      });
      return next;
    });

    setRideSuccessNotice(
      nextDisp === 'desocupado'
        ? 'Estado cambiado a DESOCUPADO. Ya podés ver las solicitudes de pasajeros disponibles.'
        : 'Estado cambiado a OCUPADO. No recibirás nuevas solicitudes hasta pasar a DESOCUPADO.'
    );
    setTimeout(() => setRideSuccessNotice(null), 5000);
  };

  const handleCreateRideRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide) return;
    if (!aceptaPoliticasRide) {
      showActionError('Debés aceptar la Política & Descargo para emitir el pedido.');
      return;
    }

    setIsSubmittingRide(true);
    try {
      await crearSolicitudTransporte({
        pasajeroId: currentUserId,
        nombrePasajero: currentUserName,
        telefonoPasajero: reqPhone.trim() || currentUserPhone || '',
        origen: reqOrigin.trim(),
        destino: reqDestination.trim(),
        tipoVehiculoRequerido: reqType,
        origenCoords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
      });
      setIsRequestRideOpen(false);
      setAceptaPoliticasRide(false);
      setRideSuccessNotice(
        '¡Pedido de transporte emitido! Solo los choferes disponibles reciben tu solicitud.'
      );
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (e: any) {
      showActionError('Error al solicitar transporte: ' + (e.message || 'Intentá nuevamente'));
    } finally {
      setIsSubmittingRide(false);
    }
  };

  const handleAcceptRide = async (solId: string) => {
    if (!isDriverHabilitado) {
      showActionError('Solo los prestadores habilitados por el Administrador pueden aceptar viajes.');
      return;
    }
    if (isLoggedDriverOcupado) {
      showActionError('Ya tenés un viaje activo o estás en estado OCUPADO.');
      return;
    }

    const target = solicitudes.find((s) => s.id === solId);
    if (target && isSolicitudExpired(target, Date.now())) {
      showActionError('Esta solicitud expiró tras 12 minutos sin chofer asignado.');
      return;
    }
    try {
      const acceptedSol = await aceptarSolicitudTransporte(
        solId,
        currentUserId,
        currentUserName,
        currentUserPhone || ''
      );

      if (!acceptedSol) {
        showActionError('Esta solicitud ya fue tomada por otro prestador o expiró.');
        return;
      }

      const keys = [
        currentUserId,
        currentUserName,
        currentUserName?.toLowerCase()?.trim(),
        currentUserPhone,
        ...myOwnedTaxis.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
      ].filter(Boolean) as string[];

      keys.forEach((k) => setDriverDisponibilidad(k, 'ocupado'));
      setDisponibilidadMap((prev) => {
        const next = { ...prev };
        keys.forEach((k) => {
          next[k] = 'ocupado';
        });
        return next;
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('uppa-driver-accepted-ride', {
            detail: { driverId: currentUserId, driverName: currentUserName, solId, solicitud: acceptedSol },
          })
        );
      }

      playMicroSound('ride_accepted');
      setRideSuccessNotice(
        '¡Viaje aceptado! Ya tenés la ficha con el WhatsApp del pasajero y el botón de GPS para ir a buscarlo.'
      );
      setTimeout(() => setRideSuccessNotice(null), 6000);
    } catch (e: any) {
      showActionError('Error al aceptar viaje: ' + (e.message || ''));
    }
  };

  // Validación de código de seguridad por parte del chofer
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  const [codeSuccesses, setCodeSuccesses] = useState<Record<string, string>>({});
  const [isValidatingCode, setIsValidatingCode] = useState<Record<string, boolean>>({});

  const handleVerifyCode = async (solId: string) => {
    const code = (codeInputs[solId] || '').trim().toUpperCase();
    if (!code) {
      setCodeErrors((prev) => ({
        ...prev,
        [solId]: 'Ingresá el código de viaje provisto por el pasajero.',
      }));
      return;
    }
    setIsValidatingCode((prev) => ({ ...prev, [solId]: true }));
    setCodeErrors((prev) => ({ ...prev, [solId]: '' }));
    try {
      const res = await validarCodigoSeguridadViaje(solId, code, currentUserId);
      if (!res.success) {
        setCodeErrors((prev) => ({
          ...prev,
          [solId]: res.error || 'Código de viaje incorrecto.',
        }));
      } else {
        playMicroSound('payment_done');
        setCodeSuccesses((prev) => ({
          ...prev,
          [solId]: '¡Código validado! Viaje confirmado en curso.',
        }));
      }
    } catch (err: any) {
      setCodeErrors((prev) => ({
        ...prev,
        [solId]: err.message || 'Error al validar código.',
      }));
    } finally {
      setIsValidatingCode((prev) => ({ ...prev, [solId]: false }));
    }
  };

  const handleAnularRide = async (
    solId: string,
    motivo: string = 'Código incorrecto o pasajero no abordó'
  ) => {
    if (confirmingAnularId !== solId) {
      setConfirmingAnularId(solId);
      return;
    }
    try {
      await anularViajePorCodigo(solId, motivo);
      setConfirmingAnularId(null);
      await handleToggleMyDisponibilidad('desocupado');
      setRideSuccessNotice('Viaje anulado. Tu estado volvió a DESOCUPADO.');
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (err: any) {
      showActionError('Error al anular viaje: ' + (err.message || ''));
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#101114] text-white overflow-hidden font-sans">
      {/* Top Header */}
      <div className="p-3.5 sm:p-5 border-b-2 border-white/10 bg-[#202329] shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A] flex items-center justify-center text-[#FFF19A] shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-display leading-tight tracking-tight">
                Taxis &amp; Motos
              </h2>
              {onOpenInfo && (
                <button
                  type="button"
                  onClick={onOpenInfo}
                  title="Ver funcionalidades de Taxis & Motos"
                  aria-label="Información de Taxis & Motos"
                  className="w-6 h-6 rounded-full bg-[#101114] border border-white/20 hover:border-[#FFF19A] text-[#FFF19A] flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {isPrestadorLogueado && (
              <button
                type="button"
                onClick={() => handleToggleMyDisponibilidad()}
                className={`min-h-[42px] px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer border-2 ${
                  isLoggedDriverOcupado
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A]'
                    : 'bg-[#B7F36B] text-[#101114] border-[#B7F36B]'
                }`}
                title="Alternar tu disponibilidad como chofer (Ocupado / Desocupado)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#101114]" />
                <span>{isLoggedDriverOcupado ? 'Estado: OCUPADO' : 'Estado: DESOCUPADO'}</span>
              </button>
            )}

            {!isPrestadorLogueado && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRequestRideOpen(true)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl uppa-cta-yellow font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Solicitar transporte alternativo (Auto Taxi o Moto Taxi)"
                >
                  <Zap className="w-4 h-4" />
                  <span>Pedir Transporte</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPublishModal('transfer')}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl uppa-cta-green font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Enviar solicitud para prestar servicio como Auto Taxi o Moto Taxi"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Prestar Servicio</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsPoliticasOpen(true)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border-2 border-[#FFF19A]/50 bg-[#101114] hover:border-[#FFF19A] text-[#FFF19A] text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ver Políticas de Uso y Descargo de Responsabilidad"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Políticas & Descargo</span>
            </button>
          </div>
        </div>

        {!isDriverHabilitado &&
          (currentUserRole === 'driver' ||
            currentUserRole === 'chofer' ||
            currentUserRole === 'chofer_auto' ||
            currentUserRole === 'chofer_moto') && (
            <div className="mt-3 p-3 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="space-y-0.5">
                <div className="font-black text-[#FFF19A] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>Tu cuenta de Chofer está Pendiente de Habilitación</span>
                </div>
                <p className="text-[11px] text-[#9299A5]">
                  Una vez aprobado por Administración UPPA y en estado DESOCUPADO, verás aquí las solicitudes de pasajeros en vivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPublishModal('transfer')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl uppa-cta-yellow font-black text-xs shrink-0 cursor-pointer"
              >
                Completar Solicitud de Turno
              </button>
            </div>
          )}

        {rideSuccessNotice && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-[#B7F36B]/15 border-2 border-[#B7F36B] text-[#B7F36B] text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{rideSuccessNotice}</span>
          </div>
        )}
        {rideActionError && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/15 border-2 border-rose-400 text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{rideActionError}</span>
          </div>
        )}

        {/* Barra de Ranking y estado de red */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => setIsRankingDropdownOpen(!isRankingDropdownOpen)}
            title={`Ranking de Prestadores (${rankingList.length} calificaciones recientes)`}
            aria-label="Ranking de Prestadores"
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isRankingDropdownOpen
                ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                : 'bg-[#101114] border-[#FFF19A]/50 text-[#FFF19A] hover:border-[#FFF19A]'
            }`}
          >
            <Trophy className="w-5 h-5 shrink-0" />
            {rankingList.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black ${
                  isRankingDropdownOpen
                    ? 'bg-[#101114] text-[#FFF19A]'
                    : 'bg-[#202329] text-white'
                }`}
              >
                {rankingList.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 text-[11px] font-black text-[#9299A5] bg-[#101114] border-2 border-white/10 px-3 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-[#B7F36B]" />
            <span className="text-white">
              Móviles disponibles: <span className="text-[#B7F36B] font-mono">{availableDriversCount}</span>
            </span>
          </div>
        </div>

        {/* Ranking desplegable */}
        {isRankingDropdownOpen && (
          <div className="mt-2.5 rounded-2xl border-2 border-white/15 p-3 bg-[#101114] animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
              <span className="text-xs font-black text-[#FFF19A] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                <span>Ranking de Prestadores (Últimas 3 horas)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsRankingDropdownOpen(false)}
                title="Cerrar ranking de prestadores"
                className="w-7 h-7 rounded-lg bg-[#202329] text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {rankingList.length === 0 ? (
              <div className="py-3 text-center text-xs text-[#9299A5]">
                Sin calificaciones registradas en las últimas 3 horas
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {rankingList.slice(0, 20).map((item, idx) => {
                  const info = getCalificacionInfo(item.puntuacion);
                  return (
                    <div
                      key={item.id}
                      className="px-2.5 py-2 rounded-xl bg-[#202329] border border-white/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg font-mono font-black text-[10px] flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-[#FFF19A] text-[#101114]'
                              : idx === 1
                              ? 'bg-white text-[#101114]'
                              : idx === 2
                              ? 'bg-[#B7F36B] text-[#101114]'
                              : 'bg-[#101114] text-[#9299A5]'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-white truncate text-xs">
                          {item.driverName}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border flex items-center gap-1 shrink-0 ${info.badgeClass}`}
                      >
                        <span>{item.puntuacion} - {info.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Scrollable Area — ÚNICAMENTE Solicitudes Pasajero ↔ Prestador (sin fichas de prestadores) */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
        {isPrestadorLogueado ? (
          /* ============================================================================
             VISTA DEL PRESTADOR DE SERVICIO HABILITADO
             1. Si aceptó un viaje: muestra LA FICHA con WhatsApp del Pasajero + Botón GPS + Validación Código.
             2. Solo si está DISPONIBLE (DESOCUPADO): muestra las solicitudes pendientes de pasajeros.
             ============================================================================ */
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 1. FICHA DEL VIAJE ACEPTADO (WhatsApp del Pasajero + Botón GPS hacia el Pasajero) */}
            {myAcceptedSolicitud && (() => {
              const sol = myAcceptedSolicitud;
              const remainingAcceptedSec = getSolicitudAceptadaRemainingSeconds(sol, nowTimestamp);
              const acceptedMins = Math.floor(remainingAcceptedSec / 60);
              const acceptedSecs = remainingAcceptedSec % 60;
              const pPhone = sol.telefonoPasajero || '';
              const cleanPhone = pPhone.replace(/\D/g, '');
              const hasPhone = cleanPhone.length >= 6;
              const fullPhone = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
              const gpsTargetParam = sol.origenCoords
                ? `${sol.origenCoords.lat},${sol.origenCoords.lng}`
                : encodeURIComponent(sol.origen);

              return (
                <div className="p-4 sm:p-5 rounded-3xl bg-[#202329] border-2 border-[#B7F36B] shadow-[5px_5px_0px_rgba(0,0,0,0.65)] space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center shrink-0">
                        {sol.tipoVehiculoRequerido === 'moto' ? (
                          <Bike className="w-5 h-5" />
                        ) : (
                          <Car className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#B7F36B]">
                          Viaje Aceptado · Pasajero Asignado
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-white truncate">
                          {sol.nombrePasajero}
                        </h3>
                      </div>
                    </div>

                    <span
                      className="px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase bg-[#B7F36B] text-[#101114] font-mono shrink-0"
                      title="Tiempo restante de seguimiento activo"
                    >
                      ✓ En curso · {acceptedMins}:{acceptedSecs.toString().padStart(2, '0')}
                    </span>
                  </div>

                  {/* Origen y Destino desbloqueados */}
                  <div className="p-3 rounded-2xl bg-[#101114] border border-white/15 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 text-white">
                      <MapPin className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#9299A5] block">Origen (Recogida GPS)</span>
                        <span className="font-bold">{sol.origen}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-white pt-1 border-t border-white/10">
                      <Navigation className="w-4 h-4 text-[#FFF19A] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#9299A5] block">Destino</span>
                        <span className="font-semibold text-[#FFF19A]">{sol.destino}</span>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp del Pasajero */}
                  <div className="p-3 rounded-2xl bg-[#101114] border-2 border-[#B7F36B]/50 space-y-2">
                    <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                      <span className="text-[#9299A5] font-bold flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#B7F36B]" />
                        <span>WhatsApp del Pasajero:</span>
                      </span>
                      <span className="font-mono text-[#B7F36B] font-black">
                        {hasPhone ? `+${cleanPhone}` : 'No informado por el pasajero'}
                      </span>
                    </div>

                    {hasPhone ? (
                      <a
                        href={`https://wa.me/${fullPhone}?text=${encodeURIComponent(
                          `Hola ${sol.nombrePasajero}! Soy tu chofer (${sol.choferNombre || currentUserName}) de UPPA. Ya acepté tu viaje hacia ${sol.destino} y voy en camino. Pasame tu código de viaje al abordar.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir WhatsApp con el pasajero +${cleanPhone}`}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        <span>WhatsApp Pasajero (+{cleanPhone})</span>
                      </a>
                    ) : (
                      <p className="text-[11px] text-[#FFF19A] leading-snug">
                        El pasajero no cargó número de WhatsApp; te mostrará su Código de Viaje en pantalla al subir.
                      </p>
                    )}
                  </div>

                  {/* Botón GPS para ir al Pasajero */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        activarGpsHaciaPasajero(sol.id);
                        onLocatePassengerOnMap?.({ ...sol, gpsActivadoChofer: true });
                      }}
                      className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl uppa-cta-yellow font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                      title="Activar GPS y enviar al mapa directo hacia la ubicación del pasajero"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>📍 Ir al Pasajero (GPS en Mapa)</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${gpsTargetParam}&travelmode=driving`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => activarGpsHaciaPasajero(sol.id)}
                      title="Abrir navegación giro a giro en Google Maps hasta el pasajero"
                      className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-[#101114] hover:border-[#FFF19A] border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#FFF19A]" />
                      <span>Abrir Google Maps GPS</span>
                    </a>
                  </div>

                  {/* Validación del Código de Viaje del Pasajero */}
                  {!sol.codigoValidado ? (
                    <div className="p-3 rounded-2xl bg-[#101114] border border-[#FFF19A]/45 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#FFF19A] font-black flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Código de Viaje del Pasajero:</span>
                        </span>
                        {typeof sol.intentosFallidosCodigo === 'number' &&
                          sol.intentosFallidosCodigo > 0 && (
                            <span className="text-rose-300 font-mono font-bold text-[10.5px]">
                              {3 - sol.intentosFallidosCodigo} intentos restantes
                            </span>
                          )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={codeInputs[sol.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setCodeInputs((prev) => ({ ...prev, [sol.id]: val }));
                            setCodeErrors((prev) => ({ ...prev, [sol.id]: '' }));
                          }}
                          placeholder="CÓDIGO"
                          className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#202329] border border-[#FFF19A]/50 font-mono text-sm font-black text-[#FFF19A] placeholder-[#9299A5] uppercase tracking-widest focus:outline-none focus:border-[#FFF19A]"
                        />
                        <button
                          type="button"
                          disabled={isValidatingCode[sol.id] || !(codeInputs[sol.id] || '').trim()}
                          onClick={() => handleVerifyCode(sol.id)}
                          title="Validar el código de viaje entregado por el pasajero"
                          className="min-h-[42px] px-4 rounded-xl bg-[#B7F36B] hover:bg-[#c5f784] disabled:opacity-40 text-[#101114] font-black text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                        >
                          {isValidatingCode[sol.id] ? '...' : 'Validar'}
                        </button>
                      </div>

                      {codeErrors[sol.id] && (
                        <p className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5 leading-tight">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                          <span>{codeErrors[sol.id]}</span>
                        </p>
                      )}

                      {codeSuccesses[sol.id] && (
                        <p className="text-[11px] text-[#B7F36B] font-bold flex items-center gap-1.5 leading-tight">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{codeSuccesses[sol.id]}</span>
                        </p>
                      )}

                      {confirmingAnularId === sol.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAnularRide(sol.id, 'Código incorrecto o pasajero no abordó')}
                            title="Confirmar anulación del viaje y volver a estado desocupado"
                            className="flex-1 min-h-[38px] py-1.5 px-2.5 text-[11px] font-black bg-rose-600 text-white rounded-xl cursor-pointer"
                          >
                            Confirmar Anulación
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingAnularId(null)}
                            title="Cancelar anulación"
                            className="min-h-[38px] py-1.5 px-3 text-[11px] font-bold bg-[#202329] text-white border border-white/20 rounded-xl cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAnularRide(sol.id, 'Código incorrecto o pasajero no abordó')}
                          title="Anular el viaje si el código no coincide o el pasajero no aborda"
                          className="w-full min-h-[38px] py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-500/15 rounded-xl border border-rose-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 text-rose-400" />
                          <span>Anular viaje si el código no coincide</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-[#B7F36B]/15 border border-[#B7F36B] text-[#B7F36B] text-xs flex items-center justify-between gap-2 flex-wrap font-black">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Código verificado · Viaje en curso</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMyDisponibilidad('desocupado')}
                        className="min-h-[36px] px-3 py-1 rounded-xl bg-[#B7F36B] text-[#101114] text-[11px] font-black cursor-pointer"
                      >
                        Finalizar y pasar a DESOCUPADO
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. SOLICITUDES PENDIENTES DE PASAJEROS (SOLO visibles si el chofer está DISPONIBLE / DESOCUPADO) */}
            {!isLoggedDriverOcupado ? (
              <div className="p-4 sm:p-5 rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/45 space-y-3.5 shadow-[4px_4px_0px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        driverPendingSolicitudes.length > 0 ? 'bg-[#B7F36B] animate-pulse' : 'bg-[#9299A5]'
                      }`}
                    />
                    <h3 className="text-sm font-black text-white">
                      Solicitudes de Transporte Alternativo ({driverPendingSolicitudes.length})
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-[#B7F36B]/20 border border-[#B7F36B]/50 text-[#B7F36B]">
                    Chofer Disponible
                  </span>
                </div>

                {driverPendingSolicitudes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {driverPendingSolicitudes.map((sol) => {
                      const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                      const mins = Math.floor(remainingSec / 60);
                      const secs = remainingSec % 60;
                      const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                      return (
                        <div
                          key={sol.id}
                          className="p-3.5 rounded-2xl border-2 border-[#FFF19A]/50 bg-[#101114] text-xs space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 font-black text-white min-w-0">
                                {sol.tipoVehiculoRequerido === 'moto' ? (
                                  <Bike className="w-4 h-4 text-[#FFF19A] shrink-0" />
                                ) : (
                                  <Car className="w-4 h-4 text-[#B7F36B] shrink-0" />
                                )}
                                <span className="truncate">{sol.nombrePasajero}</span>
                              </div>

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black font-mono flex items-center gap-1 shrink-0 ${
                                  remainingSec <= 180
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/50'
                                    : 'bg-[#FFF19A] text-[#101114]'
                                }`}
                                title="Tiempo restante para aceptar viaje (límite 12 minutos)"
                              >
                                <Clock className="w-3 h-3" />
                                <span>{formattedTimer}</span>
                              </span>
                            </div>

                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#202329] border border-white/10 text-[10px] font-bold text-[#9299A5]">
                              <span>Pedido: {sol.tipoVehiculoRequerido === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}</span>
                            </div>

                            <div className="text-[11px] text-[#9299A5] space-y-1">
                              <p className="truncate text-[#FFF19A] font-semibold flex items-center gap-1">
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>GPS y WhatsApp visibles al aceptar</span>
                              </p>
                              <p className="text-white font-semibold">🏁 Destino: {sol.destino}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAcceptRide(sol.id)}
                            title="Aceptar viaje y acceder al WhatsApp y GPS del pasajero"
                            className="w-full min-h-[44px] py-2 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Aceptar Viaje ({formattedTimer})</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-5 px-4 rounded-2xl bg-[#101114] border border-white/10 text-center space-y-1">
                    <p className="text-xs font-bold text-white">
                      No hay pedidos de transporte alternativo pendientes en este momento.
                    </p>
                    <p className="text-[11px] text-[#9299A5]">
                      Como estás en estado <strong className="text-[#B7F36B]">DESOCUPADO</strong>, apenas un pasajero solicite un viaje aparecerá aquí al instante.
                    </p>
                  </div>
                )}
              </div>
            ) : !myAcceptedSolicitud ? (
              <div className="p-4 sm:p-5 rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/45 space-y-3 text-center">
                <div className="w-11 h-11 rounded-2xl bg-[#FFF19A]/15 border border-[#FFF19A]/40 text-[#FFF19A] flex items-center justify-center mx-auto">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white">Estás en estado OCUPADO</h3>
                  <p className="text-xs text-[#9299A5] max-w-md mx-auto leading-relaxed">
                    Solo los choferes disponibles (<strong className="text-[#B7F36B]">DESOCUPADO</strong>) visualizan las solicitudes de transporte alternativo de pasajeros.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMyDisponibilidad('desocupado')}
                  className="min-h-[44px] px-5 py-2 rounded-xl uppa-cta-green font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Pasar a DESOCUPADO para ver solicitudes</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          /* ============================================================================
             VISTA DEL PASAJERO (SIN FICHAS DE PRESTADORES, SOLO SU SOLICITUD + CÓDIGO)
             ============================================================================ */
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Solicitudes activas del propio pasajero */}
            {myPassengerSolicitudes.length > 0 ? (
              <div className="p-3.5 sm:p-4 rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/45 space-y-3 shadow-[4px_4px_0px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-black text-[#FFF19A] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] animate-pulse" />
                    Tu Solicitud de Transporte en Curso
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPoliticasOpen(true)}
                    title="Ver Políticas de Uso y Descargo"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-[#FFF19A] bg-[#101114] border border-[#FFF19A]/40 cursor-pointer"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Políticas</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {myPassengerSolicitudes.map((sol) => {
                    const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                    const mins = Math.floor(remainingSec / 60);
                    const secs = remainingSec % 60;
                    const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                    const matchedDriverObj =
                      taxis.find(
                        (t) =>
                          (sol.choferId && (t.userId === sol.choferId || t.id === sol.choferId)) ||
                          (sol.choferNombre &&
                            t.driverName.trim().toLowerCase() === sol.choferNombre.trim().toLowerCase())
                      ) || null;

                    return (
                      <div key={sol.id} className="space-y-2.5">
                        <ActiveRideGlassWidget
                          solicitud={sol}
                          matchedDriver={matchedDriverObj}
                          userLocation={userLocation}
                          onLocateOnMap={
                            matchedDriverObj && onSelectTaxiOnMap
                              ? () => onSelectTaxiOnMap(matchedDriverObj)
                              : undefined
                          }
                        />

                        <div
                          className={`p-3.5 rounded-2xl border-2 text-xs bg-[#101114] space-y-2 ${
                            sol.estado === 'aceptado' || sol.estado === 'en_camino'
                              ? 'border-[#B7F36B]'
                              : 'border-[#FFF19A]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-black text-white flex items-center gap-1.5">
                              {sol.tipoVehiculoRequerido === 'moto' ? (
                                <Bike className="w-4 h-4 text-[#FFF19A]" />
                              ) : (
                                <Car className="w-4 h-4 text-[#B7F36B]" />
                              )}
                              <span>{sol.tipoVehiculoRequerido === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}</span>
                            </span>
                            {sol.estado === 'pendiente' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-[#FFF19A] text-[#101114]">
                                Buscando chofer disponible ({formattedTimer})
                              </span>
                            )}
                            {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#B7F36B] text-[#101114]">
                                ✓ Chofer asignado: {sol.choferNombre || 'En camino'}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-[11px] text-white">📍 Origen: {sol.origen}</p>
                            <p className="text-[11px] text-[#9299A5]">🏁 Destino: {sol.destino}</p>
                          </div>

                          {/* Código de Viaje para el Pasajero */}
                          {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                            <>
                              {!sol.codigoValidado ? (
                                <div className="mt-2 p-3 rounded-xl bg-[#202329] border-2 border-[#FFF19A] space-y-2">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="text-[10.5px] font-black uppercase text-[#FFF19A] tracking-wider flex items-center gap-1.5">
                                      <KeyRound className="w-3.5 h-3.5" />
                                      <span>Código de Viaje (Confirmación)</span>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FFF19A] text-[#101114]">
                                      Solo vos lo ves
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3 pt-0.5">
                                    <div className="px-3.5 py-1.5 rounded-xl bg-[#101114] border-2 border-[#FFF19A] font-mono text-xl font-black tracking-widest text-[#FFF19A] select-all">
                                      {sol.codigoSeguridad || '----'}
                                    </div>
                                    <div className="text-[11px] text-[#9299A5] leading-tight space-y-0.5">
                                      <p className="font-bold text-white">
                                        Verificá este código con tu chofer al subir al vehículo.
                                      </p>
                                      <p className="text-[10px]">
                                        Te asegura que es el viaje indicado antes de iniciar el traslado.
                                      </p>
                                    </div>
                                  </div>

                                  {sol.choferTelefono && (
                                    <a
                                      href={`https://wa.me/${sol.choferTelefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                                        `Hola ${sol.choferNombre || 'Chofer'}! Soy ${sol.nombrePasajero}. Mi código de viaje de UPPA es: ${sol.codigoSeguridad}`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Enviar tu código de viaje al WhatsApp del chofer asignado"
                                      className="mt-1 w-full min-h-[42px] py-2 px-3 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                      <span>Enviar Código ({sol.codigoSeguridad}) a {sol.choferNombre || 'Chofer'}</span>
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 p-2.5 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B] text-[#B7F36B] text-xs flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <div>
                                    <span className="font-black text-white block">
                                      ¡Código {sol.codigoSeguridad} verificado! Es tu viaje indicado.
                                    </span>
                                    <span className="text-[10.5px]">
                                      Viaje habilitado y en curso con {sol.choferNombre || 'tu chofer'}.
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Invitación limpia para solicitar transporte alternativo */
              <div className="p-5 sm:p-6 rounded-3xl bg-[#202329] border-2 border-[#FFF19A]/45 shadow-[5px_5px_0px_rgba(0,0,0,0.65)] space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#FFF19A] text-[#101114] flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Solicitar Transporte Alternativo
                    </h3>
                    <p className="text-xs text-[#9299A5] leading-relaxed">
                      Emití un pedido indicando tu origen, destino y tipo de móvil. Solo los choferes habilitados disponibles recibirán tu solicitud y, al aceptarla, recibirás tu <strong className="text-[#FFF19A]">Código de Viaje</strong> para verificar tu móvil.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReqType('auto');
                      setIsRequestRideOpen(true);
                    }}
                    className="min-h-[48px] px-4 py-2.5 rounded-2xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Car className="w-4 h-4" />
                    <span>Pedir Auto Taxi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReqType('moto');
                      setIsRequestRideOpen(true);
                    }}
                    className="min-h-[48px] px-4 py-2.5 rounded-2xl uppa-cta-green font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bike className="w-4 h-4" />
                    <span>Pedir Moto Taxi</span>
                  </button>
                </div>
              </div>
            )}

            {/* Calificación post-viaje para viajes ya finalizados */}
            {eligibleCompletedRides.length > 0 && (
              <div className="space-y-2.5">
                {eligibleCompletedRides.slice(0, 2).map((ride) => (
                  <div
                    key={ride.id}
                    className="p-3.5 rounded-2xl bg-[#202329] border-2 border-[#B7F36B]/50 flex items-center justify-between gap-3 flex-wrap text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-black text-[#B7F36B] flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 fill-[#FFF19A] text-[#FFF19A]" />
                        <span>Viaje finalizado con {ride.choferNombre || 'tu chofer'}</span>
                      </div>
                      <p className="text-[11px] text-[#9299A5] truncate">
                        {ride.origen} ➔ {ride.destino}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCalificarTarget({
                          driverId: ride.choferId || ride.choferNombre || 'chofer',
                          driverName: ride.choferNombre || 'Prestador UPPA',
                          solicitudId: ride.id,
                        })
                      }
                      className="min-h-[40px] px-3.5 py-2 rounded-xl uppa-cta-yellow font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#101114]" />
                      <span>Calificar Viaje</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Request Ride Modal Dialog */}
      {isRequestRideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#202329] border-2 border-[#FFF19A]/50 rounded-3xl p-5 shadow-[6px_6px_0px_rgba(0,0,0,0.65)] relative text-white space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF19A] text-[#101114] flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-white">Solicitud de Transporte Alternativo</h3>
                    <button
                      type="button"
                      onClick={() => setIsPoliticasOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black text-[#FFF19A] bg-[#101114] border border-[#FFF19A]/50 cursor-pointer"
                      title="Ver Políticas de Uso y Descargo de Responsabilidad"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>Políticas</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9299A5] mt-0.5">
                    Solo visible para choferes disponibles en este momento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestRideOpen(false)}
                title="Cerrar ventana de solicitud de viaje"
                aria-label="Cerrar"
                className="w-10 h-10 rounded-xl bg-[#101114] border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRideRequest} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#B7F36B]" />
                    <span>¿Dónde estás? (Origen)</span>
                  </label>
                  {reqOrigin && (
                    <button
                      type="button"
                      onClick={() => setReqOrigin('')}
                      title="Limpiar campo de ubicación de origen"
                      className="text-[10px] text-[#9299A5] hover:text-[#FFF19A] transition-colors cursor-pointer"
                    >
                      Borrar texto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={reqOrigin}
                  onChange={(e) => setReqOrigin(e.target.value)}
                  placeholder="Escribí el lugar donde te encontrás"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#101114] border-2 border-white/10 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FFF19A]" />
                    <span>¿Hacia dónde vas? (Destino)</span>
                  </label>
                  {reqDestination && (
                    <button
                      type="button"
                      onClick={() => setReqDestination('')}
                      title="Limpiar campo de destino"
                      className="text-[10px] text-[#9299A5] hover:text-[#FFF19A] transition-colors cursor-pointer"
                    >
                      Borrar texto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={reqDestination}
                  onChange={(e) => setReqDestination(e.target.value)}
                  placeholder="Escribí hacia dónde vas"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#101114] border-2 border-white/10 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5 text-[#B7F36B]" />
                  <span>Tu WhatsApp (solo lo verá el chofer que acepte)</span>
                </label>
                <input
                  type="tel"
                  value={reqPhone}
                  onChange={(e) => setReqPhone(e.target.value)}
                  placeholder="Ej: 3489 123456"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#101114] border-2 border-white/10 text-xs text-white font-mono placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">Vehículo Requerido</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqType('moto')}
                    title="Solicitar Moto Taxi"
                    className={`min-h-[44px] rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                      reqType === 'moto'
                        ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                        : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto Taxi (Rápido)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqType('auto')}
                    title="Solicitar Auto Taxi"
                    className={`min-h-[44px] rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                      reqType === 'auto'
                        ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                        : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Auto Taxi</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#101114] border border-white/15 text-[11px] text-[#9299A5] flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#FFF19A] shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-black text-[#FFF19A]">Privacidad & Código de Viaje:</span>
                  <p>
                    Tu GPS y WhatsApp se comparten únicamente con el chofer que acepte, y vos recibirás tu Código de Viaje para confirmar que es el móvil indicado.
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border-2 transition-all ${
                  aceptaPoliticasRide
                    ? 'bg-[#101114] border-[#FFF19A]'
                    : 'bg-[#101114] border-white/10'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptaPoliticasRide}
                    onChange={(e) => setAceptaPoliticasRide(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-white/30 bg-[#202329] cursor-pointer"
                  />
                  <div className="text-xs text-[#9299A5] leading-snug">
                    <span>He leído y acepto la </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPoliticasOpen(true);
                      }}
                      title="Leer Política & Descargo de Responsabilidad"
                      className="font-bold text-[#FFF19A] underline underline-offset-2 cursor-pointer inline-flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 inline" />
                      <span>Política & Descargo</span>
                    </button>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingRide || !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim()}
                title="Emitir pedido de transporte alternativo en vivo"
                className={`w-full min-h-[46px] rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                  !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide
                    ? 'bg-[#101114] text-[#9299A5] border border-white/10 cursor-not-allowed opacity-60'
                    : 'uppa-cta-yellow cursor-pointer'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmittingRide
                    ? 'Emitiendo aviso a choferes disponibles...'
                    : 'Emitir Pedido de Transporte Alternativo'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Calificación a Prestador de Servicios */}
      {calificarTarget && (
        <CalificarChoferModal
          isOpen={!!calificarTarget}
          onClose={() => setCalificarTarget(null)}
          driverId={calificarTarget.driverId}
          driverName={calificarTarget.driverName}
          pasajeroId={currentUserId}
          pasajeroNombre={currentUserName}
          onSuccess={() => {
            markSolicitudAsRated(calificarTarget.solicitudId);
          }}
        />
      )}

      {/* Politicas & Descargo Modal */}
      <PoliticasTransporteModal
        isOpen={isPoliticasOpen}
        onClose={() => setIsPoliticasOpen(false)}
      />
    </div>
  );
};
