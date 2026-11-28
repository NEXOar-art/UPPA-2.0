import React, { useState, useEffect, useMemo } from 'react';
import { TaxiListing, SolicitudTransporteFirestore, CalificacionChoferFirestore } from '../../types';
import {
  subscribeToSolicitudesTransporte,
  crearSolicitudTransporte,
  aceptarSolicitudTransporte,
  isSolicitudExpired,
  getSolicitudRemainingSeconds,
  subscribeToRankingChoferes,
  getCalificacionInfo,
  getDriversDisponibilidadMap,
  subscribeToDriversDisponibilidad,
  setDriverDisponibilidad,
  syncDriverDisponibilidadToFirestore,
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
  MessageCircle,
  Star,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  KeyRound,
  ArrowRight,
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
  Flag,
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
  isPasajeroProfile?: boolean;
  onRequirePasajeroRole?: () => void;
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
  isPasajeroProfile = true,
  onRequirePasajeroRole,
  userLocation,
  onOpenInfo,
}) => {
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);

  // Rol del usuario: ¿Es prestador de servicio habilitado?
  const isPrestadorLogueado = useMemo(() => {
    if (currentUserRole === 'admin' || currentUserRole === 'administrador') {
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

  // Modal de pedido de transporte alternativo (solo para pasajeros)
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

  // Consola Interactiva Central: selector de Auto Taxi vs Moto Taxi
  const [consoleVehicleType, setConsoleVehicleType] = useState<'auto' | 'moto'>('auto');

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

  // Ranking en vivo de prestadores (últimas 3 horas)
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

  const [calificarTarget, setCalificarTarget] = useState<{
    driverId: string;
    driverName: string;
    solicitudId: string;
    origen?: string;
    destino?: string;
  } | null>(null);

  const [ratedSolicitudIds, setRatedSolicitudIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [ratedDriverKeys, setRatedDriverKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`uppa_rated_drivers_${currentUserId || 'anon'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const rawSol = localStorage.getItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`);
      setRatedSolicitudIds(rawSol ? JSON.parse(rawSol) : []);
      const rawDrv = localStorage.getItem(`uppa_rated_drivers_${currentUserId || 'anon'}`);
      setRatedDriverKeys(rawDrv ? JSON.parse(rawDrv) : []);
    } catch {
      setRatedSolicitudIds([]);
      setRatedDriverKeys([]);
    }
  }, [currentUserId]);

  const buildDriverKeys = (driverId?: string | null, driverName?: string | null): string[] => {
    const keys: string[] = [];
    const cleanId = (driverId || '').trim();
    const cleanName = (driverName || '').trim().toLowerCase();
    if (cleanId && cleanId !== 'chofer') keys.push(`id:${cleanId}`);
    if (cleanName && cleanName !== 'prestador uppa') keys.push(`name:${cleanName}`);
    return keys;
  };

  useEffect(() => {
    const handleExternalRated = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{ solicitudId?: string; driverId?: string; driverName?: string }>
      ).detail;
      if (!detail) return;
      if (detail.solicitudId) {
        setRatedSolicitudIds((prev) =>
          prev.includes(detail.solicitudId!) ? prev : [...prev, detail.solicitudId!]
        );
      }
      const dKeys = buildDriverKeys(detail.driverId, detail.driverName);
      if (dKeys.length > 0) {
        setRatedDriverKeys((prev) => {
          const merged = Array.from(new Set([...prev, ...dKeys]));
          return merged.length === prev.length ? prev : merged;
        });
      }
    };
    window.addEventListener('uppa-solicitud-calificada', handleExternalRated);
    return () => window.removeEventListener('uppa-solicitud-calificada', handleExternalRated);
  }, []);

  const isDriverAlreadyRatedByMe = (driverId?: string | null, driverName?: string | null): boolean => {
    const dKeys = buildDriverKeys(driverId, driverName);
    if (dKeys.some((k) => ratedDriverKeys.includes(k))) return true;

    const cleanId = (driverId || '').trim();
    const cleanName = (driverName || '').trim().toLowerCase();
    const myCleanName = (currentUserName || '').trim().toLowerCase();

    return rankingList.some((cal) => {
      const isFromMe =
        (currentUserId && currentUserId !== 'usr-anon' && cal.pasajeroId === currentUserId) ||
        Boolean(myCleanName && cal.pasajeroNombre?.trim().toLowerCase() === myCleanName);
      if (!isFromMe) return false;
      const matchId = Boolean(cleanId && cleanId !== 'chofer' && cal.driverId === cleanId);
      const matchName = Boolean(
        cleanName && cal.driverName?.trim().toLowerCase() === cleanName
      );
      return matchId || matchName;
    });
  };

  const markSolicitudAsRated = (solId: string, driverId?: string | null, driverName?: string | null) => {
    setRatedSolicitudIds((prev) => {
      if (prev.includes(solId)) return prev;
      const next = [...prev, solId];
      try {
        localStorage.setItem(`uppa_rated_solicitudes_${currentUserId || 'anon'}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    const dKeys = buildDriverKeys(driverId, driverName);
    if (dKeys.length > 0) {
      setRatedDriverKeys((prev) => {
        const next = Array.from(new Set([...prev, ...dKeys]));
        try {
          localStorage.setItem(`uppa_rated_drivers_${currentUserId || 'anon'}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    window.dispatchEvent(
      new CustomEvent('uppa-solicitud-calificada', {
        detail: { solicitudId: solId, driverId, driverName },
      })
    );
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
    const cleanDriverName = (taxi.driverName || '').trim().toLowerCase();
    const hasActiveRide = solicitudes.some((s) => {
      if (s.estado !== 'aceptado' && s.estado !== 'en_camino') return false;
      const cleanSolChofer = (s.choferNombre || '').trim().toLowerCase();
      return Boolean(
        (s.choferId && (s.choferId === taxi.userId || s.choferId === taxi.id)) ||
          (cleanDriverName && cleanSolChofer && cleanSolChofer === cleanDriverName)
      );
    });
    if (hasActiveRide) return 'ocupado';

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

  const normalizeVehicleType = (vt?: string): 'auto' | 'moto' => {
    const v = String(vt || '').toLowerCase().trim();
    return v.includes('moto') ? 'moto' : 'auto';
  };

  const refCoords = useMemo(() => {
    return {
      lat: userLocation?.lat ?? -34.1683,
      lng: userLocation?.lng ?? -58.9592,
    };
  }, [userLocation]);

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

  const myActiveDriverCards = useMemo(() => {
    if (!isPrestadorLogueado) return [];
    return taxis
      .filter((t) => t.endsAt > nowTimestamp && isDriverCardOwnedByMe(t))
      .map((t) => {
        const distKm = getDistanceKm(refCoords.lat, refCoords.lng, t.lat, t.lng);
        const isDesocupado = getTaxiDisponibilidad(t) === 'desocupado';
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
  }, [
    isPrestadorLogueado,
    taxis,
    nowTimestamp,
    refCoords,
    disponibilidadMap,
    currentUserId,
    currentUserName,
    currentUserPhone,
  ]);

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
      if (
        sol.estado === 'cancelado' ||
        sol.estado === 'expirada' ||
        sol.estado === 'anulado' ||
        sol.estado === 'completado'
      ) {
        return false;
      }
      if (sol.estado === 'pendiente') {
        return !isSolicitudExpired(sol, nowTimestamp);
      }
      if (sol.estado === 'aceptado' || sol.estado === 'en_camino') {
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
      ...myActiveDriverCards.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
    ].filter(Boolean) as string[];

    for (const k of keys) {
      if (disponibilidadMap[k] === 'ocupado') return true;
    }
    return myActiveDriverCards.some((t) => !t.isDesocupado);
  }, [
    isPrestadorLogueado,
    myAcceptedSolicitud,
    currentUserId,
    currentUserName,
    currentUserPhone,
    myActiveDriverCards,
    disponibilidadMap,
  ]);

  // Solicitudes pendientes: SOLO visibles para choferes habilitados disponibles (DESOCUPADO)
  const driverPendingSolicitudes = useMemo(() => {
    if (!isPrestadorLogueado || isLoggedDriverOcupado) return [];
    return visibleSolicitudes.filter((sol) => sol.estado === 'pendiente');
  }, [isPrestadorLogueado, isLoggedDriverOcupado, visibleSolicitudes]);

  // Solicitudes propias del pasajero
  const myPassengerSolicitudes = useMemo(() => {
    return visibleSolicitudes.filter((sol) => doesSolicitudBelongToMeAsPassenger(sol));
  }, [visibleSolicitudes, currentUserId, currentUserName]);

  // Viajes completados elegibles para calificar (del pasajero, últimas 3 horas, uno por cada viaje finalizado)
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

  // Prestadores activos del tipo de vehículo seleccionado en la Consola Interactiva
  const consoleMatchingTaxis = useMemo(() => {
    const list = taxis
      .filter((t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === consoleVehicleType)
      .map((t) => {
        const distKm = getDistanceKm(refCoords.lat, refCoords.lng, t.lat, t.lng);
        const isDesocupado = getTaxiDisponibilidad(t) === 'desocupado';
        const formattedDistance =
          distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
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
  }, [taxis, consoleVehicleType, nowTimestamp, refCoords, disponibilidadMap, solicitudes]);

  const safeFeaturedIndex =
    consoleMatchingTaxis.length > 0 ? featuredIndex % consoleMatchingTaxis.length : 0;

  // Ficha destacada del prestador en la Consola Interactiva (Auto Taxi / Moto Taxi)
  const activeDriverFeatured = useMemo(() => {
    if (consoleMatchingTaxis.length > 0) {
      const match = consoleMatchingTaxis[safeFeaturedIndex] || consoleMatchingTaxis[0];
      const normalizedType = normalizeVehicleType(match.vehicleType);
      const safetyIndex =
        typeof match.indiceSeguridad === 'number'
          ? match.indiceSeguridad
          : calculateDriverSafetyIndex({
              vehicleType: normalizedType,
              patente: match.patente || match.plate,
              empresaAseguradora: match.empresaAseguradora,
              numeroPoliza: match.numeroPoliza,
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
        vehicleModel:
          match.vehicleModel || (normalizedType === 'moto' ? 'Moto Taxi Habilitada' : 'Auto Taxi Habilitado'),
        plateNumber: match.patente || match.plate || (match as any).plateNumber || 'No declarada',
        empresaAseguradora: match.empresaAseguradora || '',
        numeroPoliza: match.numeroPoliza || '',
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
    const isViewerActivePassenger = Boolean(activeRide && doesSolicitudBelongToMeAsPassenger(activeRide));
    const isViewerOwnCard = Boolean(
      (driverId && currentUserId && driverId === currentUserId) ||
        (driverName &&
          currentUserName &&
          driverName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    );

    const cutoff = nowTimestamp - RANKING_WINDOW_MS;
    const eligibleCompletedRide =
      solicitudes
        .filter((s) => {
          if (s.estado !== 'completado') return false;
          if (!doesSolicitudMatchDriver(s, driverId, driverName)) return false;
          if (!doesSolicitudBelongToMeAsPassenger(s)) return false;
          if (ratedSolicitudIds.includes(s.id)) return false;
          const ts = Number(s.fechaCompletado || s.fechaAceptado || s.fechaSolicitud || 0);
          return !ts || ts >= cutoff;
        })
        .sort(
          (a, b) =>
            Number(b.fechaCompletado || b.fechaAceptado || b.fechaSolicitud || 0) -
            Number(a.fechaCompletado || a.fechaAceptado || a.fechaSolicitud || 0)
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

  const autoTaxisStats = useMemo(() => {
    const active = taxis.filter(
      (t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === 'auto'
    );
    const available = active.filter((t) => getTaxiDisponibilidad(t) === 'desocupado').length;
    return { total: active.length, available, busy: active.length - available };
  }, [taxis, nowTimestamp, disponibilidadMap, solicitudes]);

  const motoTaxisStats = useMemo(() => {
    const active = taxis.filter(
      (t) => t.endsAt > nowTimestamp && normalizeVehicleType(t.vehicleType) === 'moto'
    );
    const available = active.filter((t) => getTaxiDisponibilidad(t) === 'desocupado').length;
    return { total: active.length, available, busy: active.length - available };
  }, [taxis, nowTimestamp, disponibilidadMap, solicitudes]);

  const autoCount = autoTaxisStats.total;
  const motoCount = motoTaxisStats.total;

  const handleToggleMyDisponibilidad = async (
    forceNext?: 'desocupado' | 'ocupado',
    targetSolicitudId?: string
  ) => {
    const nextDisp: 'desocupado' | 'ocupado' =
      forceNext || (isLoggedDriverOcupado ? 'desocupado' : 'ocupado');

    if (
      nextDisp === 'desocupado' &&
      !forceNext &&
      myAcceptedSolicitud &&
      !myAcceptedSolicitud.codigoValidado
    ) {
      showActionError(
        'Primero ingresá y validá el código del pasajero antes de finalizar y pasar a disponible (o anulá el viaje si no coincide).'
      );
      return;
    }

    const driverVehicleType: 'auto' | 'moto' =
      myActiveDriverCards[0]?.vehicleType === 'moto' || currentUserRole === 'chofer_moto'
        ? 'moto'
        : 'auto';

    if (nextDisp === 'desocupado') {
      try {
        await finalizarViajeDeChofer(
          currentUserId,
          currentUserName,
          targetSolicitudId || myAcceptedSolicitud?.id
        );
      } catch {}
      await anunciarVehiculoDesocupado(currentUserId, currentUserName, driverVehicleType);
    }

    const keys = [
      currentUserId,
      currentUserName,
      currentUserName?.toLowerCase()?.trim(),
      currentUserPhone,
      ...myActiveDriverCards.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
    ].filter(Boolean) as string[];

    keys.forEach((k) => setDriverDisponibilidad(k, nextDisp));
    syncDriverDisponibilidadToFirestore(keys, nextDisp).catch(() => {});
    setDisponibilidadMap((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = nextDisp;
      });
      return next;
    });

    setRideSuccessNotice(
      nextDisp === 'desocupado'
        ? 'Estado cambiado a DISPONIBLE (sincronizado con Mapa). Ya podés ver las solicitudes de pasajeros.'
        : 'Estado cambiado a OCUPADO (sincronizado con Mapa). No recibirás nuevas solicitudes hasta pasar a DISPONIBLE.'
    );
    setTimeout(() => setRideSuccessNotice(null), 5000);
  };

  const handleCreateRideRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasajeroProfile) {
      showActionError(
        'Para pedir transporte alternativo tu perfil debe estar en "Pasajero". Cambiá tu rol desde tu perfil.'
      );
      onRequirePasajeroRole?.();
      return;
    }
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
        ...myActiveDriverCards.flatMap((t) => [t.id, t.userId, t.driverName, t.whatsapp]),
      ].filter(Boolean) as string[];

      keys.forEach((k) => setDriverDisponibilidad(k, 'ocupado'));
      syncDriverDisponibilidadToFirestore(keys, 'ocupado').catch(() => {});
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
        '¡Viaje aceptado! Pedile el código de viaje al pasajero e ingresalo para habilitar "Ir a buscar al pasajero" y finalizar el viaje.'
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
      setRideSuccessNotice('Viaje anulado. Tu estado volvió a DISPONIBLE.');
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (err: any) {
      showActionError('Error al anular viaje: ' + (err.message || ''));
    }
  };

  // Ficha propia del prestador activo
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
    const safetyIndex =
      typeof taxi.indiceSeguridad === 'number'
        ? taxi.indiceSeguridad
        : calculateDriverSafetyIndex({
            vehicleType: isMoto ? 'moto' : 'auto',
            patente: taxi.patente || taxi.plate,
            empresaAseguradora: taxi.empresaAseguradora,
            numeroPoliza: taxi.numeroPoliza,
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
          isOcupado ? 'border-[#FFF19A]/70' : 'border-white/15 hover:border-[#B7F36B]/70'
        }`}
      >
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
              title={isOcupado ? 'En viaje (Ocupado)' : 'Disponible'}
            />
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white">{taxi.driverName}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#101114] text-white border border-white/20 font-black uppercase tracking-wide flex items-center gap-1">
                {isMoto ? <Bike className="w-3 h-3 text-[#FFF19A]" /> : <Car className="w-3 h-3 text-[#B7F36B]" />}
                <span>{isMoto ? 'Moto Taxi' : 'Auto Taxi'}</span>
              </span>
              <div
                className="flex items-center gap-0.5 text-xs text-[#FFF19A] font-mono font-bold"
                title="Calificación real (0 si no posee)"
              >
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

              <span className="text-[10px] text-[#9299A5] font-semibold">· {taxi.completedRides || 0} viajes</span>

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

            <p className="text-xs text-white font-semibold">{taxi.vehicleModel}</p>

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
              {(taxi.empresaAseguradora || taxi.numeroPoliza) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#101114] border border-[#B7F36B]/40 text-[#B7F36B]">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>
                    {taxi.empresaAseguradora || 'Seguro'}
                    {taxi.numeroPoliza ? ` · Pól. ${taxi.numeroPoliza}` : ''}
                  </span>
                </span>
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
                  <span className="ml-0.5 font-black uppercase">(Más cercano)</span>
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

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 flex-wrap">
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
              title="Bloqueado mientras el prestador lleva un pasajero. Se habilita al pasar a DISPONIBLE."
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

          {allowPassengerGps && myAcceptedSolicitud && Boolean(myAcceptedSolicitud.codigoValidado) && (
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
              <span>Ir a buscar al pasajero</span>
            </button>
          )}
        </div>
      </div>
    );
  };

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
                disabled={Boolean(myAcceptedSolicitud && !myAcceptedSolicitud.codigoValidado)}
                onClick={() => handleToggleMyDisponibilidad()}
                className={`min-h-[42px] px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all border-2 ${
                  myAcceptedSolicitud && !myAcceptedSolicitud.codigoValidado
                    ? 'bg-[#FFF19A]/70 text-[#101114] border-[#FFF19A]/70 cursor-not-allowed opacity-85'
                    : isLoggedDriverOcupado
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A] cursor-pointer'
                    : 'bg-[#B7F36B] text-[#101114] border-[#B7F36B] cursor-pointer'
                }`}
                title={
                  myAcceptedSolicitud && !myAcceptedSolicitud.codigoValidado
                    ? 'Validá el código del pasajero antes de pasar a disponible'
                    : 'Alternar tu disponibilidad como chofer (Ocupado / Disponible)'
                }
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#101114]" />
                <span>
                  {myAcceptedSolicitud && !myAcceptedSolicitud.codigoValidado
                    ? 'Estado: OCUPADO (Validar código)'
                    : isLoggedDriverOcupado
                    ? 'Estado: OCUPADO'
                    : 'Estado: DISPONIBLE'}
                </span>
              </button>
            )}

            {!isPrestadorLogueado && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!isPasajeroProfile) {
                      showActionError(
                        'Para pedir transporte alternativo tu perfil debe estar en "Pasajero". Cambiá tu rol en tu perfil.'
                      );
                      onRequirePasajeroRole?.();
                      return;
                    }
                    setIsRequestRideOpen(true);
                  }}
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

        {/* Barra de Ranking y resumen de móviles */}
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
                  isRankingDropdownOpen ? 'bg-[#101114] text-[#FFF19A]' : 'bg-[#202329] text-white'
                }`}
              >
                {rankingList.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 text-[11px] font-black text-[#9299A5] bg-[#101114] border-2 border-white/10 px-3 py-2 rounded-xl">
            <span className="text-white">
              Autos: <span className="text-[#B7F36B] font-mono">{autoCount}</span>
            </span>
            <span>·</span>
            <span className="text-white">
              Motos: <span className="text-[#FFF19A] font-mono">{motoCount}</span>
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
                        <span className="font-bold text-white truncate text-xs">{item.driverName}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border flex items-center gap-1 shrink-0 ${info.badgeClass}`}
                      >
                        <span>
                          {item.puntuacion} - {info.label}
                        </span>
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
        {/* ============================================================================
            1. SECCIÓN DE SOLICITUDES DE PASAJEROS
               - Si es PRESTADOR: Ve solicitudes con Destino (solo si está DESOCUPADO) + su viaje aceptado con WhatsApp & GPS. Nunca ve "Solicitar Transporte Alternativo".
               - Si es PASAJERO: Ve su propia solicitud en curso con su Código de Viaje y estado.
           ============================================================================ */}
        {isPrestadorLogueado ? (
          <div className="space-y-3">
            {/* Ficha del viaje aceptado por este prestador */}
            {myAcceptedSolicitud &&
              (() => {
                const sol = myAcceptedSolicitud;
                const rawStart = sol.fechaAceptado || sol.fechaSolicitud;
                const startMs =
                  typeof rawStart === 'number'
                    ? rawStart
                    : typeof (rawStart as { seconds?: number })?.seconds === 'number'
                    ? (rawStart as { seconds: number }).seconds * 1000
                    : nowTimestamp;
                const elapsedSec = Math.max(0, Math.floor((nowTimestamp - startMs) / 1000));
                const elapsedMins = Math.floor(elapsedSec / 60);
                const elapsedSecs = elapsedSec % 60;
                const pPhone = sol.telefonoPasajero || '';
                const cleanPhone = pPhone.replace(/\D/g, '');
                const hasPhone = cleanPhone.length >= 6;
                const fullPhone = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
                const gpsTargetParam = sol.origenCoords
                  ? `${sol.origenCoords.lat},${sol.origenCoords.lng}`
                  : encodeURIComponent(sol.origen);

                return (
                  <div className="p-4 rounded-3xl bg-[#202329] border-2 border-[#B7F36B] shadow-[5px_5px_0px_rgba(0,0,0,0.65)] space-y-3.5 animate-in fade-in">
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
                        title="Tiempo en curso del viaje activo"
                      >
                        ⏱ En curso · {elapsedMins}:{elapsedSecs.toString().padStart(2, '0')}
                      </span>
                    </div>

                    {/* Animación inteligente en vivo del transcurso del viaje para el Prestador */}
                    <ActiveRideGlassWidget
                      solicitud={sol}
                      matchedDriver={myActiveDriverCards[0] || null}
                      userLocation={userLocation}
                      isDriverViewer={true}
                      nowTimestamp={nowTimestamp}
                      onLocateOnMap={
                        sol.codigoValidado
                          ? () => {
                              activarGpsHaciaPasajero(sol.id);
                              onLocatePassengerOnMap?.({ ...sol, gpsActivadoChofer: true });
                            }
                          : undefined
                      }
                    />

                    {/* Origen y Destino */}
                    <div className="p-3 rounded-2xl bg-[#101114] border border-white/15 space-y-1.5 text-xs">
                      <div className="flex items-start gap-2 text-white">
                        <MapPin className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#9299A5] block">
                            Origen (Recogida GPS)
                          </span>
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

                        <p className="text-[11px] text-[#9299A5] leading-snug">
                          Ingresá y validá el código que te envió el pasajero para habilitar{' '}
                          <strong className="text-[#FFF19A]">Ir a buscar al pasajero</strong> y{' '}
                          <strong className="text-[#B7F36B]">Finalizar y pasar a disponible</strong>.
                        </p>

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
                            className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#202329] border border-[#FFF19A]/50 font-mono text-sm font-black text-[#FFF19A] placeholder-[#9299A5] uppercase tracking-widest focus:outline-none focus:border-[#FFF19A]"
                          />
                          <button
                            type="button"
                            disabled={isValidatingCode[sol.id] || !(codeInputs[sol.id] || '').trim()}
                            onClick={() => handleVerifyCode(sol.id)}
                            title="Validar el código de viaje entregado por el pasajero"
                            className="min-h-[40px] px-4 rounded-xl bg-[#B7F36B] hover:bg-[#c5f784] disabled:opacity-40 text-[#101114] font-black text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
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
                              title="Confirmar anulación del viaje y volver a estado disponible"
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
                      <>
                        <div className="p-3 rounded-2xl bg-[#B7F36B]/15 border border-[#B7F36B] text-[#B7F36B] text-xs flex items-center gap-2 font-black">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Código verificado · Viaje habilitado en curso</span>
                        </div>

                        {/* Botón GPS: Ir a buscar al pasajero (solo visible tras validar código) */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              activarGpsHaciaPasajero(sol.id);
                              onLocatePassengerOnMap?.({ ...sol, gpsActivadoChofer: true });
                            }}
                            className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl uppa-cta-yellow font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                            title="Activar GPS y enviar al mapa directo hacia la ubicación del pasajero"
                          >
                            <Navigation className="w-4 h-4" />
                            <span>📍 Ir a buscar al pasajero</span>
                          </button>

                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${gpsTargetParam}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => activarGpsHaciaPasajero(sol.id)}
                            title="Abrir navegación giro a giro en Google Maps hasta el pasajero"
                            className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#101114] hover:border-[#FFF19A] border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[#FFF19A]" />
                            <span>Abrir Google Maps GPS</span>
                          </a>
                        </div>

                        {/* Botón maestro de cierre de viaje (solo visible tras validar código) */}
                        <div className="pt-1 border-t border-white/10 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleMyDisponibilidad('desocupado', sol.id)}
                            className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl uppa-cta-green font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                            title="Finalizar este viaje y volver a estar disponible para recibir nuevas solicitudes"
                          >
                            <Flag className="w-4 h-4 shrink-0" />
                            <span>FINALIZAR Y PASAR A DISPONIBLE</span>
                          </button>
                          <p className="text-[10.5px] text-center text-[#9299A5] leading-snug">
                            El seguimiento animado permanece activo para vos y el pasajero hasta que presiones este botón.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

            {/* Solicitudes pendientes de pasajeros (SOLO visibles si el chofer está DESOCUPADO) */}
            {!isLoggedDriverOcupado ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/40 space-y-3 shadow-[4px_4px_0px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-black text-white flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        driverPendingSolicitudes.length > 0 ? 'bg-[#B7F36B] animate-pulse' : 'bg-[#9299A5]'
                      }`}
                    />
                    Solicitudes de Pasajeros ({driverPendingSolicitudes.length} pendientes)
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#B7F36B]/20 border border-[#B7F36B]/50 text-[#B7F36B]">
                    Disponible
                  </span>
                </div>

                {driverPendingSolicitudes.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5">
                    {driverPendingSolicitudes.map((sol) => {
                      const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                      const mins = Math.floor(remainingSec / 60);
                      const secs = remainingSec % 60;
                      const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                      return (
                        <div
                          key={sol.id}
                          className="p-3.5 rounded-2xl border-2 border-[#FFF19A]/50 bg-[#101114] text-xs min-w-[275px] max-w-[320px] shrink-0 space-y-2.5 flex flex-col justify-between"
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

                            <div className="text-[11px] space-y-1">
                              <p className="truncate text-[#FFF19A] font-semibold">
                                🔒 Recogida GPS y WhatsApp visibles al aceptar
                              </p>
                              <p className="text-white font-bold">🏁 Destino: {sol.destino}</p>
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
                  <div className="py-3 px-3 rounded-xl bg-[#101114] border border-white/10 text-center text-xs text-[#9299A5]">
                    No hay solicitudes de pasajeros pendientes en este momento.
                  </div>
                )}
              </div>
            ) : !myAcceptedSolicitud ? (
              <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/45 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="space-y-0.5">
                  <div className="font-black text-[#FFF19A]">Estás en estado OCUPADO</div>
                  <p className="text-[11px] text-[#9299A5]">
                    Solo los choferes en estado <strong className="text-[#B7F36B]">DISPONIBLE</strong> reciben solicitudes de pasajeros.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleMyDisponibilidad('desocupado')}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl uppa-cta-green font-black text-xs shrink-0 cursor-pointer"
                >
                  Pasar a DISPONIBLE
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* Vista para el Pasajero: su propia solicitud activa (con Código de Viaje) */}
            {myPassengerSolicitudes.length > 0 && (
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
                          nowTimestamp={nowTimestamp}
                          onLocateOnMap={
                            matchedDriverObj && onSelectTaxiOnMap
                              ? () => onSelectTaxiOnMap(matchedDriverObj)
                              : undefined
                          }
                        />

                        <div
                          className={`p-3.5 rounded-2xl border-2 text-xs bg-[#101114] ${
                            sol.estado === 'aceptado' || sol.estado === 'en_camino'
                              ? 'border-[#B7F36B]'
                              : 'border-[#FFF19A]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
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

                          {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                            <>
                              {!sol.codigoValidado ? (
                                <div className="mt-2.5 p-3 rounded-xl bg-[#202329] border-2 border-[#FFF19A] space-y-2">
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
                                        Pasáselo al chofer al subirte al vehículo.
                                      </p>
                                      <p className="text-[10px]">
                                        Te confirma que es el viaje indicado antes de iniciar el traslado.
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
                                      className="mt-2 w-full min-h-[42px] py-2 px-3 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                      <span>
                                        Enviar Código ({sol.codigoSeguridad}) a {sol.choferNombre || 'Chofer'}
                                      </span>
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
            )}

            {/* Acceso rápido para calificar viajes finalizados */}
            {eligibleCompletedRides.length > 0 && (
              <div className="space-y-2">
                {eligibleCompletedRides.slice(0, 1).map((ride) => (
                  <div
                    key={ride.id}
                    className="p-3 rounded-2xl bg-[#202329] border-2 border-[#B7F36B]/50 flex items-center justify-between gap-2.5 flex-wrap text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-black text-[#B7F36B] block">
                        Viaje finalizado con {ride.choferNombre || 'tu chofer'}
                      </span>
                      <span className="text-[11px] text-[#9299A5] truncate block">{ride.destino}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCalificarTarget({
                          driverId: ride.choferId || ride.choferNombre || 'chofer',
                          driverName: ride.choferNombre || 'Prestador UPPA',
                          solicitudId: ride.id,
                          origen: ride.origen,
                          destino: ride.destino,
                        })
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-xl uppa-cta-yellow uppa-calificar-destello font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Star className="w-3.5 h-3.5 fill-[#101114]" />
                      <span>Calificar Viaje</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ============================================================================
            2. CONSOLA INTERACTIVA DE TAXIS & MOTOS (RESTAURADA CON LOGO AUTO/MOTO Y FICHA COMPLETA)
               - Si es PRESTADOR: ve "Tu Ficha de Prestador Activa" si está en turno (sin cartel de solicitar).
               - Si es PASAJERO/ADMIN: ve la Consola Interactiva con botones Auto Taxi / Moto Taxi,
                 logo interactivo para recorrer fichas y toda la información del móvil.
           ============================================================================ */}
        {(() => {
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
                <div className="space-y-3">{myActiveDriverCards.map((taxi) => renderTaxiCard(taxi, true))}</div>
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

          const consoleStats = consoleVehicleType === 'auto' ? autoTaxisStats : motoTaxisStats;

          return (
            <div className="w-full max-w-[460px] mx-auto rounded-3xl bg-[#202329] border-2 border-white/15 p-3.5 sm:p-4 shadow-[5px_5px_0px_rgba(0,0,0,0.65)] space-y-3">
              {/* Fila de Estado Superior */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div
                  className={`font-black text-xs sm:text-sm flex items-center gap-2 ${
                    activeDriverFeatured
                      ? isFeaturedOcupado
                        ? 'text-[#FFF19A]'
                        : 'text-[#B7F36B]'
                      : 'text-[#9299A5]'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeDriverFeatured
                        ? isFeaturedOcupado
                          ? 'bg-[#FFF19A] animate-pulse'
                          : 'bg-[#B7F36B]'
                        : 'bg-[#9299A5]'
                    }`}
                  />
                  <span>
                    {activeDriverFeatured
                      ? isFeaturedOcupado
                        ? `OCUPADO (En viaje) · ${
                            consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'
                          }`
                        : `DISPONIBLE · Llegada ~${dynamicEtaMin} min`
                      : `Disponibilidad de ${consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'}`}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#101114] border border-white/15 text-white flex items-center gap-1.5">
                  <span className="text-[#B7F36B]">{consoleStats.available} disp.</span>
                  <span className="text-[#9299A5]">·</span>
                  <span className="text-[#FFF19A]">{consoleStats.busy} ocup.</span>
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
                  title="Ver fichas y disponibilidad de Auto Taxi"
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
                    <div
                      className={`text-xs font-black leading-tight ${
                        consoleVehicleType === 'auto' ? 'text-[#FFF19A]' : 'text-white'
                      }`}
                    >
                      Auto Taxi
                    </div>
                    <div className="text-[10px] font-bold flex items-center gap-1 truncate mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          autoTaxisStats.total === 0
                            ? 'bg-[#9299A5]'
                            : autoTaxisStats.available > 0
                            ? 'bg-[#B7F36B]'
                            : 'bg-[#FFF19A]'
                        }`}
                      />
                      <span
                        className={
                          autoTaxisStats.total === 0
                            ? 'text-[#9299A5]'
                            : autoTaxisStats.available > 0
                            ? 'text-[#B7F36B]'
                            : 'text-[#FFF19A]'
                        }
                      >
                        {autoTaxisStats.total === 0
                          ? '0 activos'
                          : `${autoTaxisStats.available} disp. · ${autoTaxisStats.busy} ocup.`}
                      </span>
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
                  title="Ver fichas y disponibilidad de Moto Taxi"
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
                    <div
                      className={`text-xs font-black leading-tight ${
                        consoleVehicleType === 'moto' ? 'text-[#FFF19A]' : 'text-white'
                      }`}
                    >
                      Moto Taxi
                    </div>
                    <div className="text-[10px] font-bold flex items-center gap-1 truncate mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          motoTaxisStats.total === 0
                            ? 'bg-[#9299A5]'
                            : motoTaxisStats.available > 0
                            ? 'bg-[#B7F36B]'
                            : 'bg-[#FFF19A]'
                        }`}
                      />
                      <span
                        className={
                          motoTaxisStats.total === 0
                            ? 'text-[#9299A5]'
                            : motoTaxisStats.available > 0
                            ? 'text-[#B7F36B]'
                            : 'text-[#FFF19A]'
                        }
                      >
                        {motoTaxisStats.total === 0
                          ? '0 activos'
                          : `${motoTaxisStats.available} disp. · ${motoTaxisStats.busy} ocup.`}
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Barra rápida de disponibilidad de todos los móviles del tipo seleccionado */}
              {consoleMatchingTaxis.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {consoleMatchingTaxis.map((item, idx) => {
                    const itemBusy = !item.isDesocupado;
                    const isSelected = idx === safeFeaturedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFeaturedIndex(idx)}
                        title={`${item.driverName} · ${itemBusy ? 'OCUPADO (En viaje)' : 'DISPONIBLE'}`}
                        className={`px-2.5 py-1.5 rounded-xl border text-[10.5px] font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                          isSelected
                            ? itemBusy
                              ? 'bg-[#FFF19A]/20 border-[#FFF19A] text-white'
                              : 'bg-[#B7F36B]/20 border-[#B7F36B] text-white'
                            : 'bg-[#101114] border-white/15 text-[#9299A5] hover:border-white/35 hover:text-white'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            itemBusy ? 'bg-[#FFF19A]' : 'bg-[#B7F36B]'
                          }`}
                        />
                        <span className="truncate max-w-[92px] text-white">{item.driverName}</span>
                        <span
                          className={`text-[9px] font-black uppercase ${
                            itemBusy ? 'text-[#FFF19A]' : 'text-[#B7F36B]'
                          }`}
                        >
                          {itemBusy ? 'Ocup.' : 'Disp.'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

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
                      ? `Tocar logo para ver el siguiente ${
                          consoleVehicleType === 'auto' ? 'Auto Taxi' : 'Moto Taxi'
                        } (${safeFeaturedIndex + 1} de ${consoleMatchingTaxis.length})`
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

                  <div className="my-1 flex items-center justify-center h-[145px] w-full">
                    <img
                      src={
                        consoleVehicleType === 'auto'
                          ? '/assets/aistudio/auto_vehicle.png'
                          : '/assets/aistudio/moto_vehicle.png'
                      }
                      alt={consoleVehicleType === 'auto' ? 'Auto Taxi UPPA' : 'Moto Taxi UPPA'}
                      className={`max-h-full object-contain transition-transform duration-300 ${
                        consoleMatchingTaxis.length > 1 ? 'group-hover:scale-105' : ''
                      }`}
                    />
                  </div>

                  {activeDriverFeatured && (
                    <div
                      className={`w-full py-1 px-2 rounded-lg text-[9.5px] font-black uppercase text-center mb-1 ${
                        isFeaturedOcupado
                          ? 'bg-[#FFF19A] text-[#101114]'
                          : 'bg-[#B7F36B] text-[#101114]'
                      }`}
                    >
                      {isFeaturedOcupado ? '● Ocupado' : '● Disponible'}
                    </div>
                  )}

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
                      isFeaturedOcupado ? 'border-[#FFF19A]/70' : 'border-[#B7F36B]/55'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div
                        className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wide flex items-center justify-between gap-1 ${
                          isFeaturedOcupado
                            ? 'bg-[#FFF19A]/15 border border-[#FFF19A]/60 text-[#FFF19A]'
                            : 'bg-[#B7F36B]/15 border border-[#B7F36B]/60 text-[#B7F36B]'
                        }`}
                      >
                        <span>
                          {isFeaturedOcupado ? 'Ocupado · En viaje' : 'Disponible ahora'}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isFeaturedOcupado ? 'bg-[#FFF19A] animate-pulse' : 'bg-[#B7F36B]'
                          }`}
                        />
                      </div>

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
                            title={isFeaturedOcupado ? 'En viaje (Ocupado)' : 'Disponible'}
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
                            <span>
                              {activeDriverFeatured.rating > 0 ? activeDriverFeatured.rating.toFixed(1) : '0'}
                            </span>
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

                      {/* Confort y Capacidad */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {consoleVehicleType === 'moto' ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-[#FFF19A]/35 text-[#FFF19A]">
                              <span>🪖</span>
                              <span>
                                {activeDriverFeatured.cascoExtra ? 'Casco extra' : 'Sin casco extra'}
                              </span>
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
                        {(activeDriverFeatured.empresaAseguradora || activeDriverFeatured.numeroPoliza) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#202329] border border-[#B7F36B]/40 text-[#B7F36B]">
                            <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                            <span>
                              {activeDriverFeatured.empresaAseguradora || 'Seguro'}
                              {activeDriverFeatured.numeroPoliza ? ` · ${activeDriverFeatured.numeroPoliza}` : ''}
                            </span>
                          </span>
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
                        {consoleVehicleType === 'moto' ? (
                          <Bike className="w-5 h-5" />
                        ) : (
                          <Car className="w-5 h-5" />
                        )}
                        <h4 className="font-black text-white text-xs leading-tight">
                          Sin {consoleVehicleType === 'moto' ? 'Motos' : 'Autos'} activos
                        </h4>
                      </div>
                      <p className="text-[10.5px] text-[#9299A5] leading-relaxed">
                        No hay prestadores reales de{' '}
                        {consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} con turno vigente en este momento.
                      </p>
                    </div>
                    {!isPrestadorLogueado && (
                      <button
                        type="button"
                        onClick={() => onOpenPublishModal('transfer')}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl uppa-cta-green font-black text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Prestar Servicio</span>
                      </button>
                    )}
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
                          driverId: activeDriverFeatured.userId || activeDriverFeatured.id,
                          driverName: activeDriverFeatured.driverName,
                          solicitudId: featuredAccess.eligibleCompletedRide.id,
                          origen: featuredAccess.eligibleCompletedRide.origen,
                          destino: featuredAccess.eligibleCompletedRide.destino,
                        });
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                        featuredAccess.canRate
                          ? 'uppa-cta-yellow uppa-calificar-destello border-[#101114] text-[#101114] cursor-pointer active:scale-95'
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
                      <Star className={`w-3.5 h-3.5 ${featuredAccess.canRate ? 'fill-[#101114]' : ''}`} />
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
                        title="WhatsApp bloqueado mientras el prestador lleva un pasajero. Se habilita al pasar a DISPONIBLE."
                        className="w-full min-h-[46px] p-1.5 rounded-xl bg-[#101114]/70 border-2 border-white/10 flex items-center justify-between opacity-60 cursor-not-allowed"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#202329] border border-white/15 flex items-center justify-center text-[#FFF19A] shrink-0">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="text-[11px] font-black text-[#9299A5] px-2 text-center truncate">
                          {activeDriverFeatured.driverName} en viaje · WhatsApp bloqueado hasta DISPONIBLE
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
                          <span className="truncate">Chatear con {activeDriverFeatured.driverName}</span>
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

      {/* Request Ride Modal Dialog (solo para pasajeros) */}
      {isRequestRideOpen && !isPrestadorLogueado && (
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
                    Cuando quedás sin micro o necesitás traslado urgente
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
                  <span className="font-black text-[#FFF19A]">Privacidad & Temporizador de 12 minutos:</span>
                  <p>
                    Tu GPS y WhatsApp se comparten únicamente con el chofer que acepte tu viaje, y recibirás tu Código de Viaje para verificar tu móvil.
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border-2 transition-all ${
                  aceptaPoliticasRide ? 'bg-[#101114] border-[#FFF19A]' : 'bg-[#101114] border-white/10'
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
          driverId={calificarTarget.driverId}
          driverName={calificarTarget.driverName}
          pasajeroId={currentUserId}
          pasajeroNombre={currentUserName}
          solicitudId={calificarTarget.solicitudId}
          origen={calificarTarget.origen}
          destino={calificarTarget.destino}
          onSuccess={() => {
            markSolicitudAsRated(
              calificarTarget.solicitudId,
              calificarTarget.driverId,
              calificarTarget.driverName
            );
          }}
        />
      )}

      {/* Politicas & Descargo Modal */}
      <PoliticasTransporteModal isOpen={isPoliticasOpen} onClose={() => setIsPoliticasOpen(false)} />
    </div>
  );
};
