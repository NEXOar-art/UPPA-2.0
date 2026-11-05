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
  const [taxis, setTaxis] = useState<TaxiListing[]>(MOCK_TAXI_LISTINGS);
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

  // Habilitación específica del usuario actual (si existe en el registro del Administrador)
  const userHabilitacionRecord = useMemo(() => {
    return (
      habilitacionesList.find((h) => {
        const matchId =
          (currentUser.id && h.driverId === currentUser.id) ||
          (currentUser.uid && h.driverId === currentUser.uid);
        const matchName =
          currentUser.name &&
          h.driverName &&
          h.driverName.trim().toLowerCase() === currentUser.name.trim().toLowerCase();
        const cleanPhone = currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '';
        const matchPhone = cleanPhone && h.whatsapp && h.whatsapp.replace(/\D/g, '').includes(cleanPhone);
        return Boolean(matchId || matchName || matchPhone);
      }) || null
    );
  }, [habilitacionesList, currentUser]);

  // Verificar si el usuario es prestador de servicio (chofer registrado o con solicitud de servicio)
  const isDriverUser = useMemo(() => {
    const hasDriverRole = Boolean(
      currentUser.esChofer ||
      currentUser.rol === 'chofer_moto' ||
      currentUser.rol === 'chofer_auto' ||
      currentUser.role === 'driver'
    );
    const hasDriverHabilitacion = Boolean(userHabilitacionRecord);
    const hasSession = Boolean(
      driverSession &&
      (driverSession.driverName === currentUser.name || driverSession.driverId === currentUser.id)
    );
    return hasDriverRole || hasDriverHabilitacion || hasSession;
  }, [currentUser, userHabilitacionRecord, driverSession]);

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
  }, [currentUser, driverSession]);

  const handleSetDriverDisponibilidad = (nextState: 'desocupado' | 'ocupado') => {
    const keys = [
      currentUser?.uid,
      currentUser?.id,
      currentUser?.nombre,
      currentUser?.name,
      currentUser?.phone,
      driverSession?.driverName,
    ].filter(Boolean) as string[];

    keys.forEach((k) => {
      setDriverDisponibilidad(k, nextState);
    });
    setDriverDisponibilidadState(nextState);
    showToast(
      nextState === 'ocupado'
        ? '🟡 Estado: OCUPADO (En viaje activo)'
        : '🟢 ¡Estado: DESOCUPADO! Toda la comunidad ve que estás disponible.'
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

  // Limpieza periódica de eventos push que superaron los 15 minutos de exposición
  useEffect(() => {
    const cleaner = setInterval(() => {
      const now = Date.now();
      setScreenPushEvents((prev) => prev.filter((ev) => (ev.exposureExpiresAt || 0) > now));
    }, 3000);
    return () => clearInterval(cleaner);
  }, []);

  // Subscribe to real-time Firestore reports and push notifications
  useEffect(() => {
    const unsubReportes = subscribeToReportes((reps) => {
      const realReports = (reps || []).filter((r) => !r.id?.startsWith('rep-init-') && !r.id?.startsWith('ev-'));
      if (realReports && realReports.length > 0) {
        const mapped: MapEvent[] = realReports.map((r) => {
          let evType: MapEvent['type'] = 'late';
          if (r.tipo === 'accidente') evType = 'accident';
          else if (r.tipo === 'demora') evType = 'late';
          else if (r.tipo === 'congestion') evType = 'traffic';
          else if (r.tipo === 'corte') evType = 'corte' as any;
          else if (r.tipo === 'control') evType = 'control' as any;
          else evType = 'danger';

          return {
            id: r.id,
            routeId: r.ruta === 'vigalondo-mcdonalds' ? 'route-vigalondo-mcdonalds' : 'route-zarate-malvinas',
            type: evType,
            title: `${r.tipo.toUpperCase()}: ${r.ruta || 'Zárate ↔ Campana'}`,
            description: r.descripcion,
            lat: r.ubicacion.lat,
            lng: r.ubicacion.lng,
            reportedBy: r.nombreUsuario,
            reportedByUserId: r.usuarioId,
            confirmations: r.confirmaciones || 1,
            confirmaciones: r.confirmaciones || 1,
            confirmedByUserIds: [],
            reportedAt: 'En vivo',
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
      const activeHabs = habs.filter((h) => h.estado === 'activo');
      if (activeHabs.length > 0) {
        const habTaxis: TaxiListing[] = activeHabs.map((h, i) => ({
          id: h.id,
          userId: h.driverId,
          driverName: h.driverName,
          vehicleType: h.vehicleType,
          vehicleModel: h.vehicleModel,
          whatsapp: h.whatsapp,
          zone: h.zone,
          lat: -34.195 + (i * 0.007) - 0.003,
          lng: -58.945 + (i * 0.007) - 0.003,
          hoursPaid: h.horas,
          startsAt: h.startsAt || Date.now(),
          endsAt: h.endsAt || (Date.now() + h.horas * 3600 * 1000),
          status: 'active',
          rating: 4.9,
          completedRides: 38,
          activationCode: h.activationCode,
          isOnline: true,
        }));
        setTaxis(habTaxis);
      }
    });

    const unsubNotif = onPushNotification((notif) => {
      if (!notif) return;
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

        // De lo contrario, se publica con tiempo de exposición de 15 minutos (900000 ms)
        const exposureExpiresAt = notif.exposureExpiresAt || Date.now() + 15 * 60 * 1000;
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
            rating: 5.0,
            completedRides: 5,
            activationCode: driverSession?.activationCode,
          };
          return [newListing, ...prev];
        }
      });
    }
  }, [userLocation, currentUser, driverSession, isDriverOnline]);

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
    const created: MapEvent = {
      ...newEventData,
      id: `ev-${Date.now()}`,
      confirmations: 1,
      confirmedByUserIds: [currentUser.id],
      reportedAt: 'Recién',
    };
    setEvents((prev) => [created, ...prev]);
    setSelectedEvent(created);
    setActiveTab('map');
    showToast(`✅ ${created.title} registrado en el mapa`);

    const firestoreType: any =
      newEventData.type === 'accident'
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
    }).catch((err) => console.warn('Firestore report write notice:', err));
  };

  // Prestadores de Servicio Habilitados por el Administrador UPPA (Tiempo Real)
  // Solo se visualizan los prestadores cuya habilitación fue aprobada por el Administrador
  // y que están dentro de su tiempo abonado (endsAt > now).
  const marketplaceTaxis = useMemo(() => {
    const now = Date.now();
    const result: TaxiListing[] = [];
    const seen = new Set<string>();

    // 1. Prestadores habilitados por el Administrador en 'habilitaciones'
    habilitacionesList.forEach((hab) => {
      const isActivo = hab.estado === 'activo';
      const isApprovedByAdmin = Boolean(hab.activadoConClaveAdmin || hab.habilitadoPor);
      const isWithinTime = (hab.endsAt || 0) > now;

      if (isActivo && isApprovedByAdmin && isWithinTime) {
        const keyName = hab.driverName.trim().toLowerCase();
        seen.add(keyName);
        if (hab.whatsapp) seen.add(hab.whatsapp.replace(/\D/g, ''));
        if (hab.activationCode) seen.add(hab.activationCode.toUpperCase());

        result.push({
          id: hab.id,
          userId: hab.driverId || hab.id,
          driverName: hab.driverName,
          vehicleType: hab.vehicleType,
          vehicleModel: hab.vehicleModel,
          whatsapp: hab.whatsapp,
          zone: hab.zone || 'Zárate ↔ Campana',
          lat: userLocation ? userLocation.lat : -34.175 + (Math.random() - 0.5) * 0.02,
          lng: userLocation ? userLocation.lng : -58.965 + (Math.random() - 0.5) * 0.02,
          hoursPaid: hab.horas || 12,
          startsAt: hab.startsAt || now,
          endsAt: hab.endsAt || now + 12 * 3600 * 1000,
          status: 'active',
          rating: 5.0,
          completedRides: 10,
          activationCode: hab.activationCode,
        });
      }
    });

    // Solo se devuelven los prestadores de servicio 100% reales habilitados por el Administrador
    return result;
  }, [habilitacionesList, userLocation]);

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
      <div className="min-h-screen w-full bg-[#07090e] flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-bold text-slate-950 font-display text-2xl shadow-xl shadow-sky-500/25 animate-pulse">
          U
        </div>
        <p className="mt-4 text-xs font-semibold text-sky-300">Conectando con Firebase Authentication...</p>
        <span className="text-[11px] text-slate-500 font-mono mt-1">UPPA · Zárate ↔ Campana</span>
      </div>
    );
  }

  // Autenticación Requerida al Inicio para acceder a todas las funcionalidades
  if (!isLoggedIn) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2 rounded-2xl shadow-2xl text-xs flex items-center gap-2 border-sky-400/40 text-sky-200 animate-in fade-in duration-200">
          <Sparkles className="w-3.5 h-3.5 text-sky-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Eventos Push en Pantalla (Deduplicación & Tiempo de Exposición de 15 Minutos) */}
      {screenPushEvents.length > 0 && (
        <aside aria-label="Eventos en tiempo real" className="fixed top-16 right-3 sm:right-6 z-40 max-w-sm w-[calc(100vw-1.5rem)] sm:w-88 space-y-2 pointer-events-none">
          {screenPushEvents.slice(0, 4).map((ev) => {
            const remainingSec = Math.max(0, Math.floor(((ev.exposureExpiresAt || 0) - Date.now()) / 1000));
            const min = Math.floor(remainingSec / 60);
            const sec = remainingSec % 60;
            const formattedTime = `${min}:${sec.toString().padStart(2, '0')}`;

            const badgeBg =
              ev.type === 'reporte'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : ev.type === 'transporte'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : ev.type === 'admin'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-sky-500/20 border-sky-500/40 text-sky-300';

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
                className="p-3.5 rounded-2xl bg-[#0a0e19]/95 border border-white/10 shadow-2xl backdrop-blur-xl pointer-events-auto space-y-2 animate-in slide-in-from-top-2 duration-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeBg}`}>
                      {ev.type}
                    </span>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{ev.title}</h4>
                  </div>
                  <button
                    onClick={() => setScreenPushEvents((prev) => prev.filter((p) => p.id !== ev.id))}
                    className="text-slate-400 hover:text-white p-0.5 rounded-full cursor-pointer"
                    title="Cerrar evento"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug">{ev.body}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-white/5 font-mono">
                  <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Exposición: {formattedTime} min</span>
                  </span>
                  <span className="text-[9px] text-slate-500">15 min en pantalla</span>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Alerta / Recordatorio de email pendiente de autenticar */}
      {isLoggedIn && !isEmailVerified && authUser?.email && !authUser.email.includes('guest') && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              Correo <strong>{authUser.email}</strong> pendiente de autenticación en Firebase.
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="text-[11px] font-bold text-amber-300 hover:text-white underline cursor-pointer shrink-0 ml-2"
          >
            Verificar o Reenviar Mail
          </button>
        </div>
      )}

      {/* Floating Glass Top Bar (Tesla / Uber Style) */}
      <header className="h-14 px-4 bg-[#0a0d14]/75 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between shrink-0 z-30">
        {/* Brand: Solo el texto UPPA sin icono */}
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab('map')} className="flex items-center">
            <span className="text-lg font-black tracking-wider text-white font-display">
              UPPA
            </span>
          </button>
        </div>

        {/* Route status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-slate-200">Línea 228</span>
          <span className="text-[10px] text-cyan-400 font-semibold font-mono">Malvinas ↔ Zárate</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Menú de 3 puntos: Prestar Servicio / Pedir Transporte Alternativo */}
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              className="h-8 w-8 rounded-xl glass-button flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
              title="Más opciones: Prestar Servicio / Pedir Transporte"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isHeaderMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#0a0e19]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setPublishTaxiInitialTab('transfer');
                    setIsPublishTaxiOpen(true);
                    setIsHeaderMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-300 hover:bg-emerald-500/15 flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-0.5">
                    <Bike className="w-4 h-4 text-emerald-400" />
                    <Car className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span>Prestar Servicio</span>
                </button>

                <button
                  onClick={() => {
                    setIsPedirTransporteOpen(true);
                    setIsHeaderMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-amber-300 hover:bg-amber-500/15 flex items-center gap-2.5 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>Pedir Transporte Alternativo</span>
                </button>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                className={`relative px-2.5 py-1.5 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                  isDriverUser && isDriverHabilitado
                    ? driverDisponibilidad === 'ocupado'
                      ? 'bg-amber-950/85 border border-amber-400 text-amber-200 shadow-xl shadow-amber-500/35 ring-2 ring-amber-400/80 animate-pulse'
                      : 'bg-emerald-950/70 border border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/60'
                    : isDriverUser && !isDriverHabilitado
                    ? 'glass-button border border-slate-700/60 text-slate-300 hover:text-white'
                    : 'glass-button text-slate-300 hover:text-white'
                }`}
                title={
                  isDriverUser
                    ? isDriverHabilitado
                      ? driverDisponibilidad === 'ocupado'
                        ? `Mi Perfil: ${currentUser.name} (ACTIVO - EN VIAJE - Clic para desplegable y colocar Desocupado)`
                        : `Mi Perfil: ${currentUser.name} (Chofer Habilitado - Disponible)`
                      : `Mi Perfil: ${currentUser.name} (Chofer Pendiente de Habilitación del Administrador)`
                    : `Mi Perfil: ${currentUser.name}`
                }
              >
                {/* Indicador titilando: SOLO para el prestador de servicio habilitado y NUNCA para el pasajero */}
                {isDriverUser && isDriverHabilitado ? (
                  driverDisponibilidad === 'ocupado' ? (
                    <span className="relative flex h-3 w-3 mr-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 ring-2 ring-[#07090e]" />
                    </span>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5 mr-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </span>
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

                <span className="text-xs font-bold text-white max-w-[110px] truncate hidden md:inline">
                  {currentUser.name}
                </span>

                {/* Badge en el botón del perfil (Solo para el prestador) */}
                {isDriverUser && isDriverHabilitado && (
                  driverDisponibilidad === 'ocupado' ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 hidden sm:inline px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 animate-pulse">
                      ⚡ ACTIVO
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50">
                      DESOCUPADO
                    </span>
                  )
                )}

                {isDriverUser && !isDriverHabilitado && (
                  <span className="text-[10px] font-bold text-amber-300 hidden sm:inline px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">
                    Pendiente
                  </span>
                )}

                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {/* Menú Desplegable del Perfil */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#0c101d]/98 backdrop-blur-2xl border border-white/10 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                  {/* Encabezado con datos del usuario */}
                  <div className="flex items-center gap-3 pb-2.5 border-b border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-400/30 flex items-center justify-center text-lg shadow-sm shrink-0">
                      {currentUser.role === 'admin'
                        ? '🛡️'
                        : isDriverUser
                        ? currentUser.tipoVehiculo === 'moto'
                          ? '🏍️'
                          : '🚕'
                        : '👤'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">
                        {currentUser.name || 'Mi Perfil'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {currentUser.email || 'Sin correo registrado'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isDriverUser
                              ? isDriverHabilitado
                                ? driverDisponibilidad === 'ocupado'
                                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 animate-pulse'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                                : 'bg-amber-500/15 text-amber-300 border-amber-400/30'
                              : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                          }`}
                        >
                          {isDriverUser
                            ? isDriverHabilitado
                              ? driverDisponibilidad === 'ocupado'
                                ? '⚡ ACTIVO (En Viaje)'
                                : '🟢 Habilitado (Disponible)'
                              : '⏳ Chofer Pendiente'
                            : '👤 Pasajero'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sección para Prestador Pendiente de Habilitación */}
                  {isDriverUser && !isDriverHabilitado && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>Habilitación de Chofer</span>
                        </span>
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/40">
                          Pendiente
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-white">
                        Habilitación por Administrador
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Para figurar como Habilitado en la plataforma, el Administrador debe validar tu comprobante de transferencia y activar tu unidad. En ese momento comenzará tu temporizador en vivo.
                      </p>
                      <a
                        href={`https://wa.me/5493489690058?text=${encodeURIComponent(
                          `Hola Lucia Veronica Gimenez! Te contacto por la habilitación de mi servicio de chofer (${currentUser.name || 'Prestador UPPA'}).`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Contactar Administrador (WhatsApp 3489690058)</span>
                      </a>
                    </div>
                  )}

                  {/* Sección Exclusiva para Prestadores de Servicio Habilitados */}
                  {isDriverUser && isDriverHabilitado && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-200">
                          Disponibilidad de Servicio
                        </span>
                        {driverDisponibilidad === 'ocupado' ? (
                          <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/50 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>OCUPADO</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>DESOCUPADO</span>
                          </span>
                        )}
                      </div>

                      {/* Desplegable de Estado */}
                      <div>
                        <label className="text-[10.5px] text-slate-400 block mb-1">
                          Desplegable de estado:
                        </label>
                        <select
                          value={driverDisponibilidad}
                          onChange={(e) => {
                            handleSetDriverDisponibilidad(e.target.value as 'desocupado' | 'ocupado');
                          }}
                          className="w-full bg-[#131828] border border-slate-700 hover:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
                        >
                          <option value="desocupado">🟢 DESOCUPADO (Disponible para la comunidad)</option>
                          <option value="ocupado">🟡 OCUPADO (En viaje activo con pasajero)</option>
                        </select>
                      </div>

                      {/* Botón directo de acción para colocar Desocupado / Ocupado */}
                      {driverDisponibilidad === 'ocupado' ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetDriverDisponibilidad('desocupado');
                            setIsProfileDropdownOpen(false);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-300"
                        >
                          <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />
                          <span>Colocar DESOCUPADO (Disponible)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            handleSetDriverDisponibilidad('ocupado');
                            setIsProfileDropdownOpen(false);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Colocar OCUPADO (En viaje)</span>
                        </button>
                      )}

                      <p className="text-[10px] text-slate-400 leading-tight">
                        Al colocar <strong>Desocupado</strong>, toda la comunidad en <em>Taxis & Motos</em> sabrá de inmediato que estás disponible.
                      </p>
                    </div>
                  )}

                  {/* Acciones generales del menú */}
                  <div className="pt-1 space-y-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsAuthModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/[0.06] flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Ver Mi Perfil Completo & Datos</span>
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
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-sky-500/25 to-cyan-500/25 hover:from-sky-500/35 hover:to-cyan-500/35 border border-sky-400/50 text-xs font-bold text-sky-200 hover:text-white flex items-center gap-1.5 transition-all shadow-sm shadow-sky-500/10 cursor-pointer active:scale-95"
              title="Crear un perfil en Firebase y autenticar por correo"
            >
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hacerse un Perfil</span>
            </button>
          )}
        </div>
      </header>

      {/* Driver GPS Status Bar with Real-time Countdown Timer - SOLO si está prestando servicio de moto taxi o auto taxi */}
      {isPrestandoServicioTaxi && (
        <DriverConnectionBar
          isOnline={isDriverOnline}
          onToggleOnline={() => {
            const next = !isDriverOnline;
            setIsDriverOnline(next);
            showToast(next ? 'Conductor en línea transmitiendo GPS' : 'Modo conductor pausado');
          }}
          location={userLocation}
          driverName={driverSession?.driverName || currentUser.nombre || currentUser.name}
          vehicleType={((driverSession?.vehicleType || currentUser.tipoVehiculo || (currentUser.rol === 'chofer_moto' ? 'moto' : 'auto')) === 'moto' ? 'moto' : 'auto')}
          endsAt={driverSession?.endsAt || (Date.now() + 12 * 3600 * 1000)}
          activationCode={driverSession?.activationCode}
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

      {/* Barra Flotante de Acceso Rápido al Chat Comunitario (Ubicada más arriba para evitar superposiciones) */}
      {activeTab !== 'chat' && latestCommunityMessage && latestCommunityMessage.id !== dismissedChatMsgId && (
        <div className="fixed bottom-24 sm:bottom-28 right-3 sm:right-5 max-w-[calc(100vw-24px)] sm:max-w-sm z-30 animate-in slide-in-from-bottom-3 duration-300">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#090d16]/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl flex items-center justify-between gap-2.5 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-400/30">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-white text-[11px] truncate group-hover:text-purple-300">
                    {latestCommunityMessage.nombreUsuario}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 shrink-0">
                    Comunidad
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  {latestCommunityMessage.texto}
                </p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-md shadow-purple-600/30 active:scale-95 transition-all flex items-center gap-1"
            >
              <span>Ver Chat</span>
            </button>

            <button
              onClick={() => setDismissedChatMsgId(latestCommunityMessage.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Ocultar aviso de chat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Footer Advertising Banner */}
      <AdBanner ads={ads} onOpenContactModal={() => setIsContactAdOpen(true)} />

      {/* Barra de Navegación Inferior Inspirada en Cabify con Iconos y Texto Debajo */}
      <nav className="shrink-0 bg-[#080d18]/98 backdrop-blur-2xl border-t border-white/10 px-1.5 py-1.5 z-40 safe-area-pb shadow-2xl">
        <div className="max-w-xl mx-auto grid grid-cols-6 gap-1">
          {/* Tab 1: Mapa (Icono de colectivo + texto "Mapa" debajo) */}
          <button
            onClick={() => setActiveTab('map')}
            className={`py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'text-sky-300 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'map'
                  ? 'bg-sky-500/25 border border-sky-400/40 text-sky-300 shadow-md shadow-sky-500/20'
                  : 'bg-transparent text-slate-400'
              }`}
            >
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Mapa</span>
          </button>

          {/* Botón 2: Mi ubicacion */}
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
            className="py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer text-slate-400 hover:text-cyan-300 group"
            title="Centrar en mi ubicación GPS"
          >
            <div className="p-1.5 rounded-xl bg-transparent group-hover:bg-cyan-500/20 border border-transparent group-hover:border-cyan-400/30 text-cyan-400 transition-all shadow-sm">
              <Navigation className="w-4 h-4 fill-cyan-400/20 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[9.5px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-slate-300 group-hover:text-cyan-200">
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
            className="py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer text-slate-400 hover:text-indigo-300 group"
            title="Enfocar recorrido completo"
          >
            <div className="p-1.5 rounded-xl bg-transparent group-hover:bg-indigo-500/20 border border-transparent group-hover:border-indigo-400/30 text-indigo-400 transition-all shadow-sm">
              <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-slate-300 group-hover:text-indigo-200">
              Enfocar
            </span>
          </button>

          {/* Tab 4: Taxi & Motos con 3 puntitos al lado para desplegar "Ranking de Prestadores" */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => setActiveTab('taxi')}
              className={`py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer flex-1 ${
                activeTab === 'taxi'
                  ? 'text-emerald-300 font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all flex items-center -space-x-1 ${
                  activeTab === 'taxi'
                    ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 shadow-md shadow-emerald-500/20'
                    : 'bg-transparent text-slate-400'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <Car className="w-3.5 h-3.5" />
              </div>
              <span className="text-[9.5px] tracking-tight mt-0.5 font-bold whitespace-nowrap">
                Taxi & Motos
              </span>
            </button>

            {/* 3 Puntitos al lado que abren el Ranking de Prestadores */}
            <div className="absolute right-0 top-1">
              <RankingPrestadoresDropdown
                placement="top"
                onOpenTaxiTab={() => setActiveTab('taxi')}
                triggerButtonClassName="w-5 h-5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 flex items-center justify-center transition-all cursor-pointer shadow-sm"
              />
            </div>
          </div>

          {/* Tab 5: Chat Comunitario */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
              activeTab === 'chat'
                ? 'text-purple-300 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all relative ${
                activeTab === 'chat'
                  ? 'bg-purple-500/25 border border-purple-400/40 text-purple-300 shadow-md shadow-purple-500/20'
                  : 'bg-transparent text-slate-400'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {communityChatList.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-purple-500 text-white font-black text-[8.5px] min-w-3.5 text-center animate-pulse">
                  {communityChatList.length}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Chat</span>
          </button>

          {/* Tab 6: Admin */}
          <button
            onClick={() => setActiveTab('admin')}
            className={`py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'text-violet-300 font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'admin'
                  ? 'bg-violet-500/25 border border-violet-400/40 text-violet-300 shadow-md shadow-violet-500/20'
                  : 'bg-transparent text-slate-400'
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
          showToast('¡Aviso de transporte emitido a choferes de Moto y Auto Taxi!');
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
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-[#07090e] border border-sky-400/30 rounded-3xl relative shadow-2xl">
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
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
