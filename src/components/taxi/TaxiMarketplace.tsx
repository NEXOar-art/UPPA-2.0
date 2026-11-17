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
  isSolicitudExpiradaOver3Min,
  getSolicitudExpiradaRemainingSeconds,
  SOLICITUD_TIMEOUT_MS,
  SOLICITUD_ACEPTADA_MAX_VISIBILITY_MS,
  SOLICITUD_EXPIRADA_MAX_VISIBILITY_MS,
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
import { getDistanceKm, UserLocation } from '../../utils/geolocation';
import { calculateDriverSafetyIndex } from '../../utils/driverSafety';
import { playMicroSound } from '../../utils/soundEffects';
import { ActiveRideGlassWidget } from '../common/ActiveRideGlassWidget';
import {
  Car,
  Bike,
  Phone,
  MessageCircle,
  Star,
  Clock,
  MapPin,
  Plus,
  CheckCircle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  KeyRound,
  Sparkles,
  ArrowRight,
  Send,
  Zap,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Timer,
  Trophy,
  ChevronDown,
  ChevronUp,
  Award,
  ExternalLink,
  Info,
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
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);

  // Rol del usuario: ¿Es prestador de servicio habilitado?
  const isPrestadorLogueado = useMemo(() => {
    // Pasajeros y Administradores son exclusivamente roles de usuario o admin, NUNCA prestadores
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

  // Alternative transport request modal
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

  // Consola Interactiva Central
  const [consoleVehicleType, setConsoleVehicleType] = useState<'auto' | 'moto'>('auto');

  const showActionError = (msg: string) => {
    setRideActionError(msg);
    setTimeout(() => setRideActionError(null), 5000);
  };

  // Sincronizar ubicación inicial para recogida
  useEffect(() => {
    if (!reqOrigin && userLocation?.address) {
      setReqOrigin(userLocation.address);
    }
  }, [userLocation]);

  // Live 1-second ticker for 12-minute countdown timer
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to alternative transport requests in real-time
  useEffect(() => {
    const unsub = subscribeToSolicitudesTransporte((list) => {
      setSolicitudes(list);
    });
    return () => unsub();
  }, []);

  // Solicitudes visibles en pantalla (Únicamente solicitudes ACTIVAS y respetando privacidad):
  const visibleSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      if (isSolicitudExpired(sol, nowTimestamp)) {
        return false;
      }
      if (sol.estado === 'pendiente') {
        return true;
      }
      if (sol.estado === 'aceptado' || sol.estado === 'en_camino') {
        if (isSolicitudAceptadaExpired(sol, nowTimestamp)) return false;
        // Privacidad: Si está aceptado, solo el chofer asignado o el pasajero titular lo ven
        const isPassengerOwner =
          sol.pasajeroId === currentUserId || (currentUserName && sol.nombrePasajero === currentUserName);
        const isAssignedDriver = sol.choferId === currentUserId;
        return isPassengerOwner || isAssignedDriver;
      }
      return false;
    });
  }, [solicitudes, nowTimestamp, currentUserId, currentUserName]);

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
      setRideSuccessNotice('¡Pedido de transporte emitido! Temporizador de 12 minutos activo.');
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
        currentUserPhone || '3489690058'
      );

      if (!acceptedSol) {
        showActionError('Esta solicitud ya fue tomada por otro prestador o expiró.');
        return;
      }

      // Pasar automáticamente al prestador a estado OCUPADO y notificar a la comunidad
      if (currentUserId) setDriverDisponibilidad(currentUserId, 'ocupado');
      if (currentUserName) setDriverDisponibilidad(currentUserName, 'ocupado');
      if (currentUserPhone) setDriverDisponibilidad(currentUserPhone, 'ocupado');

      setDisponibilidadMap((prev) => ({
        ...prev,
        [currentUserId]: 'ocupado',
        [currentUserName]: 'ocupado',
        ...(currentUserPhone ? { [currentUserPhone]: 'ocupado' } : {}),
      }));

      // Disparar evento con la solicitud completa para trazar GPS en el mapa automáticamente
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('uppa-driver-accepted-ride', {
            detail: { driverId: currentUserId, driverName: currentUserName, solId, solicitud: acceptedSol },
          })
        );
      }

      playMicroSound('ride_accepted');
      setRideSuccessNotice('¡Aceptaste el viaje! Ubicación del pasajero habilitada en GPS y ruta trazada.');
      setTimeout(() => setRideSuccessNotice(null), 5000);

      if (onLocatePassengerOnMap) {
        onLocatePassengerOnMap(acceptedSol);
      }
    } catch (e: any) {
      showActionError('Error al aceptar viaje: ' + (e.message || ''));
    }
  };

  // Ranking en vivo de los últimos 20 prestadores (publicados por 3 horas)
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

  // Prestador seleccionado para calificar (asociado al viaje completado que tomó el usuario)
  const [calificarTarget, setCalificarTarget] = useState<{
    taxi: TaxiListing;
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

  // Suscripción al ranking de prestadores en vivo (últimas 3 hs)
  useEffect(() => {
    const unsub = subscribeToRankingChoferes((list) => {
      setRankingList(list);
    });
    return () => unsub();
  }, []);

  // Estado de ocupado / desocupado en tiempo real para prestadores de servicio
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

  // Referencia GPS del usuario para cálculo de cercanía
  const refCoords = useMemo(() => {
    return {
      lat: userLocation?.lat ?? -34.1683,
      lng: userLocation?.lng ?? -58.9592,
    };
  }, [userLocation]);

  // Estados para validación de código de seguridad por parte del chofer
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  const [codeSuccesses, setCodeSuccesses] = useState<Record<string, string>>({});
  const [isValidatingCode, setIsValidatingCode] = useState<Record<string, boolean>>({});

  const handleVerifyCode = async (solId: string) => {
    const code = (codeInputs[solId] || '').trim().toUpperCase();
    if (!code) {
      setCodeErrors((prev) => ({
        ...prev,
        [solId]: 'Ingresá el código alfanumérico provisto por el pasajero.',
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
          [solId]: res.error || 'Código de seguridad incorrecto.',
        }));
      } else {
        playMicroSound('payment_done');
        setCodeSuccesses((prev) => ({
          ...prev,
          [solId]: '¡Código validado con éxito! Viaje habilitado en curso.',
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
      if (currentUserId) setDriverDisponibilidad(currentUserId, 'desocupado');
      if (currentUserName) setDriverDisponibilidad(currentUserName, 'desocupado');
      if (currentUserPhone) setDriverDisponibilidad(currentUserPhone, 'desocupado');
      setDisponibilidadMap((prev) => ({
        ...prev,
        [currentUserId]: 'desocupado',
        [currentUserName]: 'desocupado',
        ...(currentUserPhone ? { [currentUserPhone]: 'desocupado' } : {}),
      }));
      setRideSuccessNotice('Viaje anulado. Tu estado volvió a ACTIVO · DESOCUPADO.');
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (err: any) {
      showActionError('Error al anular viaje: ' + (err.message || ''));
    }
  };

  const normalizeVehicleType = (vt?: string): 'auto' | 'moto' => {
    const v = String(vt || '').toLowerCase().trim();
    return v.includes('moto') ? 'moto' : 'auto';
  };

  // Solicitud aceptada activa que pertenece exclusivamente al prestador logueado actual
  const myAcceptedSolicitud = useMemo(() => {
    if (!isPrestadorLogueado) return null;
    return (
      visibleSolicitudes.find(
        (sol) =>
          (sol.estado === 'aceptado' || sol.estado === 'en_camino') &&
          !isSolicitudAceptadaExpired(sol, nowTimestamp) &&
          (sol.choferId === currentUserId ||
            (currentUserName &&
              sol.choferNombre &&
              sol.choferNombre.trim().toLowerCase() === currentUserName.trim().toLowerCase()))
      ) || null
    );
  }, [isPrestadorLogueado, visibleSolicitudes, nowTimestamp, currentUserId, currentUserName]);

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

  // Ficha propia del prestador logueado (para ver sus botones Calificar, Mapa, WhatsApp y GPS Pasajero si aceptó un viaje)
  const myActiveDriverCards = useMemo(() => {
    if (!isPrestadorLogueado) return [];
    return taxis
      .filter((t) => t.endsAt > nowTimestamp && isDriverCardOwnedByMe(t))
      .map((t) => {
        const distKm = getDistanceKm(refCoords.lat, refCoords.lng, t.lat, t.lng);
        const disponibilidad = getTaxiDisponibilidad(t);
        const isDesocupado = disponibilidad === 'desocupado';
        const formattedDistance =
          distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        return {
          ...t,
          distanceKm: distKm,
          formattedDistance,
          isDesocupado,
          isClosest: false,
        };
      });
  }, [isPrestadorLogueado, taxis, nowTimestamp, refCoords, disponibilidadMap, currentUserId, currentUserName, currentUserPhone]);

  const formatRemainingTime = (endsAt: number) => {
    const diff = endsAt - Date.now();
    if (diff <= 0) return '0h 0m (Expirado)';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const getWhatsAppLink = (taxi: TaxiListing) => {
    const vehicleText = normalizeVehicleType(taxi.vehicleType) === 'moto' ? 'Moto Taxi' : 'Auto Taxi';
    const text = encodeURIComponent(
      `Hola ${taxi.driverName}! Te contacto por UPPA (${vehicleText}). ¿Tenés disponibilidad para un viaje?`
    );
    return `https://wa.me/${taxi.whatsapp}?text=${text}`;
  };

  const consoleMatchingTaxis = useMemo(() => {
    const list = taxis
      .filter((t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === consoleVehicleType)
      .map((t) => {
        const distKm = getDistanceKm(refCoords.lat, refCoords.lng, t.lat, t.lng);
        const isDesocupado = getTaxiDisponibilidad(t) === 'desocupado';
        const formattedDistance =
          distKm < 1
            ? `${Math.round(distKm * 1000)} m`
            : `${distKm.toFixed(1)} km`;
        return {
          ...t,
          distanceKm: distKm,
          formattedDistance,
          isDesocupado,
          isClosest: false,
        };
      })
      .sort((a, b) => {
        if (a.isDesocupado && !b.isDesocupado) return -1;
        if (!a.isDesocupado && b.isDesocupado) return 1;
        return a.distanceKm - b.distanceKm;
      });

    const firstDesocupado = list.find((item) => item.isDesocupado);
    if (firstDesocupado) {
      firstDesocupado.isClosest = true;
    }

    return list;
  }, [taxis, consoleVehicleType, nowTimestamp, refCoords, disponibilidadMap]);

  const safeFeaturedIndex =
    consoleMatchingTaxis.length > 0 ? featuredIndex % consoleMatchingTaxis.length : 0;

  // Conductor destacado para la consola interactiva (Solo prestadores REALES del vehículo seleccionado)
  const activeDriverFeatured = useMemo(() => {
    if (consoleMatchingTaxis.length > 0) {
      const match = consoleMatchingTaxis[safeFeaturedIndex] || consoleMatchingTaxis[0];
      const normalizedType = normalizeVehicleType(match.vehicleType);
      const safetyIndex = typeof match.indiceSeguridad === 'number'
        ? match.indiceSeguridad
        : calculateDriverSafetyIndex({
            vehicleType: normalizedType,
            patente: match.patente || match.plate,
            asientos: match.asientos,
            aireAcondicionado: match.aireAcondicionado,
            baul: match.baul,
            aceptaMascotas: match.aceptaMascotas,
            cascoExtra: match.cascoExtra,
            whatsapp: match.whatsapp,
          }).percentage;

      return {
        rawTaxi: match,
        id: match.id,
        userId: match.userId,
        driverName: match.driverName,
        vehicleType: normalizedType,
        vehicleModel: match.vehicleModel || (normalizedType === 'moto' ? 'Moto Taxi Habilitada' : 'Auto Taxi Habilitado'),
        plateNumber: match.patente || match.plate || (match as any).plateNumber || 'No declarada',
        rating: typeof match.rating === 'number' ? match.rating : 0,
        completedRides: match.completedRides || 0,
        whatsapp: match.whatsapp || '',
        avatarUrl: match.avatarUrl,
        zone: match.zone || 'Zárate ↔ Campana',
        endsAt: match.endsAt,
        distanceKm: match.distanceKm,
        formattedDistance: match.formattedDistance,
        isClosest: match.isClosest,
        isDesocupado: match.isDesocupado,
        isReal: true,
        asientos: match.asientos || (normalizedType === 'auto' ? 4 : 1),
        aireAcondicionado: match.aireAcondicionado !== false,
        baul: match.baul !== false,
        aceptaMascotas: Boolean(match.aceptaMascotas),
        cascoExtra: match.cascoExtra !== false,
        safetyIndex,
        disponibilidad: match.isDesocupado ? ('desocupado' as const) : ('ocupado' as const),
      };
    }
    return null;
  }, [consoleMatchingTaxis, safeFeaturedIndex]);

  const doesSolicitudMatchDriver = (
    sol: SolicitudTransporteFirestore,
    driverId?: string,
    driverName?: string
  ) => {
    const cleanDriverName = (driverName || '').trim().toLowerCase();
    const cleanSolChoferName = (sol.choferNombre || '').trim().toLowerCase();
    return Boolean(
      (driverId && sol.choferId && sol.choferId === driverId) ||
        (cleanDriverName && cleanSolChoferName && cleanSolChoferName === cleanDriverName)
    );
  };

  const doesSolicitudBelongToPassenger = (sol: SolicitudTransporteFirestore) => {
    if (currentUserId && currentUserId !== 'usr-anon' && sol.pasajeroId) {
      return sol.pasajeroId === currentUserId;
    }
    const cleanUser = (currentUserName || '').trim().toLowerCase();
    const cleanPass = (sol.nombrePasajero || '').trim().toLowerCase();
    return Boolean(
      (currentUserId && sol.pasajeroId === currentUserId) ||
        (cleanUser && cleanPass && cleanPass === cleanUser)
    );
  };

  const getDriverTripAccess = (
    driverId: string | undefined,
    driverName: string | undefined,
    dispState: 'desocupado' | 'ocupado'
  ) => {
    const activeRide = solicitudes.find(
      (s) =>
        (s.estado === 'aceptado' || s.estado === 'en_camino') &&
        doesSolicitudMatchDriver(s, driverId, driverName)
    );
    const isBusy = dispState === 'ocupado' || Boolean(activeRide);
    const isViewerActivePassenger = Boolean(activeRide && doesSolicitudBelongToPassenger(activeRide));
    const isViewerOwnCard = Boolean(
      (driverId && currentUserId && driverId === currentUserId) ||
        (driverName &&
          currentUserName &&
          driverName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    );

    const eligibleCompletedRide =
      solicitudes
        .filter(
          (s) =>
            s.estado === 'completado' &&
            doesSolicitudMatchDriver(s, driverId, driverName) &&
            doesSolicitudBelongToPassenger(s) &&
            !ratedSolicitudIds.includes(s.id)
        )
        .sort(
          (a, b) =>
            Number(b.fechaAceptado || b.fechaSolicitud || 0) -
            Number(a.fechaAceptado || a.fechaSolicitud || 0)
        )[0] || null;

    const canRate = Boolean(eligibleCompletedRide && !isBusy && !isViewerOwnCard);
    const isWhatsAppLocked = Boolean(isBusy && !isViewerActivePassenger && !isViewerOwnCard);

    return {
      isBusy,
      activeRide,
      isViewerActivePassenger,
      isViewerOwnCard,
      eligibleCompletedRide,
      canRate,
      isWhatsAppLocked,
    };
  };

  const dynamicEtaMin = useMemo(() => {
    if (consoleMatchingTaxis.length > 0) {
      const target = consoleMatchingTaxis[safeFeaturedIndex] || consoleMatchingTaxis[0];
      return Math.max(2, Math.round((target.distanceKm || 1.2) * 2.5));
    }
    return 3;
  }, [consoleMatchingTaxis, safeFeaturedIndex]);

  const chatWhatsAppUrl = useMemo(() => {
    if (!activeDriverFeatured?.whatsapp) {
      return null;
    }
    const clean = activeDriverFeatured.whatsapp.replace(/\D/g, '');
    const phone = clean.startsWith('54') ? clean : `549${clean}`;
    const vehiculoText = consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi';
    const text = encodeURIComponent(
      `Hola ${activeDriverFeatured.driverName}! Te contacto por UPPA (${vehiculoText}). ¿Tenés disponibilidad para realizar un viaje?`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }, [activeDriverFeatured, consoleVehicleType]);

  const autoCount = useMemo(
    () => taxis.filter((t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === 'auto').length,
    [taxis, nowTimestamp]
  );
  const motoCount = useMemo(
    () => taxis.filter((t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === 'moto').length,
    [taxis, nowTimestamp]
  );
  const totalCount = autoCount + motoCount;

  return (
    <div className="w-full h-full flex flex-col bg-[#101114] text-white overflow-hidden font-sans">
      {/* Top Header */}
      <div className="p-3.5 sm:p-5 border-b-2 border-white/10 bg-[#202329] shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A] flex items-center justify-center text-[#FFF19A] shrink-0">
              {consoleVehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
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
                onClick={async () => {
                  const isCurrentlyOcupado = (currentUserId && disponibilidadMap[currentUserId] === 'ocupado') || false;
                  const nextDisp = isCurrentlyOcupado ? 'desocupado' : 'ocupado';
                  if (nextDisp === 'desocupado') {
                    try {
                      await finalizarViajeDeChofer(currentUserId, currentUserName);
                    } catch {}
                    await anunciarVehiculoDesocupado(currentUserId, currentUserName);
                  }
                  if (currentUserId) setDriverDisponibilidad(currentUserId, nextDisp);
                  if (currentUserName) setDriverDisponibilidad(currentUserName, nextDisp);
                  if (currentUserPhone) setDriverDisponibilidad(currentUserPhone, nextDisp);
                  setDisponibilidadMap((prev) => ({
                    ...prev,
                    ...(currentUserId ? { [currentUserId]: nextDisp } : {}),
                    ...(currentUserName ? { [currentUserName]: nextDisp } : {}),
                    ...(currentUserPhone ? { [currentUserPhone]: nextDisp } : {}),
                  }));
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer border-2 ${
                  (currentUserId && disponibilidadMap[currentUserId] === 'ocupado')
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A]'
                    : 'bg-[#B7F36B] text-[#101114] border-[#B7F36B]'
                }`}
                title="Alternar tu disponibilidad como chofer (Ocupado / Desocupado)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#101114]" />
                <span>{(currentUserId && disponibilidadMap[currentUserId] === 'ocupado') ? 'Estado: OCUPADO' : 'Estado: DESOCUPADO'}</span>
              </button>
            )}

            {!isPrestadorLogueado && (
              <button
                type="button"
                onClick={() => onOpenPublishModal('transfer')}
                className="min-h-[42px] px-3.5 py-2 rounded-xl uppa-cta-green font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Enviar solicitud para prestar servicio como Auto Taxi o Moto Taxi"
              >
                <KeyRound className="w-4 h-4" />
                <span>Prestar Servicio</span>
              </button>
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
                  Si aún no enviaste los datos de tu vehículo y comprobante, completá tu solicitud para aparecer en Administración UPPA.
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

        {/* Success / Error Notices */}
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

        {/* Barra de Filtros Desplegable & Icono Ranking */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2.5">
          {/* Icono representativo único para Ranking de Prestadores */}
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

          {/* Resumen de Prestadores Activos (el cambio de Auto / Moto se realiza desde los botones superiores del contenedor) */}
          <div className="flex items-center gap-2 text-[11px] font-black text-[#9299A5] bg-[#101114] border-2 border-white/10 px-3 py-2 rounded-xl">
            <span className="text-white">Autos: <span className="text-[#B7F36B] font-mono">{autoCount}</span></span>
            <span>·</span>
            <span className="text-white">Motos: <span className="text-[#FFF19A] font-mono">{motoCount}</span></span>
          </div>
        </div>

        {/* Lista desplegable de ranking si está abierta */}
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

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
        {/* Lógica de Visibilidad: Solicitudes de Pasajeros */}
        {(() => {
          const myPassengerSolicitudes = visibleSolicitudes.filter(
            (s) => s.pasajeroId === currentUserId || (currentUserName && s.nombrePasajero === currentUserName)
          );

          // 1. SI ES PRESTADOR DE SERVICIO LOGUEADO: Ve las solicitudes de pasajeros para aceptarlas y ubicarlas con GPS
          if (isPrestadorLogueado) {
            const activeSolicitudesCount = visibleSolicitudes.filter((s) => s.estado === 'pendiente' && !isSolicitudExpired(s, nowTimestamp)).length;
            const acceptedSolicitudesCount = visibleSolicitudes.filter((s) => s.estado === 'aceptado' && s.choferId === currentUserId).length;

            return (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/40 space-y-3 shadow-[4px_4px_0px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-black text-white flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${activeSolicitudesCount > 0 ? 'bg-[#B7F36B] animate-pulse' : 'bg-[#9299A5]'}`} />
                    Solicitudes de Pasajeros ({activeSolicitudesCount} pendientes · {acceptedSolicitudesCount} tuyas aceptadas)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPoliticasOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black text-[#FFF19A] bg-[#101114] border border-[#FFF19A]/40 hover:border-[#FFF19A] transition-all cursor-pointer shrink-0"
                    title="Ver Políticas de Uso y Descargo de Responsabilidad"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Políticas & Descargo</span>
                  </button>
                </div>

                {visibleSolicitudes.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5">
                    {visibleSolicitudes.map((sol) => {
                      const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                      const mins = Math.floor(remainingSec / 60);
                      const secs = remainingSec % 60;
                      const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                      const remainingAcceptedSec = getSolicitudAceptadaRemainingSeconds(sol, nowTimestamp);
                      const acceptedMins = Math.floor(remainingAcceptedSec / 60);
                      const isMyAcceptedRide = (sol.estado === 'aceptado' || sol.estado === 'en_camino') && sol.choferId === currentUserId;

                      const gpsTargetParam = sol.origenCoords
                        ? `${sol.origenCoords.lat},${sol.origenCoords.lng}`
                        : encodeURIComponent(sol.origen);

                      return (
                        <div
                          key={sol.id}
                          className={`p-3.5 rounded-2xl border-2 text-xs min-w-[280px] max-w-[320px] shrink-0 space-y-2 ${
                            isMyAcceptedRide
                              ? 'bg-[#101114] border-[#B7F36B]'
                              : 'bg-[#101114] border-[#FFF19A]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 font-black text-white min-w-0">
                              {sol.tipoVehiculoRequerido === 'moto' ? (
                                <Bike className="w-4 h-4 text-[#FFF19A] shrink-0" />
                              ) : (
                                <Car className="w-4 h-4 text-[#B7F36B] shrink-0" />
                              )}
                              <span className="truncate">{sol.nombrePasajero}</span>
                            </div>

                            {sol.estado === 'pendiente' && (
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
                            )}

                            {isMyAcceptedRide && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#B7F36B] text-[#101114] flex items-center gap-1 shrink-0 font-mono"
                                title="Visible por 16 minutos desde la aceptación"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Aceptado · {acceptedMins}m</span>
                              </span>
                            )}
                          </div>

                          {/* Privacidad: antes de aceptar NO se expone ubicación exacta ni WhatsApp del pasajero */}
                          {sol.estado === 'pendiente' ? (
                            <div className="text-[11px] text-[#9299A5] space-y-1">
                              <p className="truncate text-[#FFF19A] font-semibold">🔒 Recogida GPS protegida hasta aceptar</p>
                              <p className="truncate text-white">🏁 Destino: {sol.destino}</p>
                            </div>
                          ) : (
                            <div className="text-[11px] text-white space-y-1">
                              <p className="truncate">📍 Origen: {sol.origen}</p>
                              <p className="truncate text-[#9299A5]">🏁 Destino: {sol.destino}</p>
                            </div>
                          )}

                          {sol.estado === 'pendiente' ? (
                            <button
                              type="button"
                              onClick={() => handleAcceptRide(sol.id)}
                              title="Aceptar viaje y habilitar GPS hacia la ubicación del pasajero"
                              className="w-full min-h-[44px] py-2 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Aceptar Viaje y Ver GPS ({formattedTimer})</span>
                            </button>
                          ) : isMyAcceptedRide ? (
                            <div className="pt-2 border-t border-white/10 space-y-2.5">
                              {/* WhatsApp del Pasajero (exclusivo del chofer que aceptó) */}
                              {(() => {
                                const pPhone = sol.telefonoPasajero || '';
                                const cleanPhone = pPhone.replace(/\D/g, '');
                                const hasPhone = cleanPhone.length >= 6;
                                const fullPhone = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;

                                return (
                                  <div className="p-2.5 rounded-xl bg-[#202329] border border-[#B7F36B]/40 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-[#9299A5]">Pasajero a llevar:</span>
                                      <span className="font-black text-white truncate">{sol.nombrePasajero}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-[#9299A5]">WhatsApp Pasajero:</span>
                                      <span className="font-mono text-[#B7F36B] font-bold">
                                        {hasPhone ? `+${cleanPhone}` : 'No especificado'}
                                      </span>
                                    </div>

                                    {hasPhone ? (
                                      <a
                                        href={`https://wa.me/${fullPhone}?text=${encodeURIComponent(
                                          `Hola ${sol.nombrePasajero}! Soy tu chofer (${sol.choferNombre || 'UPPA'}). Ya acepté tu viaje hacia ${sol.destino}. Por favor pasame por aquí tu código de seguridad de 4 caracteres para iniciar el viaje.`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`Enviar WhatsApp al pasajero +${cleanPhone} para pedir el código de abordaje`}
                                        className="w-full min-h-[40px] py-2 px-2.5 rounded-xl uppa-cta-green font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>WhatsApp: +{cleanPhone} (Pedir Código)</span>
                                      </a>
                                    ) : (
                                      <p className="text-[10px] text-[#FFF19A] leading-tight">
                                        El pasajero te brindará el código de 4 caracteres de su pantalla al abordar.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Trazabilidad GPS Automática hacia el Pasajero */}
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    activarGpsHaciaPasajero(sol.id);
                                    onLocatePassengerOnMap?.({ ...sol, gpsActivadoChofer: true });
                                  }}
                                  className="w-full min-h-[44px] py-2 px-3 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                  title="Ir al mapa UPPA con trayectoria GPS hacia la ubicación del pasajero"
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
                                  className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#202329] hover:border-[#FFF19A] border border-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-[#FFF19A]" />
                                  <span>Abrir Google Maps GPS</span>
                                </a>
                              </div>

                              {/* Validación de Código de Seguridad */}
                              {!sol.codigoValidado ? (
                                <div className="p-2.5 rounded-xl bg-[#202329] border border-[#FFF19A]/40 space-y-2">
                                  <div className="flex items-center justify-between text-[10.5px]">
                                    <span className="text-[#FFF19A] font-black flex items-center gap-1">
                                      <KeyRound className="w-3.5 h-3.5" />
                                      Código del pasajero:
                                    </span>
                                    {typeof sol.intentosFallidosCodigo === 'number' &&
                                      sol.intentosFallidosCodigo > 0 && (
                                        <span className="text-rose-300 font-mono font-bold text-[10px]">
                                          {3 - sol.intentosFallidosCodigo} intentos
                                        </span>
                                      )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
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
                                      className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-[#101114] border border-[#FFF19A]/50 font-mono text-xs font-black text-[#FFF19A] placeholder-[#9299A5] uppercase tracking-wider focus:outline-none focus:border-[#FFF19A]"
                                    />
                                    <button
                                      type="button"
                                      disabled={isValidatingCode[sol.id] || !(codeInputs[sol.id] || '').trim()}
                                      onClick={() => handleVerifyCode(sol.id)}
                                      title="Validar el código secreto entregado por el pasajero"
                                      className="min-h-[38px] px-3 rounded-lg bg-[#B7F36B] hover:bg-[#c5f784] disabled:opacity-40 text-[#101114] font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
                                    >
                                      {isValidatingCode[sol.id] ? '...' : 'Habilitar'}
                                    </button>
                                  </div>

                                  {codeErrors[sol.id] && (
                                    <p className="text-[10.5px] text-rose-300 font-semibold flex items-center gap-1 leading-tight">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                      <span>{codeErrors[sol.id]}</span>
                                    </p>
                                  )}

                                  {codeSuccesses[sol.id] && (
                                    <p className="text-[10.5px] text-[#B7F36B] font-bold flex items-center gap-1 leading-tight">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>{codeSuccesses[sol.id]}</span>
                                    </p>
                                  )}

                                  {confirmingAnularId === sol.id ? (
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleAnularRide(sol.id, 'Código incorrecto o pasajero no abordó')}
                                        title="Confirmar anulación del viaje y volver a estado desocupado"
                                        className="flex-1 min-h-[36px] py-1 px-2 text-[10px] font-black bg-rose-600 text-white rounded-lg cursor-pointer"
                                      >
                                        Confirmar Anulación
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmingAnularId(null)}
                                        title="Cancelar anulación"
                                        className="min-h-[36px] py-1 px-2.5 text-[10px] font-bold bg-[#101114] text-white border border-white/20 rounded-lg cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAnularRide(sol.id, 'Código incorrecto o pasajero no abordó')}
                                      title="Anular el viaje si el código no coincide o el pasajero no aborda"
                                      className="w-full min-h-[36px] py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/15 rounded-lg border border-rose-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5 text-rose-400" />
                                      <span>Anular viaje si el código no coincide</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B] text-[#B7F36B] text-[11px] flex items-center gap-1.5 font-black">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <span>Código verificado · Viaje en curso</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3 px-3 rounded-xl bg-[#101114] border border-white/10 text-center text-xs text-[#9299A5]">
                    No hay solicitudes de pasajeros activas en este momento.
                  </div>
                )}
              </div>
            );
          }

          // 2. SI ES PASAJERO: Solo ve su propia solicitud si tiene una emitida
          if (myPassengerSolicitudes.length > 0) {
            return (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/40 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#FFF19A] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B] animate-pulse" />
                    Tu Solicitud de Viaje en Curso
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

                <div className="space-y-2">
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
                          className={`p-3.5 rounded-2xl border-2 text-xs bg-[#101114] ${
                            sol.estado === 'aceptado'
                              ? 'border-[#B7F36B]'
                              : 'border-[#FFF19A]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                            <span className="font-black text-white flex items-center gap-1.5">
                              {sol.tipoVehiculoRequerido === 'moto' ? <Bike className="w-4 h-4 text-[#FFF19A]" /> : <Car className="w-4 h-4 text-[#B7F36B]" />}
                              <span>{sol.tipoVehiculoRequerido === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}</span>
                            </span>
                            {sol.estado === 'pendiente' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-[#FFF19A] text-[#101114]">
                                Buscando chofer ({formattedTimer})
                              </span>
                            )}
                            {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#B7F36B] text-[#101114]">
                                ✓ Chofer: {sol.choferNombre || 'En camino'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white">📍 Origen: {sol.origen}</p>
                          <p className="text-[11px] text-[#9299A5]">🏁 Destino: {sol.destino}</p>

                        {/* Código de Seguridad Confidencial para el Pasajero */}
                        {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                          <>
                            {!sol.codigoValidado ? (
                              <div className="mt-2.5 p-3 rounded-xl bg-[#202329] border-2 border-[#FFF19A] space-y-2">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="text-[10.5px] font-black uppercase text-[#FFF19A] tracking-wider flex items-center gap-1.5">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>Tu Código Secreto de Abordaje</span>
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
                                      Pasáselo al chofer al subirte al vehículo.
                                    </p>
                                    <p className="text-[10px]">
                                      El chofer debe validarlo para habilitar el viaje.
                                    </p>
                                  </div>
                                </div>

                                {sol.choferTelefono && (
                                  <a
                                    href={`https://wa.me/${sol.choferTelefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                                      `Hola ${sol.choferNombre || 'Chofer'}! Soy ${sol.nombrePasajero}. Mi código de abordaje de UPPA es: ${sol.codigoSeguridad}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Enviar tu código secreto al WhatsApp del chofer asignado"
                                    className="mt-2 w-full min-h-[42px] py-2 px-3 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5"
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
                                  <span className="font-black text-white block">¡Código verificado por el chofer!</span>
                                  <span className="text-[10.5px]">Viaje habilitado y en curso con {sol.choferNombre || 'tu chofer'}.</span>
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
            );
          }

          return null;
        })()}

        {/* Ficha del Prestador Activo + Botón Exclusivo GPS al Pasajero cuando aceptó un viaje */}
        {(() => {
          const renderTaxiCard = (
            taxi: TaxiListing & {
              distanceKm: number;
              formattedDistance: string;
              isDesocupado: boolean;
              isClosest: boolean;
            },
            allowPassengerGps: boolean
          ) => {
            const isMoto = normalizeVehicleType(taxi.vehicleType) === 'moto';
            const rawDisp = getTaxiDisponibilidad(taxi);
            const tripAccess = getDriverTripAccess(taxi.userId || taxi.id, taxi.driverName, rawDisp);
            const isOcupado = tripAccess.isBusy;
            const safetyIndex = typeof taxi.indiceSeguridad === 'number'
              ? taxi.indiceSeguridad
              : calculateDriverSafetyIndex({
                  vehicleType: isMoto ? 'moto' : 'auto',
                  patente: taxi.patente || taxi.plate,
                  asientos: taxi.asientos,
                  aireAcondicionado: taxi.aireAcondicionado,
                  baul: taxi.baul,
                  aceptaMascotas: taxi.aceptaMascotas,
                  cascoExtra: taxi.cascoExtra,
                  whatsapp: taxi.whatsapp,
                }).percentage;

            return (
              <div
                key={taxi.id}
                className={`rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border-2 bg-[#202329] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] ${
                  isOcupado
                    ? 'border-[#FFF19A]/70'
                    : 'border-white/15 hover:border-[#B7F36B]/70'
                }`}
              >
                {/* Left driver info + Imagen real sincronizada con vehículo */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-[#101114] border-2 border-white/15 flex items-center justify-center overflow-hidden p-1">
                      <img
                        src={isMoto ? '/assets/aistudio/moto_vehicle.png' : '/assets/aistudio/auto_vehicle.png'}
                        alt={isMoto ? 'Moto Taxi' : 'Auto Taxi'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {taxi.avatarUrl && (
                      <img
                        src={taxi.avatarUrl}
                        alt={taxi.driverName}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full object-cover border-2 border-[#101114] absolute -top-1.5 -left-1.5"
                      />
                    )}
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-[#202329] ${
                        isOcupado ? 'bg-[#FFF19A]' : 'bg-[#B7F36B]'
                      }`}
                      title={isOcupado ? 'En viaje (Ocupado)' : 'Disponible (Desocupado)'}
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-white">{taxi.driverName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#101114] text-white border border-white/20 font-black uppercase tracking-wide flex items-center gap-1">
                        {isMoto ? <Bike className="w-3 h-3 text-[#FFF19A]" /> : <Car className="w-3 h-3 text-[#B7F36B]" />}
                        <span>{isMoto ? 'Moto Taxi' : 'Auto Taxi'}</span>
                      </span>
                      <div className="flex items-center gap-0.5 text-xs text-[#FFF19A] font-mono font-bold" title="Calificación real (0 si no posee)">
                        <Star className="w-3.5 h-3.5 fill-[#FFF19A] text-[#FFF19A]" />
                        <span>{typeof taxi.rating === 'number' && taxi.rating > 0 ? taxi.rating.toFixed(1) : '0'}</span>
                      </div>

                      {(taxi.patente || taxi.plate) && (
                        <span className="px-2 py-0.5 rounded-md bg-white text-[#101114] font-mono font-black text-[10px] border border-[#9299A5] uppercase tracking-wider">
                          {taxi.patente || taxi.plate}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#101114] border border-[#B7F36B]/40 text-[#B7F36B] font-mono">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{safetyIndex}% seg.</span>
                      </span>

                      <span className="text-[10px] text-[#9299A5] font-semibold">
                        · {taxi.completedRides || 0} viajes
                      </span>

                      {isOcupado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#FFF19A] text-[#101114]">
                          OCUPADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#B7F36B] text-[#101114]">
                          DISPONIBLE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white font-semibold">
                      {taxi.vehicleModel}
                    </p>

                    {/* Ficha Real de Confort y Capacidad del Servicio */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {isMoto ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A]">
                            <span>🪖</span>
                            <span>{taxi.cascoExtra !== false ? 'Casco extra para pasajero' : 'Sin casco extra'}</span>
                          </span>
                          {taxi.baul !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-white/15 text-white">
                              <span>📦</span>
                              <span>Baúl / Portaequipaje</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-white/15 text-white">
                            <span>👥</span>
                            <span>{taxi.asientos || 4} asientos</span>
                          </span>
                          {taxi.aireAcondicionado !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-[#B7F36B]/40 text-[#B7F36B]">
                              <span>❄️</span>
                              <span>Aire Acondicionado</span>
                            </span>
                          )}
                          {taxi.baul !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-white/15 text-white">
                              <span>🧳</span>
                              <span>Baúl</span>
                            </span>
                          )}
                          {taxi.aceptaMascotas && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A]">
                              <span>🐾</span>
                              <span>Mascotas OK</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9299A5]">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md text-[10px] ${
                          taxi.isClosest && taxi.isDesocupado
                            ? 'bg-[#B7F36B] text-[#101114] font-black'
                            : 'bg-[#101114] text-white border border-white/10'
                        }`}
                        title="Distancia aproximada en línea recta según coordenadas GPS"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>a {taxi.formattedDistance}</span>
                        {taxi.isClosest && taxi.isDesocupado && (
                          <span className="ml-0.5 font-black uppercase">
                            (Más cercano)
                          </span>
                        )}
                      </span>

                      <span>·</span>

                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#FFF19A]" />
                        <span className="truncate max-w-[180px] text-white">{taxi.zone}</span>
                      </span>

                      <span>·</span>

                      <span className="flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md text-[10px] bg-[#101114] border border-white/15 text-[#B7F36B]">
                        <Clock className="w-3 h-3" />
                        <span>{formatRemainingTime(taxi.endsAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 flex-wrap">
                  <button
                    type="button"
                    disabled={!tripAccess.canRate}
                    onClick={() => {
                      if (!tripAccess.canRate || !tripAccess.eligibleCompletedRide) return;
                      setCalificarTarget({
                        taxi,
                        solicitudId: tripAccess.eligibleCompletedRide.id,
                      });
                    }}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition-all ${
                      tripAccess.canRate
                        ? 'bg-[#101114] hover:border-[#FFF19A] text-[#FFF19A] border-[#FFF19A]/40 cursor-pointer active:scale-95'
                        : 'bg-[#101114]/60 text-[#9299A5] border-white/10 opacity-45 cursor-not-allowed'
                    }`}
                    title={
                      tripAccess.canRate
                        ? `Calificar tu viaje finalizado con ${taxi.driverName} (1 = Malo, 5 = Muy Bueno)`
                        : isOcupado
                        ? 'No disponible mientras el prestador lleva un pasajero'
                        : 'Solo podés calificar cuando tomes un servicio con este prestador y finalice el viaje'
                    }
                  >
                    <Star className={`w-3.5 h-3.5 ${tripAccess.canRate ? 'fill-[#FFF19A]' : ''}`} />
                    <span>Calificar</span>
                  </button>

                  {onSelectTaxiOnMap && (
                    <button
                      type="button"
                      onClick={() => onSelectTaxiOnMap(taxi)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#101114] hover:border-white text-white border-2 border-white/20 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title={`Ver a ${taxi.driverName} en el mapa y trazar ruta`}
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#FFF19A]" />
                      <span>Mapa</span>
                    </button>
                  )}

                  {tripAccess.isWhatsAppLocked ? (
                    <button
                      type="button"
                      disabled
                      title="Bloqueado mientras el prestador lleva un pasajero. Se habilita al presionar DESOCUPADO."
                      className="flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-xl bg-[#101114]/70 border-2 border-white/10 text-[#9299A5] font-black text-xs flex items-center justify-center gap-1.5 opacity-55 cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#FFF19A]" />
                      <span>En viaje</span>
                    </button>
                  ) : (
                    <a
                      href={getWhatsAppLink(taxi)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Contactar por WhatsApp con ${taxi.driverName}`}
                      className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {/* Botón GPS exclusivo para el prestador que aceptó la solicitud del pasajero */}
                  {allowPassengerGps && myAcceptedSolicitud && (
                    <button
                      type="button"
                      onClick={() => {
                        activarGpsHaciaPasajero(myAcceptedSolicitud.id);
                        onLocatePassengerOnMap?.({ ...myAcceptedSolicitud, gpsActivadoChofer: true });
                      }}
                      className="flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title={`Ir con GPS directamente hasta la ubicación del pasajero ${myAcceptedSolicitud.nombrePasajero} (${myAcceptedSolicitud.origen})`}
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#101114]" />
                      <span>GPS Pasajero</span>
                    </button>
                  )}
                </div>
              </div>
            );
          };

          if (isPrestadorLogueado) {
            return myActiveDriverCards.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B]" />
                    <h3 className="text-sm font-black text-white tracking-wide">
                      Tu Ficha de Prestador Activa
                    </h3>
                  </div>
                  {myAcceptedSolicitud && (
                    <span className="text-[10.5px] font-black text-[#101114] bg-[#FFF19A] px-2.5 py-0.5 rounded-md">
                      GPS Pasajero habilitado
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {myActiveDriverCards.map((taxi) => renderTaxiCard(taxi, true))}
                </div>
              </div>
            ) : null;
          }

          const featuredAccess = activeDriverFeatured
            ? getDriverTripAccess(
                activeDriverFeatured.userId || activeDriverFeatured.id,
                activeDriverFeatured.driverName,
                activeDriverFeatured.disponibilidad
              )
            : null;
          const isFeaturedOcupado = Boolean(featuredAccess?.isBusy);

          return (
            <div className="w-full max-w-[460px] mx-auto rounded-3xl bg-[#202329] border-2 border-white/15 p-3.5 sm:p-4 shadow-[5px_5px_0px_rgba(0,0,0,0.65)] space-y-3">
              {/* Fila de Estado Superior */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[#B7F36B] font-black text-xs sm:text-sm flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeDriverFeatured
                        ? isFeaturedOcupado
                          ? 'bg-[#FFF19A]'
                          : 'bg-[#B7F36B]'
                        : 'bg-[#9299A5]'
                    }`}
                  />
                  <span>
                    {activeDriverFeatured
                      ? `Llegada estimada ~${dynamicEtaMin} min · ${consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}`
                      : `Disponibilidad de ${consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}`}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#101114] border border-white/15 text-[#9299A5]">
                  {consoleVehicleType === 'auto' ? `${autoCount} autos` : `${motoCount} motos`}
                </span>
              </div>

              {/* Botones Superiores para cambiar tipo de vehículo: Auto Taxi vs Moto Taxi */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConsoleVehicleType('auto');
                    setReqType('auto');
                    setFeaturedIndex(0);
                  }}
                  title="Ver fichas de Auto Taxi"
                  className={`min-h-[58px] px-3 py-2 rounded-2xl border-2 flex items-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                    consoleVehicleType === 'auto'
                      ? 'bg-[#101114] border-[#FFF19A] text-white shadow-[0_0_0_1px_#FFF19A]'
                      : 'bg-[#101114]/65 border-white/15 text-[#9299A5] hover:border-white/40 hover:text-white'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-[#202329] border border-white/15 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    <img
                      src="/assets/aistudio/auto_vehicle.png"
                      alt="Auto Taxi"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <div className={`text-xs font-black leading-tight ${consoleVehicleType === 'auto' ? 'text-[#FFF19A]' : 'text-white'}`}>
                      Auto Taxi
                    </div>
                    <div className="text-[10px] font-semibold text-[#9299A5] truncate">
                      {autoCount} {autoCount === 1 ? 'prestador' : 'prestadores'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConsoleVehicleType('moto');
                    setReqType('moto');
                    setFeaturedIndex(0);
                  }}
                  title="Ver fichas de Moto Taxi"
                  className={`min-h-[58px] px-3 py-2 rounded-2xl border-2 flex items-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                    consoleVehicleType === 'moto'
                      ? 'bg-[#101114] border-[#FFF19A] text-white shadow-[0_0_0_1px_#FFF19A]'
                      : 'bg-[#101114]/65 border-white/15 text-[#9299A5] hover:border-white/40 hover:text-white'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-[#202329] border border-white/15 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    <img
                      src="/assets/aistudio/moto_vehicle.png"
                      alt="Moto Taxi"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <div className={`text-xs font-black leading-tight ${consoleVehicleType === 'moto' ? 'text-[#FFF19A]' : 'text-white'}`}>
                      Moto Taxi
                    </div>
                    <div className="text-[10px] font-semibold text-[#9299A5] truncate">
                      {motoCount} {motoCount === 1 ? 'prestador' : 'prestadores'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Contenedor Único: Logo Botón (siguiente ficha del mismo vehículo) + Ficha Completa */}
              <div className="grid grid-cols-12 gap-2.5 items-stretch">
                {/* Lado Izquierdo: Botón Logo del vehículo seleccionado para recorrer las demás fichas */}
                <button
                  type="button"
                  onClick={() => {
                    if (consoleMatchingTaxis.length > 1) {
                      setFeaturedIndex((prev) => (prev + 1) % consoleMatchingTaxis.length);
                    }
                  }}
                  disabled={consoleMatchingTaxis.length <= 1}
                  className={`col-span-5 rounded-2xl bg-[#101114] border-2 p-2.5 flex flex-col items-center justify-between transition-all group text-left ${
                    consoleMatchingTaxis.length > 1
                      ? 'border-[#FFF19A]/40 hover:border-[#FFF19A] cursor-pointer active:scale-[0.98]'
                      : 'border-white/15 cursor-default'
                  }`}
                  title={
                    consoleMatchingTaxis.length > 1
                      ? `Tocar logo para ver el siguiente ${consoleVehicleType === 'auto' ? 'Auto Taxi' : 'Moto Taxi'} (${safeFeaturedIndex + 1} de ${consoleMatchingTaxis.length})`
                      : `${consoleVehicleType === 'auto' ? 'Auto Taxi' : 'Moto Taxi'} activo`
                  }
                >
                  <div className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-wider px-0.5 gap-1">
                    <span className="text-[#FFF19A] font-mono truncate">
                      {consoleVehicleType === 'auto' ? 'AUTO TAXI' : 'MOTO TAXI'}
                    </span>
                    <span className="text-[9px] bg-[#202329] px-1.5 py-0.5 rounded text-white border border-white/10 font-mono shrink-0">
                      {consoleMatchingTaxis.length > 0
                        ? `${safeFeaturedIndex + 1} / ${consoleMatchingTaxis.length}`
                        : '0'}
                    </span>
                  </div>

                  <div className="my-1 flex items-center justify-center h-[160px] w-full">
                    <img
                      src={consoleVehicleType === 'auto' ? '/assets/aistudio/auto_vehicle.png' : '/assets/aistudio/moto_vehicle.png'}
                      alt={consoleVehicleType === 'auto' ? 'Auto Taxi UPPA' : 'Moto Taxi UPPA'}
                      className={`max-h-full object-contain transition-transform duration-300 ${
                        consoleMatchingTaxis.length > 1 ? 'group-hover:scale-105' : ''
                      }`}
                    />
                  </div>

                  <div className="text-[10px] text-[#9299A5] font-bold text-center w-full pt-1.5 border-t border-white/10 leading-tight">
                    {consoleMatchingTaxis.length > 1 ? (
                      <>
                        Tocar logo ➔ <span className="text-[#FFF19A]">Ver siguiente</span>
                      </>
                    ) : consoleMatchingTaxis.length === 1 ? (
                      <span className="text-[#B7F36B]">Único activo</span>
                    ) : (
                      <span>Sin activos</span>
                    )}
                  </div>
                </button>

                {/* Lado Derecho: Ficha Única Completa del Prestador */}
                {activeDriverFeatured ? (
                  <div
                    className={`col-span-7 rounded-2xl bg-[#101114] border-2 p-3 flex flex-col justify-between space-y-2 ${
                      isFeaturedOcupado ? 'border-[#FFF19A]/60' : 'border-[#B7F36B]/45'
                    }`}
                  >
                    {/* Cabecera: Avatar + Nombre + Modelo + Estado */}
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-[#202329] border border-[#B7F36B] overflow-hidden flex items-center justify-center">
                            {activeDriverFeatured.avatarUrl ? (
                              <img
                                src={activeDriverFeatured.avatarUrl}
                                alt={activeDriverFeatured.driverName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-black text-[#B7F36B]">
                                {activeDriverFeatured.driverName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-[#101114] ${
                              isFeaturedOcupado ? 'bg-[#FFF19A]' : 'bg-[#B7F36B]'
                            }`}
                            title={isFeaturedOcupado ? 'En viaje (Ocupado)' : 'Disponible (Desocupado)'}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <h4 className="font-black text-white text-xs sm:text-sm truncate leading-tight">
                              {activeDriverFeatured.driverName}
                            </h4>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                isFeaturedOcupado
                                  ? 'bg-[#FFF19A] text-[#101114]'
                                  : 'bg-[#B7F36B] text-[#101114]'
                              }`}
                            >
                              {isFeaturedOcupado ? 'OCUPADO' : 'DISPONIBLE'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9299A5] truncate mt-0.5">
                            {activeDriverFeatured.vehicleModel}
                          </p>
                        </div>
                      </div>

                      {/* Patente, Calificación y Viajes */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-white text-[#101114] font-mono font-black text-[10px] border border-[#9299A5] tracking-wider uppercase truncate max-w-[110px]">
                          {activeDriverFeatured.plateNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[#FFF19A] font-bold text-xs flex items-center gap-0.5 font-mono"
                            title="Calificación real del prestador (0 si aún no tiene calificaciones)"
                          >
                            <Star className="w-3.5 h-3.5 fill-[#FFF19A] text-[#FFF19A]" />
                            <span>{activeDriverFeatured.rating > 0 ? activeDriverFeatured.rating.toFixed(1) : '0'}</span>
                          </span>
                          <span className="text-[10px] text-[#9299A5] font-semibold">
                            · {activeDriverFeatured.completedRides} viajes
                          </span>
                        </div>
                      </div>

                      {/* Distancia GPS, Zona y Tiempo restante de turno */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            activeDriverFeatured.isClosest && !isFeaturedOcupado
                              ? 'bg-[#B7F36B] text-[#101114] font-black'
                              : 'bg-[#202329] text-white border border-white/10'
                          }`}
                          title="Distancia aproximada en línea recta según coordenadas GPS"
                        >
                          <Navigation className="w-2.5 h-2.5" />
                          <span>a {activeDriverFeatured.formattedDistance}</span>
                          {activeDriverFeatured.isClosest && !isFeaturedOcupado && (
                            <span className="uppercase font-black">(Más cercano)</span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#202329] border border-white/10 text-[#B7F36B]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatRemainingTime(activeDriverFeatured.endsAt)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[10.5px] text-white min-w-0">
                        <MapPin className="w-3 h-3 text-[#FFF19A] shrink-0" />
                        <span className="truncate">{activeDriverFeatured.zone}</span>
                      </div>

                      {/* Confort y Capacidad Real */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {consoleVehicleType === 'moto' ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-[#FFF19A]/35 text-[#FFF19A]">
                              <span>🪖</span>
                              <span>{activeDriverFeatured.cascoExtra ? 'Casco extra' : 'Sin casco extra'}</span>
                            </span>
                            {activeDriverFeatured.baul && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-white/15 text-white">
                                <span>📦</span>
                                <span>Baúl</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-white/15 text-white">
                              <span>👥</span>
                              <span>{activeDriverFeatured.asientos} as.</span>
                            </span>
                            {activeDriverFeatured.aireAcondicionado && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-[#B7F36B]/35 text-[#B7F36B]">
                                <span>❄️</span>
                                <span>Aire</span>
                              </span>
                            )}
                            {activeDriverFeatured.baul && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-white/15 text-white">
                                <span>🧳</span>
                                <span>Baúl</span>
                              </span>
                            )}
                            {activeDriverFeatured.aceptaMascotas && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-[#FFF19A]/35 text-[#FFF19A]">
                                <span>🐾</span>
                                <span>Mascotas</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Barra de Seguridad Verificada */}
                    <div className="pt-1.5 border-t border-white/10 space-y-1">
                      <div className="text-[10px] text-[#9299A5] leading-tight flex items-center justify-between">
                        <span>{activeDriverFeatured.safetyIndex}% seguridad</span>
                        <span className="text-[#B7F36B] font-black">Verificado</span>
                      </div>
                      <div className="w-full bg-[#202329] h-2 rounded-full overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-[#B7F36B] rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(10, activeDriverFeatured.safetyIndex))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-7 rounded-2xl bg-[#101114] border-2 border-white/10 p-3 flex flex-col justify-between space-y-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[#FFF19A]">
                        {consoleVehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                        <h4 className="font-black text-white text-xs leading-tight">
                          Sin {consoleVehicleType === 'moto' ? 'Motos' : 'Autos'} activos
                        </h4>
                      </div>
                      <p className="text-[10.5px] text-[#9299A5] leading-relaxed">
                        No hay prestadores reales de {consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} con turno vigente en este momento.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenPublishModal('transfer')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl uppa-cta-green font-black text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Prestar Servicio</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botones Integrados de Acción de la Ficha: Calificar, Mapa y WhatsApp */}
              {activeDriverFeatured && featuredAccess && (
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!featuredAccess.canRate}
                      onClick={() => {
                        if (!featuredAccess.canRate || !featuredAccess.eligibleCompletedRide) return;
                        setCalificarTarget({
                          taxi: activeDriverFeatured.rawTaxi,
                          solicitudId: featuredAccess.eligibleCompletedRide.id,
                        });
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                        featuredAccess.canRate
                          ? 'bg-[#101114] hover:border-[#FFF19A] text-[#FFF19A] border-[#FFF19A]/45 cursor-pointer active:scale-95'
                          : 'bg-[#101114]/60 text-[#9299A5] border-white/10 opacity-45 cursor-not-allowed'
                      }`}
                      title={
                        featuredAccess.canRate
                          ? `Calificar tu viaje finalizado con ${activeDriverFeatured.driverName} (1 = Malo, 5 = Muy Bueno)`
                          : isFeaturedOcupado
                          ? 'No disponible mientras el prestador lleva un pasajero'
                          : 'Solo podés calificar cuando tomes un servicio con este prestador y finalice el viaje'
                      }
                    >
                      <Star className={`w-3.5 h-3.5 ${featuredAccess.canRate ? 'fill-[#FFF19A]' : ''}`} />
                      <span>Calificar</span>
                    </button>

                    {onSelectTaxiOnMap && (
                      <button
                        type="button"
                        onClick={() => onSelectTaxiOnMap(activeDriverFeatured.rawTaxi)}
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-[#101114] hover:border-white text-white border-2 border-white/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title={`Ver a ${activeDriverFeatured.driverName} en el mapa y trazar ruta`}
                      >
                        <Navigation className="w-3.5 h-3.5 text-[#FFF19A]" />
                        <span>Mapa</span>
                      </button>
                    )}
                  </div>

                  {chatWhatsAppUrl &&
                    (featuredAccess.isWhatsAppLocked ? (
                      <button
                        type="button"
                        disabled
                        title="WhatsApp bloqueado mientras el prestador lleva un pasajero. Se habilita al presionar DESOCUPADO."
                        className="w-full min-h-[46px] p-1.5 rounded-xl bg-[#101114]/70 border-2 border-white/10 flex items-center justify-between opacity-60 cursor-not-allowed"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#202329] border border-white/15 flex items-center justify-center text-[#FFF19A] shrink-0">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] font-black text-[#9299A5] px-2 text-center truncate">
                          {activeDriverFeatured.driverName} en viaje · WhatsApp bloqueado hasta DESOCUPADO
                        </div>
                        <span className="w-4 mr-2 shrink-0" />
                      </button>
                    ) : (
                      <a
                        href={chatWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir WhatsApp con ${activeDriverFeatured.driverName}`}
                        className="w-full min-h-[46px] p-1.5 rounded-xl bg-[#101114] hover:border-[#B7F36B] border-2 border-white/15 flex items-center justify-between transition-all cursor-pointer group active:scale-[0.98]"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#B7F36B] flex items-center justify-center text-[#101114] shrink-0">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-black text-white group-hover:text-[#B7F36B] transition-colors flex items-center gap-1 px-2 text-center truncate">
                          <span className="truncate">
                            Chatear con {activeDriverFeatured.driverName}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#B7F36B] mr-2 shrink-0" />
                      </a>
                    ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Request Ride Modal Dialog */}
      {isRequestRideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#202329] border-2 border-[#FFF19A]/50 rounded-3xl p-5 shadow-[6px_6px_0px_rgba(0,0,0,0.65)] relative text-white space-y-4">
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
                  <p className="text-[11px] text-[#9299A5] mt-0.5">Cuando quedás sin micro o necesitás traslado urgente</p>
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
                  <span className="font-black text-[#FFF19A]">Privacidad & Temporizador de 12 minutos:</span>
                  <p>
                    Tu ubicación GPS exacta se comparte únicamente con el chofer que acepte tu viaje.
                  </p>
                </div>
              </div>

              {/* Aceptación Obligatoria de Política & Descargo */}
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
                    ? 'Emitiendo aviso a los choferes...'
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
          driverId={calificarTarget.taxi.userId || calificarTarget.taxi.id}
          driverName={calificarTarget.taxi.driverName}
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


