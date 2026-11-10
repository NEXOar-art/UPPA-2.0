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
  RANKING_WINDOW_MS,
} from '../../services/realtimeFirebaseService';
import { getDistanceKm, UserLocation } from '../../utils/geolocation';
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
  ArrowLeftRight,
} from 'lucide-react';
import { PoliticasTransporteModal } from './PoliticasTransporteModal';
import { CalificarChoferModal } from './CalificarChoferModal';

// Comercios y servicios locales destacados de la comunidad (inspirados en el diseño de referencia)
const LOCAL_COMMUNITY_SPONSORS = [
  {
    id: 'sp-1',
    name: 'Malvinas',
    subtitle: 'Promo Viandas',
    webUrl: 'https://wa.me/5493489690058?text=Hola%20Malvinas%20Viandas!%20Quiero%20conocer%20el%20men%C3%BA%20del%20d%C3%ADa.',
    whatsapp: '5493489690058',
  },
  {
    id: 'sp-2',
    name: 'Rotisería Malvinas',
    subtitle: 'Empanadas, pizzas ...',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=80',
    webUrl: 'https://wa.me/5493489690058?text=Hola%20Rotiser%C3%ADa%20Malvinas!%20Quiero%20hacer%20un%20pedido.',
    whatsapp: '5493489690058',
  },
];

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
}) => {
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'auto' | 'moto'>('all');
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);

  // Rol del usuario: ¿Es prestador de servicio habilitado?
  const isPrestadorLogueado = useMemo(() => {
    return Boolean(
      isDriverHabilitado ||
      currentUserRole === 'driver' ||
      currentUserRole === 'chofer' ||
      currentUserRole === 'chofer_auto' ||
      currentUserRole === 'chofer_moto' ||
      (typeof window !== 'undefined' && localStorage.getItem('uppa_active_driver_session'))
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
  const [isPoliticasOpen, setIsPoliticasOpen] = useState(false);

  // Consola Interactiva Central (Inspirada directamente en TAXI_AUTO y TAXI_MOTO)
  const [consoleVehicleType, setConsoleVehicleType] = useState<'auto' | 'moto'>('auto');
  const [showConsoleRequestForm, setShowConsoleRequestForm] = useState(false);

  // Sincronizar ubicación inicial para recogida
  useEffect(() => {
    if (!reqOrigin && userLocation?.address) {
      setReqOrigin(userLocation.address);
    }
  }, [userLocation]);

  // Sincronizar tipo de vehículo al cambiar filtros superiores
  useEffect(() => {
    if (vehicleFilter === 'auto') {
      setConsoleVehicleType('auto');
      setReqType('auto');
    } else if (vehicleFilter === 'moto') {
      setConsoleVehicleType('moto');
      setReqType('moto');
    }
  }, [vehicleFilter]);

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
  // Solicitudes visibles en pantalla (Únicamente solicitudes ACTIVAS):
  // - Solicitudes pendientes: ÚNICAMENTE mientras estén activas (estado === 'pendiente' y NO expiradas dentro de los 12 minutos).
  // - Solicitudes aceptadas: activas en viaje vigente (no expiradas).
  // - Toda solicitud inactiva o expirada NO debe publicarse.
  const visibleSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      // Si la solicitud expiró tras los 12 minutos, no está activa -> NO se publica
      if (isSolicitudExpired(sol, nowTimestamp)) {
        return false;
      }
      // Solicitud pendiente activa en búsqueda de chofer
      if (sol.estado === 'pendiente') {
        return true;
      }
      // Solicitud aceptada o en camino activa con chofer asignado (dentro de los 16 min)
      if (sol.estado === 'aceptado' || sol.estado === 'en_camino') {
        return !isSolicitudAceptadaExpired(sol, nowTimestamp);
      }
      return false;
    });
  }, [solicitudes, nowTimestamp]);


  const handleCreateRideRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide) return;
    if (!aceptaPoliticasRide) {
      alert('Debés aceptar la Política & Descargo para poder emitir el pedido de transporte alternativo.');
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
      });
      setIsRequestRideOpen(false);
      setAceptaPoliticasRide(false);
      setRideSuccessNotice('¡Pedido de transporte emitido! Temporizador de 12 minutos activo para ser aceptado por los choferes.');
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (e: any) {
      alert('Error al solicitar transporte: ' + e.message);
    } finally {
      setIsSubmittingRide(false);
    }
  };

  const handleAcceptRide = async (solId: string) => {
    if (!isDriverHabilitado) {
      alert('Solo los prestadores de servicio habilitados por el Administrador pueden aceptar viajes.');
      return;
    }

    const target = solicitudes.find((s) => s.id === solId);
    if (target && isSolicitudExpired(target, Date.now())) {
      alert('Esta solicitud ha expirado tras 12 minutos sin chofer asignado. El pasajero debe emitir una nueva solicitud.');
      return;
    }
    try {
      await aceptarSolicitudTransporte(
        solId,
        currentUserId,
        currentUserName,
        currentUserPhone || '3489690058'
      );

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

      // Disparar evento para sincronizar perfil en tiempo real
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('uppa-driver-accepted-ride', {
            detail: { driverId: currentUserId, driverName: currentUserName, solId },
          })
        );
      }

      setRideSuccessNotice('¡Aceptaste el viaje! Ubicación del pasajero habilitada en GPS y tu perfil pasó a ACTIVO (Ocupado).');
      setTimeout(() => setRideSuccessNotice(null), 5000);

      if (onLocatePassengerOnMap && target) {
        onLocatePassengerOnMap({
          ...target,
          estado: 'aceptado',
          choferId: currentUserId,
          choferNombre: currentUserName,
          choferTelefono: currentUserPhone,
        });
      }
    } catch (e: any) {
      alert('Error al aceptar viaje: ' + (e.message || ''));
    }
  };

  // Ranking en vivo de los últimos 20 prestadores (publicados por 3 horas)
  const [rankingList, setRankingList] = useState<CalificacionChoferFirestore[]>([]);
  const [isRankingDropdownOpen, setIsRankingDropdownOpen] = useState(false);

  // Prestador seleccionado para calificar
  const [calificarDriver, setCalificarDriver] = useState<TaxiListing | null>(null);

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
      const res = await validarCodigoSeguridadViaje(solId, code);
      if (!res.success) {
        setCodeErrors((prev) => ({
          ...prev,
          [solId]: res.error || 'Código de seguridad incorrecto.',
        }));
      } else {
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
    if (
      !window.confirm(
        '¿Confirmás anular este viaje? El chofer volverá a estar ACTIVO y DESOCUPADO inmediatamente.'
      )
    ) {
      return;
    }
    try {
      await anularViajePorCodigo(solId, motivo);
      if (currentUserId) setDriverDisponibilidad(currentUserId, 'desocupado');
      if (currentUserName) setDriverDisponibilidad(currentUserName, 'desocupado');
      if (currentUserPhone) setDriverDisponibilidad(currentUserPhone, 'desocupado');
      setDisponibilidadMap((prev) => ({
        ...prev,
        [currentUserId]: 'desocupado',
        [currentUserName]: 'desocupado',
        ...(currentUserPhone ? { [currentUserPhone]: 'desocupado' } : {}),
      }));
      alert('Viaje anulado. El estado del chofer ahora es ACTIVO · DESOCUPADO.');
    } catch (err: any) {
      alert('Error al anular viaje: ' + err.message);
    }
  };

  // Prestadores visibles en pantalla:
  // 1. Filtrados por vehículo y tiempo abonado vigente (endsAt > nowTimestamp).
  // 2. Calculada la distancia GPS en kilómetros a la ubicación del usuario.
  // 3. Ordenados por cercanía GPS, priorizando a los DESOCUPADOS primero.
  const visibleTaxis = useMemo(() => {
    const list = taxis
      .filter((t) => {
        if (vehicleFilter !== 'all' && t.vehicleType !== vehicleFilter) {
          return false;
        }
        return t.endsAt > nowTimestamp;
      })
      .map((t) => {
        const distKm = getDistanceKm(refCoords.lat, refCoords.lng, t.lat, t.lng);
        const disponibilidad = getTaxiDisponibilidad(t);
        const isDesocupado = disponibilidad === 'desocupado';
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
      });

    // Ordenar: desocupados primero, luego por menor distancia GPS
    list.sort((a, b) => {
      if (a.isDesocupado && !b.isDesocupado) return -1;
      if (!a.isDesocupado && b.isDesocupado) return 1;
      return a.distanceKm - b.distanceKm;
    });

    // Marcar el primer prestador desocupado como el más cercano
    const firstDesocupado = list.find((item) => item.isDesocupado);
    if (firstDesocupado) {
      firstDesocupado.isClosest = true;
    }

    return list;
  }, [taxis, vehicleFilter, nowTimestamp, refCoords, disponibilidadMap]);

  const formatRemainingTime = (endsAt: number) => {
    const diff = endsAt - Date.now();
    if (diff <= 0) return '0h 0m (Expirado)';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const getWhatsAppLink = (taxi: TaxiListing) => {
    const vehicleText = taxi.vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi';
    const text = encodeURIComponent(
      `Hola ${taxi.driverName}! Te contacto por UPPA (${vehicleText}). ¿Tenés disponibilidad para un viaje?`
    );
    return `https://wa.me/${taxi.whatsapp}?text=${text}`;
  };

  // Conductor destacado para la consola interactiva (primer conductor habilitado real o showcase referencial)
  const activeDriverFeatured = useMemo(() => {
    if (visibleTaxis.length > 0) {
      const match = visibleTaxis.find((t) => t.vehicleType === consoleVehicleType) || visibleTaxis[0];
      return {
        driverName: match.driverName,
        vehicleModel: match.vehicleType === 'moto' ? 'Moto Taxi Habilitada' : 'Honda CRV',
        plateNumber: match.plate || (match as any).plateNumber || 'AB6299ZG',
        rating: match.rating || 4.9,
        completedRides: match.completedRides || 482,
        whatsapp: match.whatsapp || '5493489690058',
        avatarUrl: match.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=Robert&backgroundColor=12141c',
        isReal: true,
        asientos: match.asientos || 4,
        aireAcondicionado: match.aireAcondicionado !== false,
        baul: match.baul !== false,
        aceptaMascotas: Boolean(match.aceptaMascotas),
        cascoExtra: match.cascoExtra !== false,
      };
    }
    return {
      driverName: 'Robert',
      vehicleModel: consoleVehicleType === 'moto' ? 'Honda CB 250' : 'Honda CRV',
      plateNumber: 'AB6299ZG',
      rating: 4.9,
      completedRides: 482,
      whatsapp: '5493489690058',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Robert&backgroundColor=12141c',
      isReal: false,
      asientos: 4,
      aireAcondicionado: true,
      baul: true,
      aceptaMascotas: false,
      cascoExtra: true,
    };
  }, [visibleTaxis, consoleVehicleType]);

  const dynamicEtaMin = useMemo(() => {
    if (visibleTaxis.length > 0) {
      const match = visibleTaxis.find((t) => t.vehicleType === consoleVehicleType) || visibleTaxis[0];
      return Math.max(2, Math.round((match.distanceKm || 1.2) * 2.5));
    }
    return 3;
  }, [visibleTaxis, consoleVehicleType]);

  const chatWhatsAppUrl = useMemo(() => {
    const phone = activeDriverFeatured.whatsapp || '5493489690058';
    const origenText = reqOrigin.trim() || 'mi ubicación';
    const destinoText = reqDestination.trim() || 'mi destino';
    const vehiculoText = consoleVehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi';
    const text = encodeURIComponent(
      `Hola ${activeDriverFeatured.driverName}! Te contacto por UPPA (${vehiculoText}). Necesito un viaje desde ${origenText} hacia ${destinoText}. ¿Tenés disponibilidad para realizar el viaje?`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }, [activeDriverFeatured, reqOrigin, reqDestination, consoleVehicleType]);

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Glass Header (Inspirado en TAXI_AUTO & TAXI_MOTO) */}
      <div className="p-3.5 sm:p-5 border-b border-white/5 bg-[#080d16]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] shrink-0">
              <Car className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-emerald-400 font-display leading-tight tracking-tight">
                Taxis & Motos
              </h2>
              <span className="text-[11px] text-slate-400">
                Transporte Alternativo Colaborativo - En Tiempo Real
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {isPrestadorLogueado ? (
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyOcupado = (currentUserId && disponibilidadMap[currentUserId] === 'ocupado') || false;
                  const nextDisp = isCurrentlyOcupado ? 'desocupado' : 'ocupado';
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
                className={`px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border-2 ${
                  (currentUserId && disponibilidadMap[currentUserId] === 'ocupado')
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.5)]'
                }`}
                title="Alternar tu disponibilidad como chofer"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${(currentUserId && disponibilidadMap[currentUserId] === 'ocupado') ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span>{(currentUserId && disponibilidadMap[currentUserId] === 'ocupado') ? 'Estado: OCUPADO' : 'Estado: DESOCUPADO'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsRequestRideOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Pedir Viaje</span>
                </button>

                <button
                  onClick={() => onOpenPublishModal('transfer')}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Prestar Servicio</span>
                </button>
              </>
            )}

            {/* Botón Políticas & Descargo en barra superior */}
            <button
              type="button"
              onClick={() => setIsPoliticasOpen(true)}
              className="px-3.5 py-2 rounded-full border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)] transition-all cursor-pointer"
              title="Ver Políticas de Uso y Descargo de Responsabilidad"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Políticas & Descargo</span>
            </button>
          </div>
        </div>

        {/* Success Notice */}
        {rideSuccessNotice && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{rideSuccessNotice}</span>
          </div>
        )}

        {/* Barra de Filtros y Ranking (Inspirada en el diseño de referencia) */}
        <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Desplegable de Ranking de Prestadores */}
          <div className="rounded-2xl border border-amber-500/30 bg-[#0d121e]/90 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setIsRankingDropdownOpen(!isRankingDropdownOpen)}
              className="px-3.5 py-2 flex items-center gap-2 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">
                Ranking de Prestadores
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {rankingList.length}
              </span>
              <div className="w-5 h-5 flex items-center justify-center text-amber-400 ml-1">
                {isRankingDropdownOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVehicleFilter('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-2xl transition-all cursor-pointer ${
                vehicleFilter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'bg-[#101420] hover:bg-[#151b2a] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              Todos ({visibleTaxis.length})
            </button>
            <button
              onClick={() => {
                setVehicleFilter('auto');
                setConsoleVehicleType('auto');
                setReqType('auto');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer ${
                vehicleFilter === 'auto'
                  ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'bg-[#101420] hover:bg-[#151b2a] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Autos ({visibleTaxis.filter((t) => t.vehicleType === 'auto').length})</span>
            </button>
            <button
              onClick={() => {
                setVehicleFilter('moto');
                setConsoleVehicleType('moto');
                setReqType('moto');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer ${
                vehicleFilter === 'moto'
                  ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'bg-[#101420] hover:bg-[#151b2a] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Motos ({visibleTaxis.filter((t) => t.vehicleType === 'moto').length})</span>
            </button>
          </div>
        </div>

        {/* Lista desplegable de ranking si está abierta */}
        {isRankingDropdownOpen && (
          <div className="mt-2.5 rounded-2xl border border-white/10 p-2.5 bg-[#090d16]/98 animate-in slide-in-from-top-2 duration-200">
            {rankingList.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                Sin calificaciones registradas en las últimas 3 horas
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {rankingList.slice(0, 20).map((item, idx) => {
                  const info = getCalificacionInfo(item.puntuacion);
                  return (
                    <div
                      key={item.id}
                      className="px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-400/30 flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950 font-bold'
                              : idx === 2
                              ? 'bg-amber-700 text-amber-100 font-bold'
                              : 'bg-white/5 text-slate-400'
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

      {/* Main Scrollable Area (Scrolling Web) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Lógica de Visibilidad: Las Solicitudes de Pasajeros SOLO le aparecen a los Prestadores de Servicio logueados */}
        {(() => {
          const isPrestadorLogueado = Boolean(
            isDriverHabilitado ||
            currentUserRole === 'driver' ||
            currentUserRole === 'chofer' ||
            currentUserRole === 'chofer_auto' ||
            currentUserRole === 'chofer_moto' ||
            currentUserRole === 'admin' ||
            currentUserRole === 'administrador' ||
            (typeof window !== 'undefined' && localStorage.getItem('uppa_active_driver_session'))
          );

          const myPassengerSolicitudes = visibleSolicitudes.filter(
            (s) => s.pasajeroId === currentUserId || (currentUserName && s.nombrePasajero === currentUserName)
          );

          // 1. SI ES PRESTADOR DE SERVICIO LOGUEADO: Ve las solicitudes de pasajeros para aceptarlas y ubicarlas con GPS
          if (isPrestadorLogueado) {
            const activeSolicitudesCount = visibleSolicitudes.filter((s) => s.estado === 'pendiente' && !isSolicitudExpired(s, nowTimestamp)).length;
            const acceptedSolicitudesCount = visibleSolicitudes.filter((s) => s.estado === 'aceptado').length;

            return (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#0a1122] to-indigo-950/30 border border-blue-500/25 shadow-md space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-bold text-blue-300 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${activeSolicitudesCount > 0 ? 'bg-blue-400 animate-ping' : 'bg-slate-500'}`} />
                    Solicitudes de Pasajeros ({activeSolicitudesCount} activas · {acceptedSolicitudesCount} aceptadas)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPoliticasOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all cursor-pointer shrink-0"
                    title="Ver Políticas de Uso y Descargo de Responsabilidad"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                    <span>Políticas & Descargo</span>
                  </button>
                </div>

                {visibleSolicitudes.length > 0 ? (
                  /* Scrolling horizontal web para solicitudes */
                  <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {visibleSolicitudes.map((sol) => {
                      const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                      const mins = Math.floor(remainingSec / 60);
                      const secs = remainingSec % 60;
                      const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                      const remainingAcceptedSec = getSolicitudAceptadaRemainingSeconds(sol, nowTimestamp);
                      const acceptedMins = Math.floor(remainingAcceptedSec / 60);

                      return (
                        <div
                          key={sol.id}
                          className={`p-3 rounded-xl border text-xs min-w-[270px] max-w-[310px] shrink-0 space-y-1.5 ${
                            sol.estado === 'aceptado'
                              ? 'bg-[#0c1322] border-emerald-500/40 text-blue-200'
                              : 'bg-[#0f1424] border-amber-500/30 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-white min-w-0">
                              {sol.tipoVehiculoRequerido === 'moto' ? (
                                <Bike className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                              ) : (
                                <Car className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                              )}
                              <span className="truncate">{sol.nombrePasajero}</span>
                            </div>

                            {sol.estado === 'pendiente' && (
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono flex items-center gap-1 shrink-0 ${
                                  remainingSec <= 180
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40 animate-pulse'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                }`}
                                title="Tiempo restante para aceptar viaje (límite 12 minutos)"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{formattedTimer}</span>
                              </span>
                            )}

                            {sol.estado === 'aceptado' && (
                              <span
                                className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0 font-mono"
                                title="Visible por 16 minutos desde la aceptación"
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                                <span>Aceptado · {acceptedMins}m</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-300 space-y-0.5">
                            <p className="truncate">📍 {sol.origen}</p>
                            <p className="truncate">🏁 {sol.destino}</p>
                          </div>

                          {sol.estado === 'pendiente' ? (
                            <button
                              onClick={() => handleAcceptRide(sol.id)}
                              className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow transition-all cursor-pointer active:scale-95"
                            >
                              <Check className="w-3 h-3" />
                              <span>Aceptar Viaje ({formattedTimer})</span>
                            </button>
                          ) : (
                            <div className="pt-1.5 border-t border-emerald-500/20 space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <p className="text-emerald-300 font-semibold truncate">
                                  Chofer: {sol.choferNombre || 'Asignado'}
                                </p>
                                <span className="text-[9px] text-emerald-400/80 font-mono shrink-0 ml-1">
                                  {acceptedMins}m restantes
                                </span>
                              </div>

                              {/* WhatsApp del Pasajero para que envíe el código al prestador */}
                              {(() => {
                                const pPhone = sol.telefonoPasajero || '';
                                const cleanPhone = pPhone.replace(/\D/g, '');
                                const hasPhone = cleanPhone.length >= 6;
                                const fullPhone = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;

                                return (
                                  <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10.5px]">
                                      <span className="text-slate-400 font-medium">Pasajero a llevar:</span>
                                      <span className="font-bold text-white truncate">{sol.nombrePasajero}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[10.5px]">
                                      <span className="text-slate-400 font-medium">WhatsApp Pasajero:</span>
                                      <span className="font-mono text-emerald-300 font-bold">
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
                                        className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5 fill-slate-950 text-slate-950 shrink-0" />
                                        <span>WhatsApp Pasajero: +{cleanPhone} (Pedir Código)</span>
                                      </a>
                                    ) : (
                                      <p className="text-[9.5px] text-amber-300/80 leading-tight">
                                        El pasajero te brindará el código de 4 caracteres de su pantalla al abordar.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Sección de Validación de Código de Seguridad provisto por el Pasajero */}
                              {!sol.codigoValidado ? (
                                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/40 space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-amber-200 font-bold flex items-center gap-1">
                                      <KeyRound className="w-3 h-3 text-amber-300" />
                                      Código provisto por pasajero:
                                    </span>
                                    {typeof sol.intentosFallidosCodigo === 'number' &&
                                      sol.intentosFallidosCodigo > 0 && (
                                        <span className="text-rose-300 font-mono font-bold text-[9px]">
                                          {3 - sol.intentosFallidosCodigo} intentos restantes
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
                                      placeholder="CÓDIGO (4 CARACTERES)"
                                      className="flex-1 h-7 px-2 rounded-lg bg-black/60 border border-amber-400/50 font-mono text-[11px] font-bold text-amber-200 placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-amber-300"
                                    />
                                    <button
                                      type="button"
                                      disabled={isValidatingCode[sol.id] || !(codeInputs[sol.id] || '').trim()}
                                      onClick={() => handleVerifyCode(sol.id)}
                                      className="h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                                    >
                                      {isValidatingCode[sol.id] ? '...' : 'Habilitar'}
                                    </button>
                                  </div>

                                  {codeErrors[sol.id] && (
                                    <p className="text-[10px] text-rose-300 font-medium flex items-center gap-1 leading-tight">
                                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                                      <span>{codeErrors[sol.id]}</span>
                                    </p>
                                  )}

                                  {codeSuccesses[sol.id] && (
                                    <p className="text-[10px] text-emerald-300 font-medium flex items-center gap-1 leading-tight">
                                      <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                                      <span>{codeSuccesses[sol.id]}</span>
                                    </p>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleAnularRide(sol.id, 'Código incorrecto o pasajero no abordó')}
                                    className="w-full py-1 text-[9.5px] font-bold text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 rounded border border-rose-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-3 h-3 text-rose-400" />
                                    <span>Anular viaje si el código no coincide</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10.5px] flex items-center gap-1.5 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>✅ Código verificado · Viaje habilitado</span>
                                </div>
                              )}

                              {/* Botón para que el prestador de servicio ubique al usuario con GPS */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (onLocatePassengerOnMap) {
                                    onLocatePassengerOnMap(sol);
                                  }
                                }}
                                className="w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer ring-1 ring-emerald-300"
                                title="Habilitar ubicación del pasajero en el GPS y trazar ruta hacia su posición"
                              >
                                <Navigation className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                                <span>📍 Ubicar con GPS en Mapa</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-2 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-center text-[11px] text-slate-400">
                    No hay solicitudes de pasajeros activas en este momento.
                  </div>
                )}
              </div>
            );
          }

          // 2. SI ES PASAJERO: NO ve la cola de solicitudes de otros pasajeros.
          // Solo si tiene su propia solicitud de viaje emitida, ve su estado personal.
          if (myPassengerSolicitudes.length > 0) {
            return (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-[#0a1122] to-indigo-950/30 border border-blue-500/25 shadow-md space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    Tu Solicitud de Viaje en Curso
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPoliticasOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40"
                  >
                    <ShieldAlert className="w-3 h-3 text-amber-300" />
                    <span>Políticas</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {myPassengerSolicitudes.map((sol) => {
                    const remainingSec = getSolicitudRemainingSeconds(sol, nowTimestamp);
                    const mins = Math.floor(remainingSec / 60);
                    const secs = remainingSec % 60;
                    const formattedTimer = `${mins}:${secs.toString().padStart(2, '0')}`;

                    return (
                      <div
                        key={sol.id}
                        className={`p-3 rounded-xl border text-xs ${
                          sol.estado === 'aceptado'
                            ? 'bg-[#0c1322] border-emerald-500/40 text-blue-200'
                            : 'bg-[#0f1424] border-amber-500/30 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-white">
                            {sol.tipoVehiculoRequerido === 'moto' ? '🏍️ Moto Taxi' : '🚕 Auto Taxi'}
                          </span>
                          {sol.estado === 'pendiente' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                              Buscando chofer ({formattedTimer})
                            </span>
                          )}
                          {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                              ✓ Chofer asignado: {sol.choferNombre || 'En camino'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">📍 Origen: {sol.origen}</p>
                        <p className="text-[11px] text-slate-300">🏁 Destino: {sol.destino}</p>

                        {/* Código de Seguridad Confidencial para el Pasajero */}
                        {(sol.estado === 'aceptado' || sol.estado === 'en_camino') && (
                          <>
                            {!sol.codigoValidado ? (
                              <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-yellow-500/20 border-2 border-amber-400/60 shadow-lg space-y-1.5">
                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                  <span className="text-[10.5px] font-black uppercase text-amber-200 tracking-wider flex items-center gap-1.5">
                                    <KeyRound className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                                    <span>Tu Código Secreto de Abordaje</span>
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400/25 text-amber-300 border border-amber-400/50">
                                    Solo vos lo ves
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 pt-0.5">
                                  <div className="px-3.5 py-1.5 rounded-xl bg-black/80 border-2 border-amber-400 font-mono text-xl font-black tracking-widest text-amber-300 shadow-inner select-all">
                                    {sol.codigoSeguridad || '----'}
                                  </div>
                                  <div className="text-[11px] text-amber-100/90 leading-tight space-y-0.5">
                                    <p className="font-bold text-white">
                                      Pasáselo al chofer al subirte al vehículo.
                                    </p>
                                    <p className="text-[10px] text-amber-200/80">
                                      El chofer debe validarlo para habilitar el viaje. Si el código no coincide, el viaje queda anulado.
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
                                    className="mt-2 w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                                    <span>Enviar Código ({sol.codigoSeguridad}) a {sol.choferNombre || 'Chofer'} por WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                                <div>
                                  <span className="font-black text-white block">✅ ¡Código verificado por el chofer!</span>
                                  <span className="text-[10.5px] text-emerald-300/90">Viaje habilitado y en curso con {sol.choferNombre || 'tu chofer'}.</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Si es pasajero y no tiene viaje activo, muestra enlace directo a políticas de transporte
          return (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-slate-400">
                Contactá a los prestadores habilitados en vivo
              </span>
              <button
                type="button"
                onClick={() => setIsPoliticasOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 shadow-sm transition-all cursor-pointer"
                title="Ver Políticas de Uso y Descargo de Responsabilidad"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                <span>Políticas & Descargo</span>
              </button>
            </div>
          );
        })()}

        {/* Prestadores de Servicio Habilitados y Consola Interactiva: VISIBLES ÚNICAMENTE PARA PASAJEROS */}
        {!isPrestadorLogueado ? (
          <>
            {/* =========================================================================
                CONSOLA INTERACTIVA CENTRAL (Inspirada en TAXI_AUTO & TAXI_MOTO)
               ========================================================================= */}
            <div className="w-full max-w-[440px] mx-auto rounded-3xl bg-[#090d16]/95 backdrop-blur-2xl border border-white/10 p-3.5 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.85)] space-y-3 relative overflow-hidden ring-1 ring-white/5">
              {/* Contenedor de Inputs de Recogida y Destino con Botón de Inversión */}
              <div className="rounded-2xl bg-[#111624] border border-white/10 p-2 space-y-1.5 relative">
                {/* Origen Input */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/50 border border-white/5 focus-within:border-emerald-400/60 transition-colors">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    value={reqOrigin}
                    onChange={(e) => setReqOrigin(e.target.value)}
                    placeholder="Añadir ubicación de recogida"
                    className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 font-medium focus:outline-none"
                  />
                  {reqOrigin && (
                    <button
                      type="button"
                      onClick={() => setReqOrigin('')}
                      className="text-slate-400 hover:text-white text-xs p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Botón Circular Central de Inversión (Swap) */}
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      const temp = reqOrigin;
                      setReqOrigin(reqDestination);
                      setReqDestination(temp);
                    }}
                    className="w-7 h-7 rounded-full bg-[#1b2235] hover:bg-[#252f48] text-slate-300 hover:text-white border border-white/10 flex items-center justify-center text-xs shadow-md active:rotate-180 transition-all cursor-pointer"
                    title="Invertir ubicación de recogida y destino"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Destino Input */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/50 border border-white/5 focus-within:border-emerald-400/60 transition-colors">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={reqDestination}
                    onChange={(e) => setReqDestination(e.target.value)}
                    placeholder="Añadir destino"
                    className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 font-medium focus:outline-none"
                  />
                  {reqDestination && (
                    <button
                      type="button"
                      onClick={() => setReqDestination('')}
                      className="text-slate-400 hover:text-white text-xs p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Fila de Estado de Llegada y Tarifa */}
              <div className="flex items-center justify-between px-1">
                <div className="text-emerald-400 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>El conductor llegará en {dynamicEtaMin} min</span>
                </div>
                <div className="px-3.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-[0_0_14px_rgba(16,185,129,0.5)]">
                  $10
                </div>
              </div>

              {/* Visualización Interactiva del Vehículo & Tarjeta del Conductor */}
              <div className="grid grid-cols-12 gap-2.5 items-stretch">
                {/* Lado Izquierdo: Vista Cenital del Vehículo (Auto o Moto con toque interactivo) */}
                <div
                  onClick={() => {
                    const next = consoleVehicleType === 'auto' ? 'moto' : 'auto';
                    setConsoleVehicleType(next);
                    setReqType(next);
                  }}
                  className="col-span-5 rounded-2xl bg-gradient-to-b from-[#080c14] via-[#0d1322] to-[#12192b] border border-white/10 hover:border-emerald-500/40 p-2 flex flex-col items-center justify-between cursor-pointer transition-all group relative overflow-hidden shadow-inner"
                  title="Tocar para alternar entre Auto y Moto"
                >
                  <div className="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    <span className="text-emerald-400 font-mono font-black">
                      {consoleVehicleType === 'auto' ? 'Auto' : 'Moto'}
                    </span>
                    <span className="text-[8px] bg-white/10 px-1 py-0.2 rounded text-slate-300">
                      {consoleVehicleType === 'auto' ? '4 as.' : 'Rápido'}
                    </span>
                  </div>

                  <div className="my-1 flex items-center justify-center h-[175px] w-full relative">
                    <img
                      src={consoleVehicleType === 'auto' ? '/assets/aistudio/car_cropped.png' : '/assets/aistudio/moto_cropped.png'}
                      alt={consoleVehicleType === 'auto' ? 'Taxi Auto' : 'Moto Taxi'}
                      className="max-h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.95)] group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="text-[9px] text-emerald-400/90 font-medium text-center flex items-center gap-1">
                    <span>Tocar ⇄</span>
                    <span className="text-white font-bold">{consoleVehicleType === 'auto' ? 'Ver Moto' : 'Ver Auto'}</span>
                  </div>
                </div>

                {/* Lado Derecho: Ficha del Conductor */}
                <div className="col-span-7 rounded-2xl bg-[#121726] border border-white/5 p-3 flex flex-col justify-between space-y-2">
                  {/* Avatar, Nombre y Modelo */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-emerald-400/40 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                      <img
                        src={activeDriverFeatured?.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=Robert&backgroundColor=12141c"}
                        alt="Conductor"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate leading-tight">
                        {activeDriverFeatured?.driverName || 'Robert'}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {activeDriverFeatured?.vehicleModel || (consoleVehicleType === 'auto' ? 'Honda CRV' : 'Honda CB 250')}
                      </p>
                    </div>
                  </div>

                  {/* Patente y Calificación */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-2 py-0.5 rounded-md bg-white text-slate-950 font-mono font-black text-[10.5px] border border-slate-300 shadow-sm tracking-wider">
                      {activeDriverFeatured?.plateNumber || 'AB6299ZG'}
                    </span>
                    <span className="text-amber-300 font-bold text-xs flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      <span>{activeDriverFeatured?.rating ? activeDriverFeatured.rating.toFixed(1) : '4.9'}</span>
                    </span>
                  </div>

                  {/* Categoría y Tiempo */}
                  <div className="text-xs text-slate-300 font-semibold">
                    Standard · {dynamicEtaMin} min
                  </div>

                  {/* Asientos, Confort y Viajes */}
                  <div className="flex items-center gap-2.5 text-[11px] text-slate-300 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-emerald-300">
                      <span>{consoleVehicleType === 'auto' ? '👤' : '🪖'}</span>
                      <span>
                        {consoleVehicleType === 'auto'
                          ? `${activeDriverFeatured?.asientos || 4} asientos`
                          : (activeDriverFeatured?.cascoExtra !== false ? 'Casco extra' : '1 pasajero')}
                      </span>
                    </span>
                    {consoleVehicleType === 'auto' && activeDriverFeatured?.aireAcondicionado !== false && (
                      <span className="text-[10px] text-cyan-300 font-medium">· ❄️ Aire</span>
                    )}
                    {activeDriverFeatured?.baul !== false && (
                      <span className="text-[10px] text-slate-300 font-medium">· 🧳 Baúl</span>
                    )}
                    <span className="flex items-center gap-1 text-slate-400 text-[10.5px]">
                      <span>· ✈</span>
                      <span>{activeDriverFeatured?.completedRides || 482} viajes</span>
                    </span>
                  </div>

                  {/* Índice de Seguridad */}
                  <div className="pt-1 border-t border-white/5 space-y-1">
                    <div className="text-[10px] text-slate-400 leading-tight">
                      98% de índice de seguridad del usuario
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Principal Cápsula: Chatear con el conductor */}
              <a
                href={chatWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-1.5 rounded-full bg-[#181f2f] hover:bg-[#1f283e] border border-white/10 flex items-center justify-between transition-all cursor-pointer shadow-md group active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500 group-hover:bg-emerald-400 flex items-center justify-center text-slate-950 shadow-md group-hover:scale-105 transition-transform shrink-0">
                  <MessageCircle className="w-4 h-4 fill-slate-950 text-slate-950" />
                </div>
                <div className="text-xs font-bold text-white tracking-wide group-hover:text-emerald-300 transition-colors flex items-center gap-1">
                  <span>Chatear con el conductor</span>
                  <span className="text-emerald-400 font-black">› › ›</span>
                </div>
                <div className="w-9" />
              </a>

              {/* Opción Desplegable para Emitir Pedido a Toda la Red (Con temporizador de 12 min y código de abordaje) */}
              <div className="pt-0.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowConsoleRequestForm(!showConsoleRequestForm)}
                  className="w-full py-1.5 text-center text-[11px] font-semibold text-slate-300 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {showConsoleRequestForm
                      ? 'Ocultar formulario de pedido a choferes'
                      : 'O emitir pedido a choferes con código de abordaje (12 min)'}
                  </span>
                  {showConsoleRequestForm ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {showConsoleRequestForm && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-start gap-2.5 text-[11px] text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                      <span>
                        Se emitirá aviso a todos los choferes habilitados con temporizador de <strong className="text-white">12 minutos</strong> y se te asignará un código secreto para habilitar el viaje al abordar.
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs">
                      <label className="flex items-start gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={aceptaPoliticasRide}
                          onChange={(e) => setAceptaPoliticasRide(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-[#0f1422] cursor-pointer"
                        />
                        <div className="text-[11px] text-slate-300 leading-snug">
                          <span>Acepto la </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsPoliticasOpen(true);
                            }}
                            className="font-bold text-amber-300 underline underline-offset-2"
                          >
                            Política & Descargo de Responsabilidad
                          </button>
                        </div>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmittingRide || !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim()}
                      onClick={(e) => handleCreateRideRequest(e)}
                      className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
                        !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 ring-1 ring-amber-300 cursor-pointer'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 fill-current" />
                      <span>{isSubmittingRide ? 'Emitiendo solicitud...' : 'Emitir Pedido de Transporte Alternativo'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Encabezado de Prestadores de Servicio Habilitados */}
            <div className="flex items-center justify-between pt-3 pb-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>Prestadores de Servicio Habilitados</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-mono">
                    {visibleTaxis.length}
                  </span>
                </h3>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold hidden sm:inline">
                Directo por WhatsApp y Teléfono
              </span>
            </div>

            {/* Driver Cards Stream - Solo Prestadores 100% Reales Habilitados */}
            <div className="space-y-2.5">
            {visibleTaxis.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5 shadow-inner">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 mx-auto flex items-center justify-center text-xl">
                  🚕
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No hay prestadores de servicio habilitados en este momento</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                    Todos los prestadores mostrados en UPPA son reales y habilitados con turno vigente. Podés presionar "Pedir Viaje" para emitir tu solicitud a la red o comunicarte directamente a la administración.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRequestRideOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Pedir Viaje Ahora
                  </button>
                  <a
                    href="https://wa.me/5493489690058?text=Hola%20Administraci%C3%B3n%20UPPA!%20Necesito%20un%20m%C3%B3vil%20de%20transporte%20alternativo%20(Taxi%20o%20Moto)."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Contactar Central (WhatsApp 3489690058)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenPublishModal('transfer')}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Registrarme como Prestador
                  </button>
                </div>
              </div>
            ) : (
              visibleTaxis.map((taxi) => {
            const isMoto = taxi.vehicleType === 'moto';
            const isOcupado = getTaxiDisponibilidad(taxi) === 'ocupado';

            return (
              <div
                key={taxi.id}
                className={`glass-card hover:bg-white/[0.06] rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                  isOcupado
                    ? 'border-amber-500/35 bg-[#17130e]'
                    : 'border-blue-500/20 bg-[#0d121f]'
                }`}
              >
                {/* Left driver badge */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-xl shadow-inner">
                      {taxi.avatarUrl ? (
                        <img
                          src={taxi.avatarUrl}
                          alt={taxi.driverName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <span>{isMoto ? '🏍️' : '🚕'}</span>
                      )}
                    </div>
                    {/* Indicador de ocupado/desocupado en avatar */}
                    {isOcupado ? (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 ring-2 ring-[#07090e]" />
                      </span>
                    ) : (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-[#07090e] bg-emerald-400 animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{taxi.driverName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 font-bold uppercase tracking-wide">
                        {isMoto ? '🏍️ Moto Taxi' : '🚕 Auto Taxi'}
                      </span>
                      <div className="flex items-center gap-0.5 text-xs text-amber-300 font-mono font-semibold">
                        <Star className="w-3 h-3 fill-amber-300" />
                        <span>{taxi.rating.toFixed(1)}</span>
                      </div>

                      {/* Indicador de Estado Ocupado / Desocupado con efecto titilando cuando está ocupado */}
                      {isOcupado ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-400/60 shadow-sm shadow-amber-500/30 animate-pulse">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                          <span>OCUPADO (EN VIAJE)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm shadow-emerald-500/20">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                          </span>
                          <span>ACTIVO · DESOCUPADO</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 font-medium">
                      {taxi.vehicleModel}
                    </p>

                    {/* Ficha de Confort y Capacidad del Servicio */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {isMoto ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 border border-amber-400/30 text-amber-200">
                            <span>🪖</span>
                            <span>{taxi.cascoExtra !== false ? 'Casco extra para pasajero' : 'Sin casco extra'}</span>
                          </span>
                          {taxi.baul !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                              <span>📦</span>
                              <span>Baúl / Portaequipaje</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 border border-cyan-400/30 text-cyan-200">
                            <span>👥</span>
                            <span>{taxi.asientos || 4} asientos</span>
                          </span>
                          {taxi.aireAcondicionado !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">
                              <span>❄️</span>
                              <span>Aire Acondicionado</span>
                            </span>
                          )}
                          {taxi.baul !== false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                              <span>🧳</span>
                              <span>Baúl</span>
                            </span>
                          )}
                          {taxi.aceptaMascotas && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 border border-purple-400/30 text-purple-200">
                              <span>🐾</span>
                              <span>Mascotas OK</span>
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {/* Distancia GPS calculada */}
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-lg text-[10px] ${
                          taxi.isClosest && taxi.isDesocupado
                            ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse'
                            : 'bg-white/5 text-slate-300 border border-white/10'
                        }`}
                        title="Distancia aproximada en línea recta según coordenadas GPS"
                      >
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span>a {taxi.formattedDistance}</span>
                        {taxi.isClosest && taxi.isDesocupado && (
                          <span className="text-emerald-300 ml-0.5 font-extrabold uppercase tracking-wide">
                            (Más cercano)
                          </span>
                        )}
                      </span>

                      <span>·</span>

                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="truncate max-w-[180px]">{taxi.zone}</span>
                      </span>

                      <span>·</span>

                      {/* Countdown Timer Badge */}
                      <span className="flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-lg text-[10px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                        <Clock className="w-3 h-3" />
                        <span>Quedan {formatRemainingTime(taxi.endsAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-wrap">
                  {/* Botón para calificar al prestador */}
                  <button
                    onClick={() => setCalificarDriver(taxi)}
                    className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                    title="Calificar a este prestador (de 1 a 5 donde 1 es Malo y 5 es Muy Bueno)"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>Calificar</span>
                  </button>

                  {onSelectTaxiOnMap && (
                    <button
                      onClick={() => onSelectTaxiOnMap(taxi)}
                      className="px-3.5 py-2 rounded-xl glass-button hover:bg-blue-500/20 text-xs font-semibold text-blue-300 hover:text-white border border-blue-400/30 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                      title="Ver conductor en el mapa y trazar trayectoria"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-400" />
                      <span>Mapa</span>
                    </button>
                  )}

                  <a
                    href={getWhatsAppLink(taxi)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-400/20 active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-slate-950" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })
        )}
        </div>

            {/* Servicios & Comercios de la Comunidad (Inspirado en el diseño de referencia) */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-slate-300">
                    Servicios & Comercios Locales (Malvinas · Zárate)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPublishModal('transfer')}
                  className="px-3.5 py-1.5 rounded-full bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>Anunciar</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10">
                {LOCAL_COMMUNITY_SPONSORS.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-2.5 rounded-2xl bg-[#0e1422] border border-white/10 flex items-center justify-between gap-3 min-w-[270px] max-w-[320px] shrink-0 shadow-md hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {sp.image ? (
                        <img
                          src={sp.image}
                          alt={sp.name}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                          🧑
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="font-bold text-white text-xs truncate leading-tight">
                          {sp.name}
                        </h5>
                        <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                          {sp.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={sp.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span>Web</span>
                        <span className="text-[9px]">↗</span>
                      </a>
                      <a
                        href={`https://wa.me/${sp.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-sm transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3 h-3 fill-slate-950" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </>
        ) : null}
      </div>

      {/* Request Ride Modal Dialog */}
      {isRequestRideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-[#0f1422] border border-blue-500/40 rounded-3xl p-5 shadow-2xl relative text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 gap-2">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <Zap className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white">Solicitud de Transporte Alternativo</h3>
                    {/* Botón destellando de políticas */}
                    <button
                      type="button"
                      onClick={() => setIsPoliticasOpen(true)}
                      className="relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-amber-200 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all animate-pulse hover:scale-105 active:scale-95 cursor-pointer"
                      title="Ver Políticas de Uso y Descargo de Responsabilidad"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                      </span>
                      <ShieldAlert className="w-3 h-3 text-amber-300" />
                      <span>Políticas & Descargo</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cuando quedás sin micro o necesitás traslado urgente</p>
                </div>
              </div>
              <button onClick={() => setIsRequestRideOpen(false)} className="p-1 rounded-full text-slate-400 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRideRequest} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>¿Dónde estás? (Origen)</span>
                  </label>
                  {reqOrigin && (
                    <button
                      type="button"
                      onClick={() => setReqOrigin('')}
                      className="text-[10px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
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
                  placeholder="Escribí el lugar donde te encontrás (ej: Justo Vigalondo 1419 o Parada Colectora)"
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>¿Hacia dónde vas? (Destino)</span>
                  </label>
                  {reqDestination && (
                    <button
                      type="button"
                      onClick={() => setReqDestination('')}
                      className="text-[10px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
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
                  placeholder="Escribí hacia dónde vas (ej: McDonald's Panamericana Km 72.5 o Zárate Centro)"
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Vehículo Requerido</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqType('moto')}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      reqType === 'moto'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 ring-1 ring-amber-400/40 shadow-sm'
                        : 'bg-slate-900 border-white/5 text-slate-400'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto Taxi (Rápido)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqType('auto')}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      reqType === 'auto'
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 ring-1 ring-cyan-400/40 shadow-sm'
                        : 'bg-slate-900 border-white/5 text-slate-400'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Auto Taxi</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-[11px] text-blue-200 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-bold text-amber-300">Temporizador de 12 minutos para aceptación:</span>
                  <p className="text-[11px] text-slate-300">
                    Tu solicitud se emitirá en vivo a los choferes habilitados en Zárate y Campana con un temporizador de <strong className="text-white">12 minutos</strong>. Si ningún chofer acepta en ese lapso, la solicitud expirará y deberás emitir una nueva.
                  </p>
                </div>
              </div>

              {/* Aceptación Obligatoria de Política & Descargo */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  aceptaPoliticasRide
                    ? 'bg-amber-500/10 border-amber-400/50 shadow-inner ring-1 ring-amber-400/30'
                    : 'bg-white/[0.03] border-white/10 hover:border-amber-400/30'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptaPoliticasRide}
                    onChange={(e) => setAceptaPoliticasRide(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-0 bg-[#0f1422] cursor-pointer"
                  />
                  <div className="text-xs text-slate-300 leading-snug">
                    <span>He leído y acepto la </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPoliticasOpen(true);
                      }}
                      className="font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 inline" />
                      <span>Política & Descargo</span>
                    </button>
                    <span className="text-slate-400 block text-[11px] mt-0.5">
                      Obligatorio: debés aceptar la Política & Descargo para poder emitir el pedido de transporte alternativo.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmittingRide || !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim()}
                  className={`w-full h-11 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-97 ${
                    !aceptaPoliticasRide || !reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 ring-1 ring-amber-300 cursor-pointer'
                  }`}
                >
                  <Send className="w-4 h-4 fill-current" />
                  <span>
                    {isSubmittingRide
                      ? 'Emitiendo aviso a los choferes...'
                      : 'Emitir Pedido de Transporte Alternativo'}
                  </span>
                </button>
                {!aceptaPoliticasRide && (
                  <p className="text-[10.5px] text-amber-300/90 text-center mt-2 flex items-center justify-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Debés aceptar la "Política & Descargo" para poder emitir el pedido.</span>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Calificación a Prestador de Servicios */}
      {calificarDriver && (
        <CalificarChoferModal
          isOpen={!!calificarDriver}
          onClose={() => setCalificarDriver(null)}
          driverId={calificarDriver.userId || calificarDriver.id}
          driverName={calificarDriver.driverName}
          pasajeroId={currentUserId}
          pasajeroNombre={currentUserName}
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


