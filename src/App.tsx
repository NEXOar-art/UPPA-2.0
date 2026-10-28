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
import { useAuth } from './context/AuthContext';
import {
  ActiveDriverSession,
  getActiveDriverSession,
} from './services/driverActivationService';
import {
  subscribeToReportes,
  subscribeToHabilitacionesChofer,
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
  const [events, setEvents] = useState<MapEvent[]>(MOCK_EVENTS);
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>(MOCK_LIVE_BUSES);
  const [taxis, setTaxis] = useState<TaxiListing[]>(MOCK_TAXI_LISTINGS);
  const [payments, setPayments] = useState<PaymentProof[]>(MOCK_PAYMENTS);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [ads, setAds] = useState<AdListing[]>(MOCK_ADS);

  // User & Driver Geolocation state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDriverOnline, setIsDriverOnline] = useState(true);

  // Solo colocar el botón de "conductor en línea" si está prestando servicio de moto taxi o auto taxi
  const isPrestandoServicioTaxi = useMemo(() => {
    // 1. Determinar el tipo de vehículo (estrictamente moto o auto)
    const vehicle =
      driverSession?.vehicleType ||
      currentUser.tipoVehiculo ||
      (currentUser.rol === 'chofer_moto' ? 'moto' : currentUser.rol === 'chofer_auto' ? 'auto' : null);

    const isMotoOrAuto = vehicle === 'moto' || vehicle === 'auto';
    if (!isMotoOrAuto) return false;

    // 2. Determinar si está prestando servicio activamente
    const tieneSesionChofer = Boolean(driverSession && driverSession.endsAt > Date.now());
    const esChoferActivo = Boolean(
      currentUser.esChofer ||
      currentUser.rol === 'chofer_moto' ||
      currentUser.rol === 'chofer_auto' ||
      (currentUser.role === 'driver' && isMotoOrAuto)
    );

    return tieneSesionChofer || esChoferActivo;
  }, [driverSession, currentUser]);

  // Verificar si el usuario presta servicio y si su habilitación está activa
  const isDriverUser = useMemo(() => {
    return Boolean(
      currentUser.esChofer ||
      currentUser.rol === 'chofer_moto' ||
      currentUser.rol === 'chofer_auto' ||
      currentUser.role === 'driver' ||
      Boolean(driverSession) ||
      taxis.some((t) => t.driverName === currentUser.name || t.id === currentUser.id)
    );
  }, [currentUser, driverSession, taxis]);

  const isDriverHabilitado = useMemo(() => {
    if (!isDriverUser) return false;
    const now = Date.now();
    const hasActiveSession = Boolean(driverSession && driverSession.endsAt > now);
    const hasActiveTaxi = taxis.some(
      (t) =>
        (t.driverName === currentUser.name ||
          t.id === currentUser.id ||
          (currentUser.phone && t.whatsapp?.includes(currentUser.phone))) &&
        t.endsAt > now
    );
    const hasActiveUserStatus = Boolean(currentUser.estado === 'activo' && currentUser.esChofer);
    return hasActiveSession || hasActiveTaxi || hasActiveUserStatus;
  }, [isDriverUser, driverSession, taxis, currentUser]);

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

  const handleToggleDriverDisponibilidad = () => {
    const nextState = driverDisponibilidad === 'ocupado' ? 'desocupado' : 'ocupado';
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
    showToast(nextState === 'ocupado' ? '🟡 Estado de prestador: OCUPADO' : '🟢 Estado de prestador: DESOCUPADO');
  };

  // Active View / Tabs
  const [activeTab, setActiveTab] = useState<'map' | 'taxi' | 'chat' | 'admin'>('map');
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-zarate-malvinas');
  const [activeTrackingTaxi, setActiveTrackingTaxi] = useState<TaxiListing | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

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

  // Cerrar menú de 3 puntos al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    };
    if (isHeaderMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHeaderMenuOpen]);

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
      if (reps && reps.length > 0) {
        const mapped: MapEvent[] = reps.map((r) => {
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

    const startsAt = Date.now();
    const endsAt = startsAt + listingData.hoursPaid * 3600 * 1000;

    const newListing: TaxiListing = {
      ...listingData,
      id: `tx-${Date.now()}`,
      startsAt,
      endsAt,
      status: 'active',
      rating: 5.0,
      completedRides: 0,
    };

    setPayments([newPayment, ...payments]);
    setTaxis([newListing, ...taxis]);
    setActiveTab('taxi');
    showToast(`Taxi publicado por ${listingData.hoursPaid}h`);
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

        {/* Deductive Icon-First Navigation Tabs (Sin texto, solo iconos directos) */}
        <nav className="flex items-center gap-1 glass-pill p-1 rounded-2xl border-white/5">
          <button
            onClick={() => setActiveTab('map')}
            className={`p-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center ${
              activeTab === 'map'
                ? 'bg-sky-400/20 text-sky-200 border border-sky-400/35 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mapa"
          >
            <Bus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('taxi')}
            className={`p-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center ${
              activeTab === 'taxi'
                ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/35 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Taxis & Motos"
          >
            <div className="flex items-center gap-0.5">
              <Bike className="w-4 h-4" />
              <Car className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`p-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center relative ${
              activeTab === 'chat'
                ? 'bg-purple-400/20 text-purple-200 border border-purple-400/35 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {communityChatList.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-purple-500 text-white font-extrabold text-[9px] min-w-3.5 text-center animate-pulse">
                {communityChatList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`p-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center ${
              activeTab === 'admin'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm'
                : 'text-slate-400 hover:text-purple-300'
            }`}
            title="Admin"
          >
            <Shield className="w-4 h-4" />
          </button>
        </nav>

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
            <>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className={`relative px-2.5 py-1.5 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                  isDriverUser && isDriverHabilitado
                    ? 'bg-emerald-950/70 border border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/60 animate-pulse'
                    : isDriverUser && !isDriverHabilitado
                    ? 'glass-button border border-slate-700/60 text-slate-300 hover:text-white'
                    : 'glass-button text-slate-300 hover:text-white'
                }`}
                title={
                  isDriverUser
                    ? isDriverHabilitado
                      ? `Mi Perfil: ${currentUser.name} (Chofer Habilitado - Clic para ver botón Ocupado/Desocupado)`
                      : `Mi Perfil: ${currentUser.name} (Chofer No Habilitado)`
                    : isEmailVerified
                    ? `Mi Perfil: ${currentUser.name} (Email Autenticado)`
                    : `Mi Perfil: ${currentUser.name} (Email Pendiente de Autenticación)`
                }
              >
                {/* Si es prestador de servicio y está habilitado, titila en verde con punto pulsante */}
                {isDriverUser && isDriverHabilitado ? (
                  <span className="relative flex h-3 w-3 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-[#07090e]" />
                  </span>
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

                {isDriverUser && isDriverHabilitado && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50">
                    Habilitado
                  </span>
                )}

                {isDriverUser && !isDriverHabilitado && (
                  <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    No Habilitado
                  </span>
                )}

                {!isEmailVerified && (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 border border-[#0a0d14] animate-pulse shrink-0"
                    title="Email pendiente de verificar"
                  />
                )}
              </button>

              <button
                onClick={async () => {
                  await firebaseLogout();
                  setIsLoggedIn(false);
                  try {
                    localStorage.removeItem('uppa_session_user');
                  } catch {}
                  showToast('Sesión cerrada');
                }}
                className="p-1.5 rounded-xl glass-button text-slate-400 hover:text-rose-300 cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
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
                taxis={taxis}
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
            taxis={taxis}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserPhone={currentUser.phone}
            currentUserRole={currentUser.role}
            onOpenPublishModal={(tab) => {
              setPublishTaxiInitialTab(tab || 'transfer');
              setIsPublishTaxiOpen(true);
            }}
            onSelectTaxiOnMap={(taxi) => {
              setActiveTrackingTaxi(taxi);
              setActiveTab('map');
              showToast(`Trazando trayectoria con ${taxi.driverName}`);
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
