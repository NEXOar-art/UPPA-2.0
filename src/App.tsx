import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MOCK_ROUTES,
  MOCK_EVENTS,
  MOCK_LIVE_BUSES,
  MOCK_TAXI_LISTINGS,
  MOCK_PAYMENTS,
  MOCK_CHAT_MESSAGES,
  MOCK_ADS,
  INITIAL_USER,
} from './data/mockInitialData';
import {
  TransitRoute,
  MapEvent,
  LiveBus,
  TaxiListing,
  PaymentProof,
  ChatMessage,
  MensajeChatFirestore,
  AdListing,
  User,
  PushNotificationPayload,
  mapFirestoreRolToAppRole,
  HabilitacionChofer,
  SolicitudTransporteFirestore,
} from './types';
import { computeLineSentiment } from './utils/sentiment';
import { UserLocation, reverseGeocode } from './utils/geolocation';
import { recordGpsSample } from './utils/busSpeedEstimator';
import { TeslaMap } from './components/map/TeslaMap';
import { EventBottomSheet } from './components/map/EventBottomSheet';
import { ReportEventModal } from './components/map/ReportEventModal';
import { TaxiMarketplace } from './components/taxi/TaxiMarketplace';
import { PublishTaxiModal } from './components/taxi/PublishTaxiModal';
import { CommunityChat } from './components/chat/CommunityChat';
import { AdminPanel } from './components/admin/AdminPanel';
import { AdBanner } from './components/ads/AdBanner';
import { ContactAdModal } from './components/ads/ContactAdModal';
import { PublicApiModal } from './components/api/PublicApiModal';
import { AuthModal } from './components/auth/AuthModal';
import { LoginPage } from './components/auth/LoginPage';
import { LocationPermissionModal } from './components/auth/LocationPermissionModal';
import { DriverConnectionBar } from './components/driver/DriverConnectionBar';
import { SplashScreen } from './components/splash/SplashScreen';
import { PedirTransporteModal } from './components/common/PedirTransporteModal';
import { MobilityBottomSheet } from './components/common/MobilityBottomSheet';
import { RankingPrestadoresDropdown } from './components/taxi/RankingPrestadoresDropdown';
import { Linea228Stop } from './data/linea228Stops';
import { useAuth } from './context/AuthContext';
import {
  ActiveDriverSession,
  getActiveDriverSession,
} from './services/driverActivationService';
import {
  subscribeToReportes,
  subscribeToHabilitacionesChofer,
  obtenerHabilitacionesActuales,
  subscribeToChat,
  onPushNotification,
  triggerInAppPushNotification,
  crearReporte,
  subscribeToDriversDisponibilidad,
  setDriverDisponibilidad,
  finalizarViajeDeChofer,
  isRealCommunityReport,
  enviarMensajeChat,
} from './services/realtimeFirebaseService';

import {
  MapPin,
  Car,
  MessageSquare,
  Shield,
  Plus,
  Code,
  Radio,
  Clock,
  Sparkles,
  Navigation,
  LogOut,
  Bus,
  Database,
  User as UserIcon,
  X,
  Bike,
  KeyRound,
  Mail,
  MoreVertical,
  Zap,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Maximize2,
} from 'lucide-react';

function GlobalHoverTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; placeBelow: boolean } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover)').matches) return;

    let currentEl: HTMLElement | null = null;

    const showForElement = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const el = target.closest('button[title], a[title], [role="button"][title]') as HTMLElement | null;
      if (!el) {
        if (currentEl) {
          currentEl = null;
          setTooltip(null);
        }
        return;
      }
      const text = el.getAttribute('title');
      if (!text || !text.trim()) return;
      currentEl = el;
      const rect = el.getBoundingClientRect();
      const placeBelow = rect.top < 56;
      const clampedX = Math.max(110, Math.min(window.innerWidth - 110, rect.left + rect.width / 2));
      const y = placeBelow ? rect.bottom + 8 : rect.top - 8;
      setTooltip({ text: text.trim(), x: clampedX, y, placeBelow });
    };

    const hide = () => {
      currentEl = null;
      setTooltip(null);
    };

    document.addEventListener('mouseover', (e) => showForElement(e.target), { passive: true });
    document.addEventListener('focusin', (e) => showForElement(e.target), { passive: true });
    document.addEventListener('mouseout', (e) => {
      if (!currentEl) return;
      const related = e.relatedTarget as Element | null;
      if (!related || !currentEl.contains(related)) hide();
    }, { passive: true });
    document.addEventListener('pointerdown', hide, { passive: true });
    window.addEventListener('scroll', hide, { passive: true, capture: true });

    return () => {
      document.removeEventListener('pointerdown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      className="fixed z-[9999] pointer-events-none max-w-[230px] px-2.5 py-1.5 rounded-lg bg-[#202329] border border-[#FFF19A]/70 text-white text-[10.5px] font-semibold leading-snug text-center shadow-[2px_2px_0px_#101114]"
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: tooltip.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      }}
    >
      {tooltip.text}
    </div>
  );
}

export default function App() {
  const {
    user: authUser,
    isAuthenticated,
    isEmailVerified,
    isAdmin: isFirebaseAdmin,
    logout: firebaseLogout,
    isLoading: isAuthLoading,
  } = useAuth();

  // Authentication state - Requerida al inicio para acceder a todas las funcionalidades
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('uppa_session_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email === 'gastonrobertogimenez@gmail.com') {
          // Limpiar cuenta privada previa para conectar exclusivamente cuentas personales
          localStorage.removeItem('uppa_session_user');
          localStorage.removeItem('UPPA_AUTH_USER');
          return false;
        }
        if (parsed && parsed.email && !parsed.email.includes('guest')) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem('uppa_session_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email === 'gastonrobertogimenez@gmail.com') {
          localStorage.removeItem('uppa_session_user');
          localStorage.removeItem('UPPA_AUTH_USER');
          return INITIAL_USER;
        }
        if (parsed && parsed.email && !parsed.email.includes('guest')) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_USER;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Driver Activation Session with paid countdown timer
  const [driverSession, setDriverSession] = useState<ActiveDriverSession | null>(() => getActiveDriverSession());

  // Listen to driver session activations
  useEffect(() => {
    const handleDriverSessionChange = () => {
      setDriverSession(getActiveDriverSession());
    };
    window.addEventListener('uppa-driver-session-updated', handleDriverSessionChange);
    return () => window.removeEventListener('uppa-driver-session-updated', handleDriverSessionChange);
  }, []);

  // Sync Firebase Auth session with App state
  useEffect(() => {
    if (authUser) {
      const isDriverMode = driverSession && driverSession.endsAt > Date.now();
      const computedRole = mapFirestoreRolToAppRole(authUser.rol, authUser.esChofer || isDriverMode || currentUser.role === 'driver');
      const synchedUser: User = {
        ...currentUser,
        id: authUser.uid || authUser.id || currentUser.id,
        uid: authUser.uid || authUser.id || currentUser.uid,
        name: authUser.nombre || authUser.name || currentUser.name,
        nombre: authUser.nombre || authUser.name || currentUser.nombre,
        email: authUser.email || currentUser.email,
        role: computedRole,
        rol: authUser.rol,
        esChofer: authUser.esChofer || computedRole === 'driver',
        tipoVehiculo: authUser.tipoVehiculo ?? currentUser.tipoVehiculo ?? (authUser.rol === 'chofer_moto' ? 'moto' : authUser.rol === 'chofer_auto' ? 'auto' : null),
        estado: authUser.estado,
        fechaRegistro: authUser.fechaRegistro,
        barrio: authUser.barrio || currentUser.barrio,
        phone: authUser.phone || currentUser.phone,
        avatarUrl: authUser.avatarUrl || currentUser.avatarUrl,
        emailVerificado: authUser.emailVerificado ?? isEmailVerified,
      };
      setCurrentUser(synchedUser);
      setIsLoggedIn(true);
      try {
        localStorage.setItem('uppa_session_user', JSON.stringify(synchedUser));
      } catch {}
    } else if (!isAuthLoading) {
      try {
        const stored = localStorage.getItem('uppa_session_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email && !parsed.email.includes('guest')) {
            setCurrentUser(parsed);
            setIsLoggedIn(true);
            return;
          }
        }
      } catch {}
      setIsLoggedIn(false);
    }
  }, [authUser, isAuthLoading, isEmailVerified]);

  // Global State
  const [routes, setRoutes] = useState<TransitRoute[]>(MOCK_ROUTES);
  const [events, setEvents] = useState<MapEvent[]>([]);
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>(MOCK_LIVE_BUSES);
  // Prestadores de Servicio Habilitados 100% Reales (sin datos simulados)
  const [taxis, setTaxis] = useState<TaxiListing[]>([]);
  const [payments, setPayments] = useState<PaymentProof[]>(MOCK_PAYMENTS);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  // Publicidades estrictamente reales en el banner (Rotisería Malvinas y Nexo Art)
  const [ads, setAds] = useState<AdListing[]>(() =>
    MOCK_ADS.filter((a) => a.id === 'ad-rotiseria-malvinas' || a.id === 'ad-nexo-art')
  );

  // User & Driver Geolocation state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDriverOnline, setIsDriverOnline] = useState(true);

  // Habilitaciones de Choferes gestionadas por el Administrador UPPA (en tiempo real)
  const [habilitacionesList, setHabilitacionesList] = useState<HabilitacionChofer[]>(() =>
    obtenerHabilitacionesActuales()
  );

  useEffect(() => {
    const unsub = subscribeToHabilitacionesChofer((list) => {
      setHabilitacionesList(list);
    });
    return () => unsub();
  }, []);

  // Habilitación específica del usuario actual (validación estricta por UID cuando existe)
  const userHabilitacionRecord = useMemo(() => {
    return (
      habilitacionesList.find((h) => {
        const uidMatch =
          (currentUser.id && h.driverId === currentUser.id) ||
          (currentUser.uid && h.driverId === currentUser.uid);
        if (uidMatch) return true;

        const hasDistinctRealUid =
          Boolean(h.driverId) &&
          !h.driverId.startsWith('drv-') &&
          !h.driverId.startsWith('usr-driver-') &&
          !h.driverId.startsWith('usr-');
        if (hasDistinctRealUid && (currentUser.uid || currentUser.id)) {
          return false;
        }

        const matchName =
          currentUser.name &&
          h.driverName &&
          h.driverName.trim().toLowerCase() === currentUser.name.trim().toLowerCase();
        const cleanPhone = currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '';
        const matchPhone =
          cleanPhone.length >= 6 &&
          h.whatsapp &&
          h.whatsapp.replace(/\D/g, '').includes(cleanPhone);
        return Boolean(matchName || matchPhone);
      }) || null
    );
  }, [habilitacionesList, currentUser]);

  // Verificar si el usuario es prestador de servicio (chofer registrado o con solicitud de servicio)
  const isDriverUser = useMemo(() => {
    // Si el usuario es pasajero o administrador, NUNCA debe ver herramientas de conductor
    if (
      currentUser.role === 'passenger' ||
      currentUser.role === 'admin' ||
      currentUser.rol === 'pasajero' ||
      currentUser.rol === 'administrador'
    ) {
      if (!currentUser.esChofer && currentUser.rol !== 'chofer_moto' && currentUser.rol !== 'chofer_auto') {
        return false;
      }
    }
    const hasDriverRole = Boolean(
      currentUser.esChofer ||
      currentUser.rol === 'chofer_moto' ||
      currentUser.rol === 'chofer_auto' ||
      currentUser.role === 'driver'
    );
    const hasDriverHabilitacion = Boolean(userHabilitacionRecord && userHabilitacionRecord.estado === 'activo');
    return hasDriverRole && hasDriverHabilitacion;
  }, [currentUser, userHabilitacionRecord]);

  // HABILITADO POR EL ADMINISTRADOR:
  // Condición lógica indispensable: Solo aparece como habilitado cuando el Administrador
  // valida y completa su habilitación con la clave autorizada en Administración UPPA,
  // y mientras esté dentro del período de tiempo abonado (endsAt > now).
  const isDriverHabilitado = useMemo(() => {
    if (!isDriverUser) return false;
    const now = Date.now();

    // 1. Verificación primaria: Registro de Habilitación aprobado por el Administrador
    if (userHabilitacionRecord) {
      const isActivo = userHabilitacionRecord.estado === 'activo';
      const isApprovedByAdmin = Boolean(
        userHabilitacionRecord.activadoConClaveAdmin || userHabilitacionRecord.habilitadoPor
      );
      const isWithinTime = (userHabilitacionRecord.endsAt || 0) > now;
      return isActivo && isApprovedByAdmin && isWithinTime;
    }

    // 2. Si tiene sesión activa de chofer, validar que esté respaldada por código y tiempo vigente
    if (driverSession && driverSession.endsAt > now && driverSession.activationCode) {
      const sessionHab = habilitacionesList.find(
        (h) =>
          h.activationCode === driverSession.activationCode ||
          (driverSession.driverName && h.driverName === driverSession.driverName)
      );
      if (sessionHab) {
        return sessionHab.estado === 'activo' && (sessionHab.endsAt || 0) > now;
      }
      return true;
    }

    return false;
  }, [isDriverUser, userHabilitacionRecord, driverSession, habilitacionesList]);

  // Conductor en línea transmitiendo GPS: SOLO si está habilitado por el administrador y tiene moto o auto
  const isPrestandoServicioTaxi = useMemo(() => {
    if (!isDriverHabilitado) return false;
    const vehicle =
      userHabilitacionRecord?.vehicleType ||
      driverSession?.vehicleType ||
      currentUser.tipoVehiculo ||
      (currentUser.rol === 'chofer_moto' ? 'moto' : 'auto');

    return vehicle === 'moto' || vehicle === 'auto';
  }, [isDriverHabilitado, userHabilitacionRecord, driverSession, currentUser]);

  // Tiempo real abonado como prestador de servicio de transporte alternativo:
  // Se calcula estrictamente a partir del registro de habilitación o sesión paga y solo mientras esté vigente (endsAt > now).
  // Sin tiempos ficticios ni valores arbitrarios por defecto.
  const driverPaidEndsAt = useMemo(() => {
    const now = Date.now();
    if (userHabilitacionRecord?.endsAt && userHabilitacionRecord.endsAt > now) {
      return userHabilitacionRecord.endsAt;
    }
    if (driverSession?.endsAt && driverSession.endsAt > now) {
      return driverSession.endsAt;
    }
    return 0;
  }, [userHabilitacionRecord, driverSession]);

  // Disponibilidad de prestador (Desocupado / Ocupado) gestionada únicamente por el titular
  const [driverDisponibilidad, setDriverDisponibilidadState] = useState<'desocupado' | 'ocupado'>('desocupado');

  useEffect(() => {
    const unsub = subscribeToDriversDisponibilidad((map) => {
      const keys = [
        currentUser?.uid,
        currentUser?.id,
        currentUser?.nombre,
        currentUser?.name,
        currentUser?.phone,
        driverSession?.driverName,
        userHabilitacionRecord?.driverId,
        userHabilitacionRecord?.driverName,
      ].filter(Boolean) as string[];

      for (const k of keys) {
        const val = map[k] || map[k.toLowerCase()];
        if (val) {
          setDriverDisponibilidadState(val);
          return;
        }
      }
      setDriverDisponibilidadState('desocupado');
    });
    return () => unsub();
  }, [currentUser, driverSession, userHabilitacionRecord]);

  const handleSetDriverDisponibilidad = async (nextState: 'desocupado' | 'ocupado') => {
    const driverId =
      userHabilitacionRecord?.driverId ||
      currentUser?.uid ||
      currentUser?.id ||
      driverSession?.driverId ||
      '';
    const driverName =
      userHabilitacionRecord?.driverName ||
      driverSession?.driverName ||
      currentUser?.nombre ||
      currentUser?.name ||
      '';

    const keys = [
      currentUser?.uid,
      currentUser?.id,
      currentUser?.nombre,
      currentUser?.name,
      currentUser?.phone,
      driverSession?.driverName,
      userHabilitacionRecord?.driverId,
      userHabilitacionRecord?.driverName,
      userHabilitacionRecord?.whatsapp,
    ].filter(Boolean) as string[];

    // Si el prestador aprieta "desocupado", finaliza automáticamente cualquier viaje en curso
    if (nextState === 'desocupado') {
      try {
        await finalizarViajeDeChofer(driverId, driverName);
      } catch (err) {
        console.warn('Error al finalizar viaje automático:', err);
      }
      setActiveTrackingPassenger(null);
    }

    keys.forEach((k) => {
      setDriverDisponibilidad(k, nextState);
    });
    setDriverDisponibilidadState(nextState);

    showToast(
      nextState === 'ocupado'
        ? '🟡 Estado: OCUPADO (En viaje activo con pasajero)'
        : '🟢 ¡Estado: DESOCUPADO! Viaje finalizado con éxito. Toda la comunidad ve que estás activo y disponible para nuevos viajes.'
    );
  };

  const handleToggleDriverDisponibilidad = () => {
    const nextState = driverDisponibilidad === 'ocupado' ? 'desocupado' : 'ocupado';
    handleSetDriverDisponibilidad(nextState);
  };

  // Escuchar cuando el prestador acepta un viaje en cualquier parte de la app
  // Active passenger tracking for driver GPS navigation
  const [activeTrackingPassenger, setActiveTrackingPassenger] = useState<SolicitudTransporteFirestore | null>(null);

  useEffect(() => {
    const handleAcceptedRide = (e: any) => {
      setDriverDisponibilidadState('ocupado');
      if (e?.detail?.solicitud) {
        setActiveTrackingPassenger(e.detail.solicitud);
        setActiveTab('map');
      }
    };
    window.addEventListener('uppa-driver-accepted-ride', handleAcceptedRide);
    return () => window.removeEventListener('uppa-driver-accepted-ride', handleAcceptedRide);
  }, []);

  useEffect(() => {
    const handleViajeFinalizado = () => {
      setActiveTrackingPassenger(null);
      setDriverDisponibilidadState('desocupado');
    };
    window.addEventListener('uppa-viaje-finalizado', handleViajeFinalizado);
    return () => window.removeEventListener('uppa-viaje-finalizado', handleViajeFinalizado);
  }, []);

  // Active View / Tabs
  const [activeTab, setActiveTab] = useState<'map' | 'taxi' | 'chat' | 'admin'>('map');
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-zarate-malvinas');
  const [activeTrackingTaxi, setActiveTrackingTaxi] = useState<TaxiListing | null>(null);
  const [focusedStopOnMap, setFocusedStopOnMap] = useState<Linea228Stop | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Menú Desplegable del Perfil (con control directo de Ocupado/Desocupado para el prestador)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isHabilitacionCardExpanded, setIsHabilitacionCardExpanded] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPedirTransporteOpen, setIsPedirTransporteOpen] = useState(false);
  const [isPublishTaxiOpen, setIsPublishTaxiOpen] = useState(false);
  const [publishTaxiInitialTab, setPublishTaxiInitialTab] = useState<'transfer' | 'enter-code'>('transfer');
  const [isContactAdOpen, setIsContactAdOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contextEventForChat, setContextEventForChat] = useState<MapEvent | null>(null);
  const [communityChatList, setCommunityChatList] = useState<MensajeChatFirestore[]>([]);
  const [dismissedChatMsgId, setDismissedChatMsgId] = useState<string | null>(null);

  // Eventos Push en Pantalla (Deduplicación & Exposición de 15 Minutos)
  const [screenPushEvents, setScreenPushEvents] = useState<PushNotificationPayload[]>([]);

  // Cerrar menú de 3 puntos y desplegable de perfil al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isHeaderMenuOpen || isProfileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHeaderMenuOpen, isProfileDropdownOpen]);

  // Limpieza periódica de eventos push en pantalla tras 20 segundos de exposición (no 15 minutos)
  useEffect(() => {
    const cleaner = setInterval(() => {
      const now = Date.now();
      setScreenPushEvents((prev) => prev.filter((ev) => (ev.exposureExpiresAt || 0) > now));
    }, 1000);
    return () => clearInterval(cleaner);
  }, []);

  // Subscribe to real-time Firestore reports and push notifications
  useEffect(() => {
    const unsubReportes = subscribeToReportes((reps) => {
      const realReports = (reps || []).filter(isRealCommunityReport);
      if (realReports && realReports.length > 0) {
        const mapped: MapEvent[] = realReports.map((r) => {
          let evType: MapEvent['type'] = 'late';
          if (r.tipo === 'ubicacion_colectivo') evType = 'bus_location';
          else if (r.tipo === 'accidente') evType = 'accident';
          else if (r.tipo === 'demora') evType = 'late';
          else if (r.tipo === 'congestion') evType = 'traffic';
          else if (r.tipo === 'corte') evType = 'corte' as any;
          else if (r.tipo === 'control') evType = 'control' as any;
          else evType = 'danger';

          const createdMs =
            typeof r.creadoEnMs === 'number'
              ? r.creadoEnMs
              : typeof r.creadoEn === 'number'
              ? r.creadoEn
              : typeof r.creadoEn?.seconds === 'number'
              ? r.creadoEn.seconds * 1000
              : Date.now();

          const direction =
            r.sentido || (r.ruta === 'campana-zarate' ? 'hacia_zarate' : 'hacia_malvinas');

          const title =
            evType === 'bus_location'
              ? `Ubicación de colectivo ahora · ${direction === 'hacia_zarate' ? 'Hacia Zárate' : 'Hacia Malvinas'}`
              : `${r.tipo.toUpperCase()}: ${r.ruta || 'Zárate ↔ Campana'}`;

          return {
            id: r.id,
            routeId: r.ruta === 'vigalondo-mcdonalds' ? 'route-vigalondo-mcdonalds' : 'route-zarate-malvinas',
            type: evType,
            title,
            description: r.descripcion,
            lat: r.ubicacion.lat,
            lng: r.ubicacion.lng,
            reportedBy: r.nombreUsuario,
            reportedByUserId: r.usuarioId,
            confirmations: r.confirmaciones || 1,
            confirmaciones: r.confirmaciones || 1,
            confirmedByUserIds: [],
            reportedAt: 'En vivo',
            direction,
            sentido: r.sentido,
            velocidadKmH: r.velocidadKmH,
            createdAtMs: createdMs,
            expiresAtMs: evType === 'bus_location' ? createdMs + 60000 : r.expiresAtMs,
            isVerified: true,
            estado: r.estado,
          };
        });

        // Deduplicación de eventos en mapa: si se repiten en la misma zona/tipo, se toma 1
        const uniqueReportsMap = new Map<string, MapEvent>();
        mapped.forEach((ev) => {
          const key = `${ev.type}_${ev.lat.toFixed(3)}_${ev.lng.toFixed(3)}`;
          if (!uniqueReportsMap.has(key)) {
            uniqueReportsMap.set(key, ev);
          }
        });
        setEvents(Array.from(uniqueReportsMap.values()));
      } else {
        setEvents([]);
      }
    });

    const unsubHabs = subscribeToHabilitacionesChofer((habs) => {
      const now = Date.now();
      const activeHabs = habs.filter(
        (h) => h.estado === 'activo' && (!h.endsAt || h.endsAt > now)
      );
      if (activeHabs.length > 0) {
        const habTaxis: TaxiListing[] = activeHabs.map((h, i) => ({
          id: h.id,
          userId: h.driverId,
          driverName: h.driverName,
          vehicleType: h.vehicleType,
          vehicleModel: h.vehicleModel,
          patente: h.patente || '',
          whatsapp: h.whatsapp,
          zone: h.zone || 'Zárate ↔ Campana',
          lat: -34.195 + ((i % 7) * 0.006) - 0.015,
          lng: -58.945 + ((i % 5) * 0.006) - 0.012,
          hoursPaid: h.horas,
          startsAt: h.startsAt || now,
          endsAt: h.endsAt || (now + h.horas * 3600 * 1000),
          status: 'active',
          rating: typeof h.rating === 'number' ? h.rating : 0,
          completedRides: (h as any).completedRides || (h as any).viajesRealizados || 0,
          indiceSeguridad: h.indiceSeguridad,
          activationCode: h.activationCode,
          isOnline: true,
          asientos: h.asientos,
          aireAcondicionado: h.aireAcondicionado,
          baul: h.baul,
          aceptaMascotas: h.aceptaMascotas,
          cascoExtra: h.cascoExtra,
        }));
        setTaxis(habTaxis);
      } else {
        setTaxis([]);
      }
    });

    const unsubNotif = onPushNotification((notif) => {
      if (!notif) return;
      if (!isRealCommunityReport(notif)) return;
      showToast(`${notif.title}: ${notif.body}`);

      setScreenPushEvents((prev) => {
        // Regla: Si se repiten los eventos, SOLO se toma 1 de esos eventos para la pantalla
        const cleanTitle = notif.title.trim().toLowerCase();
        const cleanBody = notif.body.trim().toLowerCase();
        const isDuplicate = prev.some(
          (p) =>
            p.id === notif.id ||
            (p.title.trim().toLowerCase() === cleanTitle &&
              p.body.trim().toLowerCase() === cleanBody)
        );

        if (isDuplicate) {
          return prev; // No duplicar en pantalla
        }

        // De lo contrario, se publica con tiempo de exposición en pantalla de 20 segundos (no 15 minutos)
        const exposureExpiresAt = notif.exposureExpiresAt || Date.now() + 20 * 1000;
        return [{ ...notif, exposureExpiresAt }, ...prev];
      });
    });

    const unsubChat = subscribeToChat('todos', (msgs) => {
      setCommunityChatList(msgs);
    });

    return () => {
      unsubReportes();
      unsubHabs();
      unsubNotif();
      unsubChat();
    };
  }, []);

  const watchIdRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const latestCommunityMessage = communityChatList.length > 0 ? communityChatList[communityChatList.length - 1] : null;

  const sentiment = computeLineSentiment(messages, events);

  // Simulated live buses movement
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveBuses((prev) =>
        prev.map((bus) => {
          const latDelta = (Math.random() - 0.48) * 0.0012;
          const lngDelta = (Math.random() - 0.48) * 0.0012;
          const newEta = Math.max(1, bus.etaMinutes + (Math.random() > 0.7 ? -1 : 0));
          return {
            ...bus,
            lat: bus.lat + latDelta,
            lng: bus.lng + lngDelta,
            etaMinutes: newEta,
          };
        })
      );
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Continuous GPS Watcher - Available freely for all users without login
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        recordGpsSample({ latitude, longitude, speed, accuracy });
        const address = await reverseGeocode(latitude, longitude);

        setUserLocation((prev) => ({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 12,
          speed: speed || prev?.speed || 0,
          heading: heading || 0,
          address,
          timestamp: Date.now(),
          isSimulated: false,
        }));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Sync Driver GPS to Marketplace with activation code and countdown timer
  useEffect(() => {
    if (isPrestandoServicioTaxi && isDriverOnline) {
      const activeId = driverSession?.driverId || `tx-driver-${currentUser.id}`;
      const activeName = driverSession?.driverName || currentUser.nombre || currentUser.name;
      const activeType = ((driverSession?.vehicleType || currentUser.tipoVehiculo || (currentUser.rol === 'chofer_moto' ? 'moto' : 'auto')) === 'moto' ? 'moto' : 'auto') as 'auto' | 'moto';
      const activeModel =
        driverSession?.vehicleModel ||
        (activeType === 'moto' ? 'Moto Taxi en Línea' : 'Auto Taxi en Línea');
      const activeWhatsapp =
        driverSession?.whatsapp ||
        (currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '5493487552190');
      const activeEndsAt = driverSession?.endsAt || Date.now() + 12 * 3600 * 1000;
      const activeHours = driverSession?.hoursPaid || 12;
      const activeLat = userLocation ? userLocation.lat : -34.1914;
      const activeLng = userLocation ? userLocation.lng : -58.9447;
      const activeZone = userLocation?.address || driverSession?.zone || 'Zárate ↔ Campana';

      setTaxis((prev) => {
        const existingIdx = prev.findIndex(
          (t) => t.userId === activeId || (driverSession && t.activationCode === driverSession.activationCode)
        );
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            driverName: activeName,
            vehicleType: activeType,
            vehicleModel: activeModel,
            whatsapp: activeWhatsapp,
            lat: activeLat,
            lng: activeLng,
            zone: activeZone,
            endsAt: activeEndsAt,
            status: 'active',
            activationCode: driverSession?.activationCode,
          };
          return copy;
        } else {
          const newListing: TaxiListing = {
            id: activeId,
            userId: activeId,
            driverName: activeName,
            vehicleType: activeType,
            vehicleModel: activeModel,
            whatsapp: activeWhatsapp,
            zone: activeZone,
            lat: activeLat,
            lng: activeLng,
            hoursPaid: activeHours,
            startsAt: driverSession?.startsAt || Date.now(),
            endsAt: activeEndsAt,
            status: 'active',
            rating: typeof userHabilitacionRecord?.rating === 'number' ? userHabilitacionRecord.rating : 0,
            completedRides: (userHabilitacionRecord as any)?.completedRides || 0,
            activationCode: driverSession?.activationCode,
          };
          return [newListing, ...prev];
        }
      });
    }
  }, [userLocation, currentUser, driverSession, isDriverOnline, userHabilitacionRecord, isPrestandoServicioTaxi]);

  const handleLocationGranted = (loc: UserLocation) => {
    setUserLocation(loc);
    setIsLocationModalOpen(false);

    if (loc.address) {
      setCurrentUser((prev) => ({ ...prev, barrio: loc.address }));
    }
    showToast(`GPS Activo: ${loc.address}`);
  };

  const handleConfirmEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const alreadyConfirmed = ev.confirmedByUserIds.includes(currentUser.id);
          const newIds = alreadyConfirmed
            ? ev.confirmedByUserIds.filter((id) => id !== currentUser.id)
            : [...ev.confirmedByUserIds, currentUser.id];
          return {
            ...ev,
            confirmations: alreadyConfirmed ? ev.confirmations - 1 : ev.confirmations + 1,
            confirmedByUserIds: newIds,
          };
        }
        return ev;
      })
    );
    showToast('+1 Confirmado');
  };

  const handleReportFalseEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    setSelectedEvent(null);
    showToast('Reporte ocultado');
  };

  const handleCreateEvent = (newEventData: Omit<MapEvent, 'id' | 'confirmations' | 'confirmedByUserIds' | 'reportedAt'>) => {
    const now = Date.now();
    const created: MapEvent = {
      ...newEventData,
      id: `ev-${now}`,
      confirmations: 1,
      confirmedByUserIds: [currentUser.id],
      reportedAt: 'Recién',
      createdAtMs: newEventData.createdAtMs || now,
      expiresAtMs: newEventData.type === 'bus_location' ? now + 60000 : newEventData.expiresAtMs,
    };
    setEvents((prev) => [created, ...prev]);
    setSelectedEvent(created);
    setActiveTab('map');

    if (newEventData.type === 'bus_location') {
      const dirText = newEventData.direction === 'hacia_zarate' ? 'Hacia Zárate' : 'Hacia Malvinas';
      const speedText = newEventData.velocidadKmH ? ` · ${newEventData.velocidadKmH} km/h` : '';
      showToast(`📍 Ubicación de colectivo ahora (${dirText}${speedText}) registrada`);
    } else {
      showToast(`✅ ${created.title} registrado en el mapa`);
    }

    const firestoreType: any =
      newEventData.type === 'bus_location'
        ? 'ubicacion_colectivo'
        : newEventData.type === 'accident'
        ? 'accidente'
        : newEventData.type === 'late'
        ? 'demora'
        : newEventData.type === 'traffic'
        ? 'congestion'
        : newEventData.type === 'control'
        ? 'control'
        : newEventData.type === 'corte' || newEventData.type === 'danger'
        ? 'corte'
        : 'alerta';

    crearReporte({
      usuarioId: currentUser.id || 'usr-anon',
      nombreUsuario: currentUser.name || 'Vecino UPPA',
      tipo: firestoreType,
      descripcion: newEventData.description || newEventData.title,
      ubicacion: { lat: newEventData.lat, lng: newEventData.lng },
      ruta: newEventData.routeId === 'route-vigalondo-mcdonalds' ? 'vigalondo-mcdonalds' : 'campana-zarate',
      sentido: newEventData.direction === 'hacia_zarate' ? 'hacia_zarate' : 'hacia_malvinas',
      velocidadKmH: newEventData.velocidadKmH,
    }).catch((err) => console.warn('Firestore report write notice:', err));

    // Publicar automáticamente el evento en el chat comunitario en tiempo real
    const eventChatText =
      newEventData.type === 'bus_location'
        ? `📍 [UBICACIÓN COLECTIVO AHORA] Colectivo reportado por ${currentUser.name}: ${
            newEventData.direction === 'hacia_zarate' ? '➡️ Hacia Zárate' : '⬅️ Hacia Malvinas'
          }${newEventData.velocidadKmH ? ` · Velocidad: ${newEventData.velocidadKmH} km/h` : ''}. Visible en el mapa.`
        : `📢 [EVENTO EN VIVO] ${created.title}: ${created.description || created.title}. Reportado por ${currentUser.name}. Ya plasmado en el mapa.`;

    enviarMensajeChat('todos', {
      usuarioId: currentUser.id || 'sistema-alertas',
      nombreUsuario: currentUser.name || 'Vecino UPPA',
      texto: eventChatText,
      rol: currentUser.role || 'pasajero',
      avatarUrl: currentUser.avatarUrl,
    }).catch((err) => console.warn('Chat auto-event broadcast notice:', err));

    const chatNoticeMsg: ChatMessage = {
      id: `msg-ev-${now}`,
      channel: 'general',
      userId: currentUser.id || 'usr-auto',
      userName: currentUser.name || 'Alerta Comunitaria',
      content: eventChatText,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      sentiment: 'neutral',
      mapEventId: created.id,
    };
    setMessages((prev) => [...prev, chatNoticeMsg]);
  };

  // Prestadores de Servicio Habilitados por el Administrador UPPA (Tiempo Real)
  // Solo se visualizan los prestadores cuya habilitación fue aprobada por el Administrador
  // y que están dentro de su tiempo abonado (endsAt > now).
  const marketplaceTaxis = useMemo(() => {
    const now = Date.now();
    const result: TaxiListing[] = [];
    const seen = new Set<string>();

    // 1. Prestadores habilitados por el Administrador en 'habilitaciones'
    habilitacionesList.forEach((hab, idx) => {
      const isActivo = hab.estado === 'activo';
      const isApprovedByAdmin = Boolean(hab.activadoConClaveAdmin || hab.habilitadoPor);
      const isWithinTime = (hab.endsAt || 0) > now;

      if (isActivo && isApprovedByAdmin && isWithinTime) {
        const keyName = hab.driverName.trim().toLowerCase();
        seen.add(keyName);
        if (hab.whatsapp) seen.add(hab.whatsapp.replace(/\D/g, ''));
        if (hab.activationCode) seen.add(hab.activationCode.toUpperCase());

        const isViewerThisDriver = Boolean(
          (currentUser.id && hab.driverId === currentUser.id) ||
          (currentUser.uid && hab.driverId === currentUser.uid)
        );
        const detLat = -34.175 + ((idx % 7) - 3) * 0.0055;
        const detLng = -58.965 + ((idx % 5) - 2) * 0.0055;

        result.push({
          id: hab.id,
          userId: hab.driverId || hab.id,
          driverName: hab.driverName,
          vehicleType: hab.vehicleType,
          vehicleModel: hab.vehicleModel,
          patente: hab.patente || '',
          whatsapp: hab.whatsapp,
          zone: hab.zone || 'Zárate ↔ Campana',
          lat: isViewerThisDriver && userLocation ? userLocation.lat : detLat,
          lng: isViewerThisDriver && userLocation ? userLocation.lng : detLng,
          hoursPaid: hab.horas || 12,
          startsAt: hab.startsAt || now,
          endsAt: hab.endsAt || now + 12 * 3600 * 1000,
          status: 'active',
          rating: typeof hab.rating === 'number' ? hab.rating : 0,
          completedRides: (hab as any).completedRides || (hab as any).viajesRealizados || 0,
          indiceSeguridad: hab.indiceSeguridad,
          activationCode: hab.activationCode,
          asientos: hab.asientos,
          aireAcondicionado: hab.aireAcondicionado,
          baul: hab.baul,
          aceptaMascotas: hab.aceptaMascotas,
          cascoExtra: hab.cascoExtra,
        });
      }
    });

    // 2. Si el conductor actual tiene sesión activa habilitada con código y tiempo vigente
    if (driverSession && driverSession.endsAt > now) {
      const sName = (driverSession.driverName || currentUser.name || '').trim().toLowerCase();
      if (!seen.has(sName)) {
        seen.add(sName);
        result.push({
          id: driverSession.driverId || `session-${currentUser.id}`,
          userId: driverSession.driverId || currentUser.id,
          driverName: driverSession.driverName || currentUser.name,
          vehicleType: driverSession.vehicleType || 'auto',
          vehicleModel: driverSession.vehicleModel || 'Vehículo Habilitado',
          patente: (driverSession as any).patente || '',
          whatsapp: driverSession.whatsapp || (currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '5493487552190'),
          zone: driverSession.zone || userLocation?.address || 'Zárate ↔ Campana',
          lat: userLocation ? userLocation.lat : -34.1914,
          lng: userLocation ? userLocation.lng : -58.9447,
          hoursPaid: driverSession.hoursPaid || 12,
          startsAt: driverSession.startsAt || now,
          endsAt: driverSession.endsAt,
          status: 'active',
          rating: typeof (driverSession as any).rating === 'number' ? (driverSession as any).rating : 0,
          completedRides: (driverSession as any).completedRides || 0,
          indiceSeguridad: (driverSession as any).indiceSeguridad,
          activationCode: driverSession.activationCode,
          asientos: (driverSession as any).asientos,
          aireAcondicionado: (driverSession as any).aireAcondicionado,
          baul: (driverSession as any).baul,
          aceptaMascotas: (driverSession as any).aceptaMascotas,
          cascoExtra: (driverSession as any).cascoExtra,
        });
      }
    }

    // Solo se devuelven los prestadores de servicio 100% reales habilitados por el Administrador
    return result;
  }, [habilitacionesList, driverSession, currentUser, userLocation]);

  const handlePublishTaxi = (
    listingData: Omit<TaxiListing, 'id' | 'startsAt' | 'endsAt' | 'status' | 'rating' | 'completedRides'>,
    paymentData: Omit<PaymentProof, 'id' | 'createdAt' | 'status'>
  ) => {
    const paymentId = `pay-${Date.now()}`;
    const newPayment: PaymentProof = {
      ...paymentData,
      id: paymentId,
      status: 'pending',
      createdAt: 'Recién',
    };

    setPayments((prev) => [newPayment, ...prev]);
    setActiveTab('taxi');
    showToast(`Solicitud de ${listingData.driverName} enviada a Administración UPPA (Pendiente de Habilitación)`);
  };

  const handleSendMessage = (channel: ChatMessage['channel'], text: string) => {
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channel,
      userId: currentUser.id,
      userName: currentUser.name,
      content: text,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      sentiment: text.toLowerCase().includes('demora') || text.toLowerCase().includes('tarde') ? 'negative' : 'neutral',
      mapEventId: contextEventForChat?.id,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleApprovePayment = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: 'approved', approvedAt: 'Recién' } : p))
    );
    showToast('Pago luciaveronicag aprobado');
  };

  const handleRejectPayment = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: 'rejected' } : p))
    );
    showToast('Pago rechazado');
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    showToast('Evento eliminado');
  };

  const handleVerifyEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, isVerified: true } : e))
    );
    showToast('Evento verificado');
  };

  const handleToggleAd = (adId: string) => {
    setAds((prev) =>
      prev.map((a) => (a.id === adId ? { ...a, isActive: !a.isActive } : a))
    );
  };

  const handleBroadcastAlert = (title: string, description: string) => {
    const broadcastEvent: MapEvent = {
      id: `ev-broadcast-${Date.now()}`,
      routeId: 'route-zarate-malvinas',
      type: 'danger',
      title,
      description,
      lat: userLocation ? userLocation.lat : -34.1683,
      lng: userLocation ? userLocation.lng : -58.9592,
      reportedBy: 'Admin UPPA',
      reportedByUserId: 'usr-admin',
      confirmations: 30,
      confirmedByUserIds: [],
      reportedAt: 'Alerta Oficial',
      isVerified: true,
    };
    setEvents([broadcastEvent, ...events]);
    setSelectedEvent(broadcastEvent);
    showToast('Alerta transmitida');
  };

  const handleOpenContextualChat = (event: MapEvent) => {
    setContextEventForChat(event);
    setActiveTab('chat');
  };

  // Pantalla de Carga Inicial con Logo Oficial UPPA
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Si Firebase Auth está inicializando la verificación de sesión
  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full bg-[#101114] flex flex-col items-center justify-center text-white font-sans">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF19A] border-2 border-[#101114] shadow-[4px_4px_0px_#202329] flex items-center justify-center font-black text-[#101114] font-display text-2xl">
          U
        </div>
        <p className="mt-4 text-xs font-bold text-[#FFF19A]">Conectando con Firebase Authentication...</p>
        <span className="text-[11px] text-[#9299A5] font-mono mt-1">UPPA · Zárate ↔ Campana</span>
      </div>
    );
  }

  // Autenticación Requerida al Inicio para acceder a todas las funcionalidades
  if (!isLoggedIn) {
    return (
      <>
        <GlobalHoverTooltip />
        <LoginPage
          onLogin={(user) => {
            try {
              localStorage.setItem('uppa_session_user', JSON.stringify(user));
            } catch {}
            setCurrentUser(user);
            setIsLoggedIn(true);
            setIsLocationModalOpen(true);
            showToast(`¡Bienvenido a UPPA, ${user.name}!`);
          }}
          onExploreGuest={() => {
            showToast('La autenticación es obligatoria para acceder a las funcionalidades');
          }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#101114] text-white overflow-hidden font-sans">
      <GlobalHoverTooltip />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#202329] border-2 border-[#FFF19A] px-4 py-2.5 rounded-xl shadow-[3px_3px_0px_#101114] text-xs font-bold flex items-center gap-2 text-white animate-in fade-in duration-200 max-w-[92vw]">
          <Sparkles className="w-4 h-4 text-[#FFF19A] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Eventos Push en Pantalla */}
      {screenPushEvents.length > 0 && (
        <aside aria-label="Eventos en tiempo real" className="fixed top-16 right-3 sm:right-6 z-40 max-w-sm w-[calc(100vw-1.5rem)] sm:w-88 space-y-2 pointer-events-none">
          {screenPushEvents.slice(0, 4).map((ev) => {
            const remainingSec = Math.max(0, Math.floor(((ev.exposureExpiresAt || 0) - Date.now()) / 1000));
            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            const formattedTime = `${min}:${sec.toString().padStart(2, '0')}`;

            const badgeBg =
              ev.type === 'reporte'
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : ev.type === 'transporte'
                ? 'bg-[#B7F36B]/15 border-[#B7F36B]/60 text-[#B7F36B]'
                : ev.type === 'admin'
                ? 'bg-[#FFF19A]/15 border-[#FFF19A]/60 text-[#FFF19A]'
                : 'bg-[#101114] border-white/20 text-white';

            const icon =
              ev.type === 'reporte'
                ? '💥'
                : ev.type === 'transporte'
                ? '🚕'
                : ev.type === 'admin'
                ? '🛡️'
                : '💬';

            return (
              <div
                key={ev.id}
                className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#101114] pointer-events-auto space-y-2 animate-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{icon}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${badgeBg}`}>
                      {ev.type}
                    </span>
                    <h4 className="text-xs font-extrabold text-white line-clamp-1">{ev.title}</h4>
                  </div>
                  <button
                    onClick={() => setScreenPushEvents((prev) => prev.filter((p) => p.id !== ev.id))}
                    className="text-[#9299A5] hover:text-white p-1.5 rounded-lg bg-[#101114] border border-white/10 cursor-pointer shrink-0"
                    title="Cerrar notificación en pantalla"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-[#9299A5] leading-snug">{ev.body}</p>

                <div className="flex items-center justify-between text-[10px] text-[#9299A5] pt-1.5 border-t border-white/10 font-mono">
                  <span className="flex items-center gap-1 text-[#FFF19A] font-bold">
                    <Clock className="w-3 h-3 text-[#FFF19A]" />
                    <span>Exposición: {formattedTime}</span>
                  </span>
                  <span className="text-[9px] text-[#9299A5]">Aviso en vivo</span>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Alerta / Recordatorio de email pendiente de autenticar */}
      {isLoggedIn && !isEmailVerified && authUser?.email && !authUser.email.includes('guest') && (
        <div className="bg-[#202329] border-b border-[#FFF19A]/40 px-3 py-1.5 flex items-center justify-between text-xs text-white z-40">
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
            <span className="truncate text-[#9299A5]">
              Correo <strong className="text-white">{authUser.email}</strong> pendiente de autenticación.
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            title="Abrir ventana para verificar o reenviar el correo de autenticación"
            className="text-[11px] font-black text-[#FFF19A] hover:underline cursor-pointer shrink-0 ml-2 px-2 py-1 rounded-md"
          >
            Verificar Mail
          </button>
        </div>
      )}

      {/* Top Navigation Header — Luxury Dark Minimalist Automotive */}
      <header className="h-14 px-3 sm:px-4 bg-[#101114] border-b border-white/15 flex items-center justify-between shrink-0 z-30">
        {/* Brand: Solo el texto UPPA sin icono */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('map')}
            title="Ir a la vista principal del Mapa en vivo"
            className="flex items-center min-h-[44px] px-1 cursor-pointer active:scale-95 transition-transform"
          >
            <span className="text-xl font-black tracking-widest text-white font-display">
              UPPA
            </span>
          </button>
        </div>

        {/* Route status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#202329] border border-white/15 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#B7F36B]" />
          <span className="font-extrabold text-white">Línea 228</span>
          <span className="text-[10px] text-[#9299A5] font-semibold font-mono">En Vivo</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Menú de 3 puntos: Prestar Servicio / Pedir Transporte Alternativo */}
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              className="h-11 w-11 rounded-xl bg-[#202329] border border-white/15 hover:border-[#FFF19A]/60 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
              title="Más opciones: Prestar Servicio o Pedir Transporte Alternativo"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isHeaderMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-68 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#101114] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                <button
                  onClick={() => {
                    setPublishTaxiInitialTab('transfer');
                    setIsPublishTaxiOpen(true);
                    setIsHeaderMenuOpen(false);
                  }}
                  title="Registrarme como chofer de auto o moto en UPPA"
                  className="w-full min-h-[44px] text-left px-3 py-2.5 rounded-xl text-xs font-black text-[#101114] bg-[#B7F36B] hover:brightness-95 border border-[#101114] flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-0.5">
                    <Bike className="w-4 h-4 text-[#101114]" />
                    <Car className="w-4 h-4 text-[#101114]" />
                  </div>
                  <span>Prestar Servicio</span>
                </button>

                <button
                  onClick={() => {
                    setIsPedirTransporteOpen(true);
                    setIsHeaderMenuOpen(false);
                  }}
                  title="Solicitar un auto o moto para que te pase a buscar"
                  className="w-full min-h-[44px] text-left px-3 py-2.5 rounded-xl text-xs font-black text-[#101114] bg-[#FFF19A] hover:brightness-95 border border-[#101114] flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-[#101114] text-[#101114]" />
                  <span>Pedir Transporte Alternativo</span>
                </button>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                className={`relative min-h-[44px] px-3 py-1.5 rounded-xl text-xs cursor-pointer flex items-center gap-2 transition-all border ${
                  isDriverUser && isDriverHabilitado
                    ? driverDisponibilidad === 'ocupado'
                      ? 'bg-[#202329] border-[#FFF19A] text-[#FFF19A]'
                      : 'bg-[#202329] border-[#B7F36B] text-[#B7F36B]'
                    : 'bg-[#202329] border-white/15 hover:border-white/30 text-white'
                }`}
                title={
                  isDriverUser
                    ? isDriverHabilitado
                      ? driverDisponibilidad === 'ocupado'
                        ? `Mi Perfil: ${currentUser.name} (EN VIAJE - Abrir menú para cambiar a Desocupado)`
                        : `Mi Perfil: ${currentUser.name} (Chofer Habilitado - Disponible)`
                      : `Mi Perfil: ${currentUser.name} (Chofer Pendiente de Habilitación)`
                    : `Mi Perfil y opciones de cuenta: ${currentUser.name}`
                }
              >
                {/* Indicador: SOLO para prestador de servicio habilitado */}
                {isDriverUser && isDriverHabilitado ? (
                  driverDisponibilidad === 'ocupado' ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFF19A] opacity-80" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFF19A]" />
                    </span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B]" />
                  )
                ) : (
                  <span className="text-sm">
                    {currentUser.role === 'admin' || isFirebaseAdmin || currentUser.rol === 'administrador'
                      ? '🛡️'
                      : currentUser.role === 'driver' || driverSession
                      ? '🚕'
                      : '👤'}
                  </span>
                )}

                <span className="text-xs font-extrabold text-white max-w-[110px] truncate hidden md:inline">
                  {currentUser.name}
                </span>

                {/* Badge en el botón del perfil (Solo para el prestador) */}
                {isDriverUser && isDriverHabilitado && (
                  driverDisponibilidad === 'ocupado' ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#101114] hidden sm:inline px-2 py-0.5 rounded-md bg-[#FFF19A]">
                      ACTIVO
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#101114] hidden sm:inline px-2 py-0.5 rounded-md bg-[#B7F36B]">
                      DESOCUPADO
                    </span>
                  )
                )}

                {isDriverUser && !isDriverHabilitado && (
                  <span className="text-[10px] font-bold text-[#FFF19A] hidden sm:inline px-1.5 py-0.5 rounded bg-[#101114] border border-[#FFF19A]/40">
                    Pendiente
                  </span>
                )}

                <ChevronDown className="w-3.5 h-3.5 text-[#9299A5] shrink-0" />
              </button>

              {/* Menú Desplegable del Perfil */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#101114] p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                  {/* Encabezado con datos del usuario */}
                  <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-[#101114] border border-white/15 flex items-center justify-center text-lg shrink-0">
                      {currentUser.role === 'admin'
                        ? '🛡️'
                        : isDriverUser
                        ? currentUser.tipoVehiculo === 'moto'
                          ? '🏍️'
                          : '🚕'
                        : '👤'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-white truncate">
                        {currentUser.name || 'Mi Perfil'}
                      </p>
                      <p className="text-[11px] text-[#9299A5] truncate font-mono">
                        {currentUser.email || 'Sin correo registrado'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            isDriverUser
                              ? isDriverHabilitado
                                ? driverDisponibilidad === 'ocupado'
                                  ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                                  : 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                                : 'bg-[#101114] text-[#FFF19A] border-[#FFF19A]/40'
                              : 'bg-[#101114] text-white border-white/15'
                          }`}
                        >
                          {isDriverUser
                            ? isDriverHabilitado
                              ? driverDisponibilidad === 'ocupado'
                                ? 'ACTIVO (En Viaje)'
                                : 'Habilitado (Disponible)'
                              : 'Chofer Pendiente'
                            : 'Pasajero'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sección para Prestador Pendiente de Habilitación con Desplegable */}
                  {isDriverUser && !isDriverHabilitado && (
                    <div className="p-3 rounded-xl bg-[#101114] border border-[#FFF19A]/40 space-y-2 text-left">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] font-black text-[#FFF19A] uppercase tracking-wide flex items-center gap-1.5 min-w-0 truncate">
                          <KeyRound className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
                          <span>Habilitación de Chofer</span>
                        </span>
                        <span className="text-[9px] font-bold text-[#101114] bg-[#FFF19A] px-1.5 py-0.5 rounded shrink-0">
                          Pendiente
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsHabilitacionCardExpanded((prev) => !prev)}
                        title={isHabilitacionCardExpanded ? 'Contraer información de habilitación' : 'Expandir información de habilitación del administrador'}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#202329] hover:border-[#FFF19A] border border-white/15 text-white text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>{isHabilitacionCardExpanded ? 'Ocultar información' : 'Ver información de habilitación'}</span>
                        {isHabilitacionCardExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#FFF19A]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#FFF19A]" />
                        )}
                      </button>

                      {isHabilitacionCardExpanded && (
                        <div className="pt-2 space-y-2 border-t border-white/10 animate-in fade-in duration-200">
                          <div className="text-[11px] font-bold text-white">
                            Habilitación por Administrador
                          </div>
                          <p className="text-[10.5px] text-[#9299A5] leading-relaxed">
                            Para figurar como Habilitado en la plataforma, el Administrador debe validar tu comprobante de transferencia y activar tu unidad. En ese momento comenzará tu temporizador en vivo.
                          </p>
                          <a
                            href={`https://wa.me/5493489690058?text=${encodeURIComponent(
                              `Hola Lucia Veronica Gimenez! Te contacto por la habilitación de mi servicio de chofer (${currentUser.name || 'Prestador UPPA'}).`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Enviar mensaje por WhatsApp al Administrador UPPA"
                            className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Contactar Administrador (3489690058)</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sección Exclusiva para Prestadores de Servicio Habilitados */}
                  {isDriverUser && isDriverHabilitado && (
                    <div className="p-3 rounded-xl bg-[#101114] border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white">
                          Disponibilidad de Servicio
                        </span>
                        {driverDisponibilidad === 'ocupado' ? (
                          <span className="text-[10px] font-black text-[#101114] bg-[#FFF19A] px-2 py-0.5 rounded flex items-center gap-1">
                            OCUPADO
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-[#101114] bg-[#B7F36B] px-2 py-0.5 rounded flex items-center gap-1">
                            DESOCUPADO
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10.5px] text-[#9299A5] block mb-1">
                          Desplegable de estado:
                        </label>
                        <select
                          value={driverDisponibilidad}
                          onChange={(e) => {
                            handleSetDriverDisponibilidad(e.target.value as 'desocupado' | 'ocupado');
                          }}
                          className="w-full min-h-[44px] bg-[#202329] border border-white/15 hover:border-[#FFF19A] rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#FFF19A] transition-colors cursor-pointer"
                        >
                          <option value="desocupado">DESOCUPADO (Disponible para la comunidad)</option>
                          <option value="ocupado">OCUPADO (En viaje activo con pasajero)</option>
                        </select>
                      </div>

                      {driverDisponibilidad === 'ocupado' ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetDriverDisponibilidad('desocupado');
                            setIsProfileDropdownOpen(false);
                          }}
                          title="Finalizar viaje activo y mostrarse disponible nuevamente"
                          className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border-2 border-[#101114] font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#101114] stroke-[2.5]" />
                          <span>Colocar DESOCUPADO (Disponible)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetDriverDisponibilidad('ocupado');
                            setIsProfileDropdownOpen(false);
                          }}
                          title="Cambiar estado a ocupado durante un viaje"
                          className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#FFF19A] hover:brightness-95 text-[#101114] border-2 border-[#101114] font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <Zap className="w-4 h-4 text-[#101114]" />
                          <span>Colocar OCUPADO (En viaje)</span>
                        </button>
                      )}

                      <p className="text-[10px] text-[#9299A5] leading-tight">
                        Al colocar <strong className="text-white">Desocupado</strong>, toda la comunidad en <em>Taxis & Motos</em> sabrá de inmediato que estás disponible.
                      </p>
                    </div>
                  )}

                  {/* Acciones generales del menú */}
                  <div className="pt-1 space-y-1.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsAuthModalOpen(true);
                      }}
                      title="Ver o editar mi información personal y preferencias de perfil"
                      className="w-full min-h-[44px] text-left px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-[#101114] border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-[#FFF19A]" />
                      <span>Mi Perfil y Datos</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setIsProfileDropdownOpen(false);
                        await firebaseLogout();
                        setIsLoggedIn(false);
                        try {
                          localStorage.removeItem('uppa_session_user');
                        } catch {}
                        showToast('Sesión cerrada');
                      }}
                      title="Cerrar sesión de forma segura en este dispositivo"
                      className="w-full min-h-[44px] text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="min-h-[44px] px-3 rounded-xl bg-[#FFF19A] text-[#101114] border-2 border-[#101114] text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Crear un perfil en Firebase y autenticar por correo"
            >
              <UserIcon className="w-4 h-4 text-[#101114]" />
              <span>Hacerse un Perfil</span>
            </button>
          )}
        </div>
      </header>

      {/* Driver GPS Status Bar with Real-time Countdown Timer - EXCLUSIVO en la sección "mapa" y SOLO para el prestador de servicio habilitado con tiempo real abonado */}
      {activeTab === 'map' && isPrestandoServicioTaxi && isDriverHabilitado && driverPaidEndsAt > Date.now() && (
        <DriverConnectionBar
          isOnline={isDriverOnline}
          onToggleOnline={() => {
            const next = !isDriverOnline;
            setIsDriverOnline(next);
            showToast(next ? 'Conductor en línea transmitiendo GPS' : 'Modo conductor pausado');
          }}
          location={userLocation}
          driverName={userHabilitacionRecord?.driverName || driverSession?.driverName || currentUser.nombre || currentUser.name}
          vehicleType={((userHabilitacionRecord?.vehicleType || driverSession?.vehicleType || currentUser.tipoVehiculo || (currentUser.rol === 'chofer_moto' ? 'moto' : 'auto')) === 'moto' ? 'moto' : 'auto')}
          endsAt={driverPaidEndsAt}
          activationCode={userHabilitacionRecord?.activationCode || driverSession?.activationCode}
          disponibilidad={driverDisponibilidad}
          onToggleDisponibilidad={handleToggleDriverDisponibilidad}
          onCenterMap={() => setActiveTab('map')}
          onOpenRenewModal={() => setIsPublishTaxiOpen(true)}
        />
      )}

      {/* Main View Area (Full screen map dominance) */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === 'map' && (
          <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 w-full h-full">
              <TeslaMap
                routes={routes}
                events={events}
                liveBuses={liveBuses}
                taxis={marketplaceTaxis}
                selectedEvent={selectedEvent}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
                onSelectTaxi={(tx) => {
                  setActiveTrackingTaxi(tx);
                  showToast(`Trayectoria con ${tx.driverName}`);
                }}
                onOpenReportModal={() => setIsReportModalOpen(true)}
                onOpenTaxisView={() => setActiveTab('taxi')}
                selectedRouteId={selectedRouteId}
                onSelectRouteId={(routeId) => setSelectedRouteId(routeId)}
                userLocation={userLocation}
                isDriverMode={isPrestandoServicioTaxi}
                isDriverOnline={isDriverOnline}
                activeTrackingTaxi={activeTrackingTaxi}
                onClearTrackingTaxi={() => setActiveTrackingTaxi(null)}
                onOpenPedirTransporte={() => setIsPedirTransporteOpen(true)}
                onAddEvent={handleCreateEvent}
                currentUserName={currentUser.name}
                currentUserId={currentUser.id}
                focusedStop={focusedStopOnMap}
                activeTrackingPassenger={activeTrackingPassenger}
                onClearTrackingPassenger={() => setActiveTrackingPassenger(null)}
              />
            </div>

            {/* Cabify-Inspired Mobility Bottom Sheet (Panel inferior con scrolling web hacia arriba) */}
            <div className="absolute bottom-2 left-0 right-0 z-30 pointer-events-none">
              <MobilityBottomSheet
                userName={currentUser.name || 'Pasajero'}
                onOpenPedirTransporte={() => setIsPedirTransporteOpen(true)}
                onOpenTaxis={() => setActiveTab('taxi')}
                onOpenPrestarServicio={() => {
                  setPublishTaxiInitialTab('transfer');
                  setIsPublishTaxiOpen(true);
                }}
                onOpenChat={() => setActiveTab('chat')}
                onSelectStop={(stop) => {
                  setFocusedStopOnMap(stop);
                  showToast(`Parada #${stop.sequence}: ${stop.name}`);
                }}
                unreadChatCount={communityChatList.length}
              />
            </div>

            <EventBottomSheet
              event={selectedEvent}
              currentUserId={currentUser.id}
              onClose={() => setSelectedEvent(null)}
              onConfirm={handleConfirmEvent}
              onReportFalse={handleReportFalseEvent}
              onOpenContextualChat={handleOpenContextualChat}
            />
          </div>
        )}

        {activeTab === 'taxi' && (
          <TaxiMarketplace
            taxis={marketplaceTaxis}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserPhone={currentUser.phone}
            currentUserRole={currentUser.role}
            isDriverHabilitado={isDriverHabilitado}
            userLocation={userLocation}
            onOpenPublishModal={(tab) => {
              setPublishTaxiInitialTab(tab || 'transfer');
              setIsPublishTaxiOpen(true);
            }}
            onSelectTaxiOnMap={(taxi) => {
              setActiveTrackingTaxi(taxi);
              setActiveTab('map');
              showToast(`Trazando trayectoria con ${taxi.driverName}`);
            }}
            onLocatePassengerOnMap={(solicitud) => {
              setActiveTrackingPassenger(solicitud);
              setActiveTab('map');
              showToast(`📍 Ubicación de ${solicitud.nombrePasajero} habilitada en GPS`);
            }}
          />
        )}

        {activeTab === 'chat' && (
          <CommunityChat
            currentUser={currentUser}
            activeContextEvent={contextEventForChat}
            onClearContextEvent={() => setContextEventForChat(null)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            events={events}
            ads={ads}
            taxis={taxis}
            onDeleteEvent={handleDeleteEvent}
            onVerifyEvent={handleVerifyEvent}
            onBroadcastAlert={handleBroadcastAlert}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Barra Flotante de Acceso Rápido al Chat Comunitario */}
      {activeTab !== 'chat' && latestCommunityMessage && latestCommunityMessage.id !== dismissedChatMsgId && (
        <div className="fixed bottom-24 sm:bottom-28 right-3 sm:right-5 max-w-[calc(100vw-24px)] sm:max-w-sm z-30 animate-in slide-in-from-bottom-3 duration-300">
          <div className="p-2.5 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/45 shadow-[4px_4px_0px_#101114] flex items-center justify-between gap-2.5 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              title="Abrir el chat comunitario en tiempo real"
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#101114] text-[#FFF19A] flex items-center justify-center shrink-0 border border-white/15">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-white text-[11px] truncate group-hover:text-[#FFF19A]">
                    {latestCommunityMessage.nombreUsuario}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-[#101114] text-[#B7F36B] border border-[#B7F36B]/40 shrink-0">
                    Comunidad
                  </span>
                </div>
                <p className="text-[11px] text-[#9299A5] truncate">
                  {latestCommunityMessage.texto}
                </p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              title="Ir directamente al chat comunitario"
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFF19A] hover:brightness-95 text-[#101114] border border-[#101114] font-black text-xs shrink-0 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Ver Chat</span>
            </button>

            <button
              onClick={() => setDismissedChatMsgId(latestCommunityMessage.id)}
              className="p-2 rounded-lg text-[#9299A5] hover:text-white hover:bg-[#101114] transition-colors shrink-0 cursor-pointer"
              title="Ocultar aviso de chat flotante"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Footer Advertising Banner */}
      <AdBanner ads={ads} onOpenContactModal={() => setIsContactAdOpen(true)} />

      {/* Barra de Navegación Inferior — Android-First Tap Targets */}
      <nav className="shrink-0 bg-[#101114] border-t-2 border-white/15 px-1.5 py-1.5 z-40 safe-area-pb">
        <div className="max-w-xl mx-auto grid grid-cols-6 gap-1">
          {/* Tab 1: Mapa */}
          <button
            onClick={() => setActiveTab('map')}
            title="Ver mapa en vivo, recorridos y colectivos"
            className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all ${
                activeTab === 'map'
                  ? 'bg-[#FFF19A] border border-[#101114] text-[#101114]'
                  : 'bg-transparent text-[#9299A5]'
              }`}
            >
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Mapa</span>
          </button>

          {/* Botón 2: Mi ubicación */}
          <button
            onClick={() => {
              setActiveTab('map');
              if (!userLocation) {
                setIsLocationModalOpen(true);
              } else {
                window.dispatchEvent(new CustomEvent('uppa-map-locate-me'));
                showToast('Centrando en tu ubicación GPS');
              }
            }}
            className="min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer text-[#9299A5] hover:text-white group"
            title="Centrar el mapa en mi ubicación GPS actual"
          >
            <div className="p-1.5 rounded-lg bg-transparent group-hover:bg-[#202329] text-[#B7F36B] transition-all">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-[9.5px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-[#9299A5] group-hover:text-white">
              Mi ubicacion
            </span>
          </button>

          {/* Botón 3: Enfocar */}
          <button
            onClick={() => {
              setActiveTab('map');
              window.dispatchEvent(new CustomEvent('uppa-map-fit-route'));
              showToast('Enfocando traza completa Malvinas ↔ Zárate');
            }}
            className="min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer text-[#9299A5] hover:text-white group"
            title="Enfocar el recorrido completo en el mapa"
          >
            <div className="p-1.5 rounded-lg bg-transparent group-hover:bg-[#202329] text-white transition-all">
              <Maximize2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-[#9299A5] group-hover:text-white">
              Enfocar
            </span>
          </button>

          {/* Tab 4: Taxi & Motos con acceso al Ranking de Prestadores */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => setActiveTab('taxi')}
              title="Ir a Taxis & Motos para pedir o ver prestadores habilitados"
              className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer flex-1 ${
                activeTab === 'taxi'
                  ? 'text-[#B7F36B] font-black'
                  : 'text-[#9299A5] hover:text-white'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-all flex items-center -space-x-1 ${
                  activeTab === 'taxi'
                    ? 'bg-[#B7F36B] border border-[#101114] text-[#101114]'
                    : 'bg-transparent text-[#9299A5]'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <Car className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9.5px] tracking-tight mt-0.5 font-bold whitespace-nowrap">
                Taxi & Motos
              </span>
            </button>

            <div className="absolute right-0 top-1">
              <RankingPrestadoresDropdown
                placement="top"
                onOpenTaxiTab={() => setActiveTab('taxi')}
                triggerButtonClassName="w-5 h-5 rounded-md bg-[#202329] hover:border-[#FFF19A] border border-white/20 text-[#FFF19A] flex items-center justify-center transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Tab 5: Chat Comunitario */}
          <button
            onClick={() => setActiveTab('chat')}
            title="Abrir el chat comunitario de pasajeros y prestadores"
            className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
              activeTab === 'chat'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all relative ${
                activeTab === 'chat'
                  ? 'bg-[#FFF19A] border border-[#101114] text-[#101114]'
                  : 'bg-transparent text-[#9299A5]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {communityChatList.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-[#B7F36B] text-[#101114] font-black text-[8.5px] min-w-3.5 text-center border border-[#101114]">
                  {communityChatList.length}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Chat</span>
          </button>

          {/* Tab 6: Admin */}
          <button
            onClick={() => setActiveTab('admin')}
            title="Abrir el panel de Administración UPPA"
            className={`min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all ${
                activeTab === 'admin'
                  ? 'bg-[#FFF19A] border border-[#101114] text-[#101114]'
                  : 'bg-transparent text-[#9299A5]'
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Admin</span>
          </button>
        </div>
      </nav>

      {/* Location Modal */}
      <LocationPermissionModal
        isOpen={isLocationModalOpen}
        userRole={currentUser.role}
        userName={currentUser.name}
        onLocationGranted={handleLocationGranted}
        onDismiss={() => setIsLocationModalOpen(false)}
      />

      {/* Modals */}
      <ReportEventModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleCreateEvent}
        routes={routes}
        initialLat={userLocation?.lat || -34.1683}
        initialLng={userLocation?.lng || -58.9592}
        currentUserName={currentUser.name}
        currentUserId={currentUser.id}
      />

      <PedirTransporteModal
        isOpen={isPedirTransporteOpen}
        onClose={() => setIsPedirTransporteOpen(false)}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        initialOrigin={userLocation?.address || 'Campana Centro (Plaza Eduardo Costa)'}
        userLocation={userLocation}
        onSuccess={() => {
          showToast('¡Aviso emitido! Choferes habilitados ordenados por cercanía GPS.');
          setActiveTab('taxi');
        }}
      />

      <PublishTaxiModal
        isOpen={isPublishTaxiOpen}
        initialTab={publishTaxiInitialTab}
        onClose={() => setIsPublishTaxiOpen(false)}
        onSubmit={handlePublishTaxi}
        onActivateDriverSession={(session) => {
          setDriverSession(session);
          setCurrentUser((prev) => ({
            ...prev,
            role: 'driver',
            name: session.driverName,
            phone: session.whatsapp,
          }));
          setIsDriverOnline(true);
          showToast(`¡Servicio de Chofer Habilitado! Temporizador de ${session.hoursPaid}h activo.`);
        }}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        currentUserPhone={currentUser.phone}
      />

      <ContactAdModal
        isOpen={isContactAdOpen}
        onClose={() => setIsContactAdOpen(false)}
        onSubmitInquiry={(data) =>
          showToast(`Solicitud para "${data.businessName}" registrada. WhatsApp: 3489686939`)
        }
      />

      <PublicApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        routes={routes}
        events={events}
        taxis={taxis}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        isHabilitado={isDriverHabilitado}
        onUpdateUser={(updated) => {
          const roleChanged = updated.role !== currentUser.role;
          setCurrentUser(updated);
          if (roleChanged) setIsLocationModalOpen(true);
          showToast(`Perfil: ${updated.role}`);
        }}
      />

      {/* Non-blocking Login / Register Modal for optional account access */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-[#101114] border-2 border-[#FFF19A]/40 rounded-3xl relative shadow-[6px_6px_0px_#202329]">
            <button
              onClick={() => setIsLoginModalOpen(false)}
              title="Cerrar ventana de inicio de sesión"
              className="absolute top-4 right-4 z-20 w-11 h-11 rounded-xl bg-[#202329] hover:border-[#FFF19A] border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <LoginPage
              onLogin={(user) => {
                setCurrentUser(user);
                setIsLoggedIn(true);
                setIsLoginModalOpen(false);
                setIsLocationModalOpen(true);
                showToast(`¡Hola, ${user.name}!`);
              }}
              onExploreGuest={() => {
                setIsLoginModalOpen(false);
                showToast('Modo libre activo');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
