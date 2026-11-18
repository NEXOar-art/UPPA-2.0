import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import {
  UserLocation,
  reverseGeocode,
  getCachedStreetName,
  isCoordinateAddress,
  isFallbackZoneAddress,
  getDistanceKm,
  GPS_UPDATE_INTERVAL_MS,
} from './utils/geolocation';
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
import { TicketConsultaModal } from './components/common/TicketConsultaModal';
import { ActiveRideGlassWidget } from './components/common/ActiveRideGlassWidget';
import { SectionInfoSheetModal, AppSectionId } from './components/common/SectionInfoSheetModal';
import { ShareQrModal } from './components/common/ShareQrModal';
import { Linea228Stop } from './data/linea228Stops';
import { useAuth } from './context/AuthContext';
import { playMicroSound } from './utils/soundEffects';
import {
  ActiveDriverSession,
  getActiveDriverSession,
} from './services/driverActivationService';
import {
  subscribeToReportes,
  subscribeToHabilitacionesChofer,
  obtenerHabilitacionesActuales,
  subscribeToChat,
  subscribeToSolicitudesTransporte,
  isSolicitudExpired,
  onPushNotification,
  triggerInAppPushNotification,
  crearReporte,
  subscribeToDriversDisponibilidad,
  setDriverDisponibilidad,
  finalizarViajeDeChofer,
  activarGpsHaciaPasajero,
  actualizarUbicacionPasajeroSolicitud,
  actualizarUbicacionChoferGps,
  anunciarVehiculoDesocupado,
  isRealCommunityReport,
  enviarMensajeChat,
  getMessageTimestampMs,
} from './services/realtimeFirebaseService';
import { ensureFirebaseAuthSession } from './config/firebase';

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
  Ticket,
  Info,
  AlertTriangle,
  QrCode,
} from 'lucide-react';

function GlobalHoverTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; placeBelow: boolean } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canHover = window.matchMedia('(hover: hover)').matches;

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

    document.addEventListener('mouseover', (e) => {
      if (canHover) showForElement(e.target);
    }, { passive: true });
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
    switchUserRole,
  } = useAuth();

  // Authentication state - Requerida al inicio para acceder a todas las funcionalidades
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('uppa_session_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.email || parsed.phone) && !(parsed.email || '').includes('guest') && parsed.id !== 'usr-comunidad') {
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
        if (parsed && (parsed.email || parsed.phone) && !(parsed.email || '').includes('guest') && parsed.id !== 'usr-comunidad') {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_USER;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isShareQrModalOpen, setIsShareQrModalOpen] = useState(false);
  const [authModalDefaultMode, setAuthModalDefaultMode] = useState<'register' | 'login' | 'profile' | undefined>(undefined);
  const [emailVerificationFocusTick, setEmailVerificationFocusTick] = useState(0);
  const [sectionInfoModal, setSectionInfoModal] = useState<AppSectionId | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [firestorePermissionAlert, setFirestorePermissionAlert] = useState<{
    path?: string | null;
    anonymousAuthBlocked?: boolean;
  } | null>(null);

  useEffect(() => {
    const handlePermErr = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      setFirestorePermissionAlert({
        path: detail?.path,
        anonymousAuthBlocked: detail?.anonymousAuthBlocked,
      });
    };
    const handleSyncOk = (ev: Event) => {
      const okPath = (ev as CustomEvent)?.detail?.path as string | undefined;
      setFirestorePermissionAlert((prev) => {
        if (!prev) return null;
        if (!prev.path || !okPath) return null;
        const prevRoot = prev.path.split('/')[0];
        const okRoot = okPath.split('/')[0];
        return prevRoot === okRoot ? null : prev;
      });
    };
    window.addEventListener('uppa-firestore-permission-error', handlePermErr);
    window.addEventListener('uppa-firestore-sync-ok', handleSyncOk);
    return () => {
      window.removeEventListener('uppa-firestore-permission-error', handlePermErr);
      window.removeEventListener('uppa-firestore-sync-ok', handleSyncOk);
    };
  }, []);

  // Sobrescritura manual en sesión cuando un usuario habilitado elige operar temporalmente como Pasajero
  const [manualPasajeroOverride, setManualPasajeroOverride] = useState<boolean>(() => {
    try {
      return localStorage.getItem('uppa_manual_pasajero_override') === '1';
    } catch {
      return false;
    }
  });
  const [isSwitchingRole, setIsSwitchingRole] = useState<boolean>(false);

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
      const explicitPasajero =
        manualPasajeroOverride || (authUser.rol === 'pasajero' && authUser.esChofer === false);
      const isDriverMode = !explicitPasajero && Boolean(driverSession && driverSession.endsAt > Date.now());
      const computedRole = mapFirestoreRolToAppRole(authUser.rol, Boolean(authUser.esChofer || isDriverMode));
      const synchedUser: User = {
        ...currentUser,
        id: authUser.id || authUser.uid || currentUser.id,
        uid: authUser.uid || authUser.id || currentUser.uid,
        name: authUser.nombre || authUser.name || currentUser.name,
        nombre: authUser.nombre || authUser.name || currentUser.nombre,
        email: authUser.email || currentUser.email,
        role: computedRole,
        rol: authUser.rol,
        esChofer: authUser.esChofer || computedRole === 'driver',
        tipoVehiculo:
          authUser.rol === 'pasajero'
            ? null
            : authUser.tipoVehiculo ??
              (authUser.rol === 'chofer_moto'
                ? 'moto'
                : authUser.rol === 'chofer_auto'
                ? 'auto'
                : currentUser.tipoVehiculo ?? null),
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
          if (parsed && (parsed.email || parsed.phone) && !(parsed.email || '').includes('guest') && parsed.id !== 'usr-comunidad') {
            setCurrentUser(parsed);
            setIsLoggedIn(true);
            return;
          }
        }
      } catch {}
      setCurrentUser(INITIAL_USER);
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
  // Publicidades reales en el banner (Rotisería Malvinas, Nexo Art y CV-ATS)
  const [ads, setAds] = useState<AdListing[]>(() =>
    MOCK_ADS.filter(
      (a) =>
        a.id === 'ad-rotiseria-malvinas' ||
        a.id === 'ad-nexo-art' ||
        a.id === 'ad-cv-ats'
    )
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

  // Control estricto de vista exclusiva de Administrador (Rol admin o sesión desbloqueada por PIN)
  const [isAdminPinUnlocked, setIsAdminPinUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('uppa_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncAdminUnlock = () => {
      try {
        setIsAdminPinUnlocked(sessionStorage.getItem('uppa_admin_unlocked') === 'true');
      } catch {
        setIsAdminPinUnlocked(false);
      }
    };
    window.addEventListener('uppa-admin-unlock-changed', syncAdminUnlock);
    window.addEventListener('storage', syncAdminUnlock);
    return () => {
      window.removeEventListener('uppa-admin-unlock-changed', syncAdminUnlock);
      window.removeEventListener('storage', syncAdminUnlock);
    };
  }, []);

  const isAdminViewer = Boolean(
    currentUser.role === 'admin' ||
    isFirebaseAdmin ||
    currentUser.rol === 'administrador' ||
    isAdminPinUnlocked
  );
  const isAdminViewerRef = useRef(isAdminViewer);
  isAdminViewerRef.current = isAdminViewer;

  const [adminNowTick, setAdminNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isAdminViewer) return;
    setAdminNowTick(Date.now());
    const timer = setInterval(() => setAdminNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isAdminViewer]);

  // Solicitudes pendientes de habilitación (visibles EXCLUSIVAMENTE para el Administrador)
  const pendingAdminHabilitaciones = useMemo(() => {
    if (!isAdminViewer) return [];
    return habilitacionesList.filter(
      (h) => h.estado === 'pendiente' && h.id !== 'hab-2' && h.driverId !== 'drv-carlos'
    );
  }, [isAdminViewer, habilitacionesList]);

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

  // Verificar si el usuario es prestador de servicio (habilitado por Admin, sesión activa o rol chofer)
  const isDriverUser = useMemo(() => {
    // Administradores exclusivos no usan herramientas de chofer salvo habilitación explícita de conductor
    if (currentUser.role === 'admin' || currentUser.rol === 'administrador') {
      return false;
    }
    if (manualPasajeroOverride) {
      return false;
    }
    const now = Date.now();
    const hasActiveAdminHabilitacion = Boolean(
      userHabilitacionRecord &&
        userHabilitacionRecord.estado === 'activo' &&
        (userHabilitacionRecord.activadoConClaveAdmin || userHabilitacionRecord.habilitadoPor) &&
        (!userHabilitacionRecord.endsAt || userHabilitacionRecord.endsAt > now)
    );
    const hasActiveSession = Boolean(
      driverSession && driverSession.endsAt > now && driverSession.activationCode
    );
    const hasDriverRole = Boolean(
      currentUser.esChofer ||
        currentUser.rol === 'chofer_moto' ||
        currentUser.rol === 'chofer_auto' ||
        currentUser.role === 'driver'
    );
    return hasDriverRole || hasActiveAdminHabilitacion || hasActiveSession;
  }, [currentUser, userHabilitacionRecord, driverSession, manualPasajeroOverride]);

  // Verifica si el usuario tiene actualmente un abono y habilitación vigente aprobada por Administración
  const hasActivePaidDriverHabilitacion = useMemo(() => {
    if (currentUser.role === 'admin' || currentUser.rol === 'administrador') {
      return false;
    }
    const now = Date.now();
    if (userHabilitacionRecord) {
      const isActivo = userHabilitacionRecord.estado === 'activo';
      const isApprovedByAdmin = Boolean(
        userHabilitacionRecord.activadoConClaveAdmin || userHabilitacionRecord.habilitadoPor
      );
      const isWithinTime = (userHabilitacionRecord.endsAt || 0) > now;
      return isActivo && isApprovedByAdmin && isWithinTime;
    }
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
  }, [currentUser.role, currentUser.rol, userHabilitacionRecord, driverSession, habilitacionesList]);

  const handleSwitchRoleInSession = async (
    nextRol: 'pasajero' | 'chofer_moto' | 'chofer_auto'
  ) => {
    if (currentUser.role === 'admin' || currentUser.rol === 'administrador' || isSwitchingRole) {
      return;
    }
    const isChofer = nextRol === 'chofer_moto' || nextRol === 'chofer_auto';
    const tipoVehiculo: 'moto' | 'auto' | null =
      nextRol === 'chofer_moto' ? 'moto' : nextRol === 'chofer_auto' ? 'auto' : null;

    setIsSwitchingRole(true);
    try {
      const nextOverride = nextRol === 'pasajero';
      setManualPasajeroOverride(nextOverride);
      try {
        if (nextOverride) {
          localStorage.setItem('uppa_manual_pasajero_override', '1');
        } else {
          localStorage.removeItem('uppa_manual_pasajero_override');
        }
      } catch {}

      const updated = await switchUserRole(nextRol);
      const nextUser: User = updated || {
        ...currentUser,
        rol: nextRol,
        role: isChofer ? 'driver' : 'passenger',
        esChofer: isChofer,
        tipoVehiculo,
      };
      setCurrentUser(nextUser);
      try {
        localStorage.setItem('uppa_session_user', JSON.stringify(nextUser));
      } catch {}

      if (isChofer) {
        const label = nextRol === 'chofer_moto' ? 'Moto Taxi' : 'Auto Taxi';
        setIsHabilitacionCardExpanded(true);
        if (!hasActivePaidDriverHabilitacion) {
          // Obliga a iniciar el proceso de abono y habilitación para prestar servicio sin evadir el pago
          setPublishTaxiInitialTab('transfer');
          setPublishTaxiInitialVehicle(nextRol === 'chofer_moto' ? 'moto' : 'auto');
          setIsProfileDropdownOpen(false);
          setIsPublishTaxiOpen(true);
          showToast(
            `Para prestar servicio como ${label}, iniciá y completá el abono de turno obligatorio.`
          );
        } else {
          showToast(`Rol cambiado a Prestador Habilitado (${label}) sin cerrar sesión`);
        }
      } else {
        showToast('Rol cambiado a Pasajero sin cerrar sesión');
      }
    } finally {
      setIsSwitchingRole(false);
    }
  };

  // HABILITADO POR EL ADMINISTRADOR:
  // Condición lógica indispensable: Solo aparece como habilitado cuando el Administrador
  // valida y completa su habilitación con la clave autorizada en Administración UPPA,
  // y mientras esté dentro del período de tiempo abonado (endsAt > now).
  const isDriverHabilitado = useMemo(() => {
    if (!isDriverUser) return false;
    return hasActivePaidDriverHabilitacion;
  }, [isDriverUser, hasActivePaidDriverHabilitacion]);

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
      const vType =
        (userHabilitacionRecord?.vehicleType ||
          driverSession?.vehicleType ||
          currentUser?.tipoVehiculo) === 'moto'
          ? 'moto'
          : 'auto';
      await anunciarVehiculoDesocupado(driverId, driverName, vType);
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
    const handleAcceptedRide = () => {
      setDriverDisponibilidadState('ocupado');
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
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
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
  const [publishTaxiInitialVehicle, setPublishTaxiInitialVehicle] = useState<'auto' | 'moto'>('auto');
  const [isContactAdOpen, setIsContactAdOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contextEventForChat, setContextEventForChat] = useState<MapEvent | null>(null);
  const [communityChatList, setCommunityChatList] = useState<MensajeChatFirestore[]>([]);
  const [dismissedChatMsgId, setDismissedChatMsgId] = useState<string | null>(null);
  const [solicitudesList, setSolicitudesList] = useState<SolicitudTransporteFirestore[]>([]);
  const [activeMapGlassRideId, setActiveMapGlassRideId] = useState<string | null>(null);
  const shownMapGlassRideIdsRef = useRef<Set<string>>(new Set());
  const mapGlassAutoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pop-up exclusivo de 10 segundos para el prestador cuando el pasajero recibe su código
  const [driverCodePopup, setDriverCodePopup] = useState<{
    solicitudId: string;
    pasajeroNombre: string;
    origen: string;
    destino: string;
    solicitud: SolicitudTransporteFirestore;
    expiresAt: number;
  } | null>(null);
  const shownDriverCodePopupIdsRef = useRef<Set<string>>(new Set());

  // Pop-up global de 5 segundos en la sección principal del mapa al quedar un vehículo DESOCUPADO
  const [desocupadoMapPopup, setDesocupadoMapPopup] = useState<{
    id: string;
    driverName: string;
    vehicleType?: 'auto' | 'moto';
    expiresAt: number;
  } | null>(null);
  const shownDesocupadoEventsRef = useRef<Set<string>>(new Set());

  // Eventos Push en Pantalla (Exposición de 7 segundos para mantener el mapa despejado)
  const [screenPushEvents, setScreenPushEvents] = useState<PushNotificationPayload[]>([]);
  // Cartel Oficial de Alerta Push de Administración UPPA en la sección del Mapa (5 segundos exactos)
  const [mapAdminAlert, setMapAdminAlert] = useState<{
    id: string;
    title: string;
    body: string;
    createdAt: number;
    expiresAt: number | null;
  } | null>(null);
  const [mapAdminAlertNow, setMapAdminAlertNow] = useState<number>(Date.now());
  const seenAdminAlertMsgIdsRef = useRef<Set<string>>(new Set());
  const adminAlertChatInitRef = useRef<boolean>(false);
  const lastLocalAdminAlertRef = useRef<{ text: string; at: number } | null>(null);

  const triggerMapAdminAlertCartel = (id: string, title: string, body: string) => {
    const now = Date.now();
    setMapAdminAlertNow(now);
    setMapAdminAlert({
      id,
      title: title.trim() || 'Alerta Oficial UPPA',
      body: body.trim(),
      createdAt: now,
      expiresAt: activeTabRef.current === 'map' ? now + 5000 : null,
    });
  };

  useEffect(() => {
    if (!mapAdminAlert) return;
    if (activeTab === 'map' && mapAdminAlert.expiresAt === null) {
      const now = Date.now();
      if (now - mapAdminAlert.createdAt > 90000) {
        setMapAdminAlert(null);
      } else {
        setMapAdminAlertNow(now);
        setMapAdminAlert((prev) =>
          prev && prev.id === mapAdminAlert.id && prev.expiresAt === null
            ? { ...prev, expiresAt: now + 5000 }
            : prev
        );
      }
      return;
    }

    if (activeTab === 'map' && mapAdminAlert.expiresAt !== null) {
      const targetExpiresAt = mapAdminAlert.expiresAt;
      const tick = setInterval(() => {
        const now = Date.now();
        setMapAdminAlertNow(now);
        if (now >= targetExpiresAt) {
          setMapAdminAlert((prev) => (prev?.id === mapAdminAlert.id ? null : prev));
        }
      }, 100);
      return () => clearInterval(tick);
    }
  }, [activeTab, mapAdminAlert]);

  useEffect(() => {
    if (!communityChatList || communityChatList.length === 0) {
      adminAlertChatInitRef.current = true;
      return;
    }

    const now = Date.now();
    if (!adminAlertChatInitRef.current) {
      for (const m of communityChatList) {
        const ts = getMessageTimestampMs(m.enviadoEn);
        if (now - ts >= 8000) {
          seenAdminAlertMsgIdsRef.current.add(m.id);
        }
      }
      adminAlertChatInitRef.current = true;
    }

    for (const m of communityChatList) {
      if (seenAdminAlertMsgIdsRef.current.has(m.id)) continue;
      seenAdminAlertMsgIdsRef.current.add(m.id);
      const rawText = (m.texto || '').trim();
      if (!rawText.startsWith('🚨 [ALERTA OFICIAL UPPA]')) continue;
      const ts = getMessageTimestampMs(m.enviadoEn);
      if (now - ts > 20000) continue;

      if (
        lastLocalAdminAlertRef.current &&
        lastLocalAdminAlertRef.current.text === rawText &&
        now - lastLocalAdminAlertRef.current.at < 12000
      ) {
        continue;
      }

      const contentWithoutPrefix = rawText.replace('🚨 [ALERTA OFICIAL UPPA]', '').trim();
      const sepIndex = contentWithoutPrefix.indexOf(' — ');
      const parsedTitle =
        sepIndex >= 0
          ? contentWithoutPrefix.slice(0, sepIndex).trim()
          : contentWithoutPrefix || 'Alerta Oficial UPPA';
      const parsedBody = sepIndex >= 0 ? contentWithoutPrefix.slice(sepIndex + 3).trim() : '';

      triggerMapAdminAlertCartel(m.id, parsedTitle, parsedBody);
      triggerInAppPushNotification(
        parsedTitle,
        parsedBody || 'Comunicado oficial de Administración UPPA',
        'admin',
        { fromChatId: m.id }
      );
    }
  }, [communityChatList]);

  const selectedEventAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSelectedEventAutoClose = () => {
    if (selectedEventAutoCloseTimerRef.current) {
      clearTimeout(selectedEventAutoCloseTimerRef.current);
      selectedEventAutoCloseTimerRef.current = null;
    }
  };

  const openAutoDismissEvent = (ev: MapEvent) => {
    clearSelectedEventAutoClose();
    setSelectedEvent(ev);
    selectedEventAutoCloseTimerRef.current = setTimeout(() => {
      setSelectedEvent((prev) => (prev?.id === ev.id ? null : prev));
      selectedEventAutoCloseTimerRef.current = null;
    }, 7000);
  };

  useEffect(() => {
    return () => {
      clearSelectedEventAutoClose();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (mapGlassAutoHideTimerRef.current) clearTimeout(mapGlassAutoHideTimerRef.current);
    };
  }, []);

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

  // Limpieza periódica de eventos push en pantalla al vencer su exposición (4.5s chat / 7s reportes)
  useEffect(() => {
    const cleaner = setInterval(() => {
      const now = Date.now();
      setScreenPushEvents((prev) => prev.filter((ev) => (ev.exposureExpiresAt || 0) > now));
    }, 250);
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
            streetAddress:
              (r.calle && !isFallbackZoneAddress(r.calle) ? r.calle : null) ||
              getCachedStreetName(r.ubicacion.lat, r.ubicacion.lng) ||
              undefined,
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
          disponibilidad: h.disponibilidad || 'desocupado',
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
      if (notif.type === 'admin') return;
      if (notif.type === 'chat' && (activeTabRef.current === 'taxi' || activeTabRef.current === 'chat')) {
        return;
      }
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

        // Chat: 4.5 segundos exactos (en otras pantallas fuera de Taxis & Motos). Otros: 7 segundos
        const durationMs = notif.type === 'chat' ? 4500 : 7 * 1000;
        const maxExpiresAt = Date.now() + durationMs;
        const exposureExpiresAt = notif.exposureExpiresAt
          ? Math.min(notif.exposureExpiresAt, maxExpiresAt)
          : maxExpiresAt;
        return [{ ...notif, exposureExpiresAt }, ...prev];
      });
    });

    const unsubChat = subscribeToChat('todos', (msgs) => {
      setCommunityChatList(msgs);
    });

    const unsubSolicitudes = subscribeToSolicitudesTransporte((list) => {
      setSolicitudesList(list || []);
    });

    return () => {
      unsubReportes();
      unsubHabs();
      unsubNotif();
      unsubChat();
      unsubSolicitudes();
    };
  }, []);

  // Detectar cuando el pasajero recibe su código de seguridad y mostrar pop-up de 10s SOLO al prestador asignado
  useEffect(() => {
    const myIds = new Set(
      [currentUser.id, currentUser.uid].filter(Boolean) as string[]
    );
    const myNames = new Set(
      [currentUser.name, currentUser.nombre, driverSession?.driverName]
        .filter(Boolean)
        .map((n) => String(n).trim().toLowerCase())
    );

    const assignedPendingCode = solicitudesList.find((sol) => {
      if (sol.estado !== 'aceptado' && sol.estado !== 'en_camino') return false;
      if (!sol.codigoSeguridad || sol.codigoValidado) return false;
      const matchesId = Boolean(sol.choferId && myIds.has(sol.choferId));
      const matchesName = Boolean(
        isDriverUser &&
          sol.choferNombre &&
          myNames.has(sol.choferNombre.trim().toLowerCase())
      );
      return matchesId || matchesName;
    });

    if (!assignedPendingCode) return;
    if (activeTabRef.current === 'taxi') return;

    const solId = assignedPendingCode.id;
    let alreadyShown = shownDriverCodePopupIdsRef.current.has(solId);
    if (!alreadyShown) {
      try {
        alreadyShown = sessionStorage.getItem(`uppa_shown_code_pop_${solId}`) === '1';
      } catch {}
    }
    if (alreadyShown) return;

    shownDriverCodePopupIdsRef.current.add(solId);
    try {
      sessionStorage.setItem(`uppa_shown_code_pop_${solId}`, '1');
    } catch {}

    playMicroSound('ride_accepted');
    setDriverCodePopup({
      solicitudId: solId,
      pasajeroNombre: assignedPendingCode.nombrePasajero,
      origen: assignedPendingCode.origen,
      destino: assignedPendingCode.destino,
      solicitud: assignedPendingCode,
      expiresAt: Date.now() + 10000,
    });
  }, [solicitudesList, currentUser.id, currentUser.uid, currentUser.name, currentUser.nombre, driverSession?.driverName, isDriverUser]);

  useEffect(() => {
    if (!driverCodePopup) return;
    const msLeft = Math.max(0, driverCodePopup.expiresAt - Date.now());
    const t = setTimeout(() => {
      setDriverCodePopup(null);
    }, msLeft || 10000);
    return () => clearTimeout(t);
  }, [driverCodePopup]);

  // Escuchar eventos globales de vehículo DESOCUPADO (ventana local, BroadcastChannel y Firestore)
  useEffect(() => {
    const triggerPopup = (driverName: string, vehicleType?: 'auto' | 'moto', ts?: number) => {
      const stamp = typeof ts === 'number' ? ts : Date.now();
      const bucket = Math.floor(stamp / 3000);
      const dedupeKey = `${(driverName || 'chofer').trim().toLowerCase()}_${bucket}`;
      if (shownDesocupadoEventsRef.current.has(dedupeKey)) return;
      shownDesocupadoEventsRef.current.add(dedupeKey);

      playMicroSound('step_progress');
      setDesocupadoMapPopup({
        id: `${dedupeKey}-${stamp}`,
        driverName: driverName || 'Prestador habilitado',
        vehicleType,
        expiresAt: Date.now() + 5000,
      });
    };

    const handleWindowEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{
        choferId?: string;
        choferNombre?: string;
        vehicleType?: 'auto' | 'moto';
        timestamp?: number;
      }>;
      if (custom.detail) {
        triggerPopup(
          custom.detail.choferNombre || 'Prestador habilitado',
          custom.detail.vehicleType,
          custom.detail.timestamp
        );
      }
    };

    window.addEventListener('uppa-vehiculo-desocupado', handleWindowEvent);
    return () => {
      window.removeEventListener('uppa-vehiculo-desocupado', handleWindowEvent);
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    habilitacionesList.forEach((h) => {
      if (
        h.estado === 'activo' &&
        typeof h.ultimoDesocupadoAt === 'number' &&
        now - h.ultimoDesocupadoAt < 12000 &&
        h.ultimoDesocupadoAt <= now + 5000
      ) {
        const bucket = Math.floor(h.ultimoDesocupadoAt / 3000);
        const dedupeKey = `${h.driverName.trim().toLowerCase()}_${bucket}`;
        if (!shownDesocupadoEventsRef.current.has(dedupeKey)) {
          shownDesocupadoEventsRef.current.add(dedupeKey);
          playMicroSound('step_progress');
          setDesocupadoMapPopup({
            id: `${dedupeKey}-${h.ultimoDesocupadoAt}`,
            driverName: h.driverName,
            vehicleType: h.vehicleType,
            expiresAt: Date.now() + 5000,
          });
        }
      }
    });
  }, [habilitacionesList]);

  useEffect(() => {
    if (!desocupadoMapPopup) return;
    const msLeft = Math.max(0, desocupadoMapPopup.expiresAt - Date.now());
    const t = setTimeout(() => {
      setDesocupadoMapPopup(null);
    }, msLeft || 5000);
    return () => clearTimeout(t);
  }, [desocupadoMapPopup]);

  const watchIdRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  };

  const latestCommunityMessage = communityChatList.length > 0 ? communityChatList[communityChatList.length - 1] : null;

  // Auto-ocultar el contenedor flotante del chat tras 4.5 segundos (solo visible fuera de Chat y Taxis & Motos)
  useEffect(() => {
    if (!latestCommunityMessage?.id) return;
    if (activeTab === 'chat') {
      if (dismissedChatMsgId !== latestCommunityMessage.id) {
        setDismissedChatMsgId(latestCommunityMessage.id);
      }
      return;
    }
    if (latestCommunityMessage.id === dismissedChatMsgId) return;

    const msgId = latestCommunityMessage.id;
    const hideChatTimer = setTimeout(() => {
      setDismissedChatMsgId(msgId);
    }, 4500);

    return () => clearTimeout(hideChatTimer);
  }, [latestCommunityMessage?.id, dismissedChatMsgId, activeTab]);

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

  const lastReverseGeocodeRef = useRef<{
    lat: number;
    lng: number;
    address: string;
    at: number;
  } | null>(null);

  const applyFreshGpsFix = useCallback(async (pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    const now = Date.now();
    recordGpsSample({ latitude, longitude, speed, accuracy });

    const cachedGeo = lastReverseGeocodeRef.current;
    const movedKm = cachedGeo
      ? getDistanceKm(cachedGeo.lat, cachedGeo.lng, latitude, longitude)
      : Infinity;
    const needsGeocode =
      !cachedGeo ||
      isFallbackZoneAddress(cachedGeo.address) ||
      movedKm >= 0.05 ||
      now - cachedGeo.at > 25000;

    setUserLocation((prev) => ({
      lat: latitude,
      lng: longitude,
      accuracy: accuracy || 12,
      speed: speed ?? prev?.speed ?? 0,
      heading: heading ?? prev?.heading ?? 0,
      address: cachedGeo?.address || prev?.address,
      timestamp: now,
      isSimulated: false,
    }));

    if (needsGeocode) {
      try {
        const address = await reverseGeocode(latitude, longitude);
        lastReverseGeocodeRef.current = {
          lat: latitude,
          lng: longitude,
          address,
          at: Date.now(),
        };
        setUserLocation((prev) =>
          prev
            ? {
                ...prev,
                address,
              }
            : prev
        );
      } catch {}
    }
  }, []);

  // Auto-activar GPS del dispositivo cada vez que cualquier usuario (pasajero, prestador o admin) inicia sesión
  const prevLoggedInRef = useRef<boolean>(false);
  const lastGpsLoginUserIdRef = useRef<string | null>(null);

  const activateDeviceGpsOnLogin = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setIsLocationModalOpen(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyFreshGpsFix(pos);
        setIsLocationModalOpen(false);
        showToast('📡 GPS del dispositivo activado automáticamente');
      },
      () => {
        // Si el navegador requiere permiso manual o falla el sensor, mostrar asistente de GPS
        setIsLocationModalOpen(true);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 6500,
      }
    );
  }, [applyFreshGpsFix]);

  useEffect(() => {
    const wasLoggedIn = prevLoggedInRef.current;
    prevLoggedInRef.current = isLoggedIn;

    if (!isLoggedIn) {
      lastGpsLoginUserIdRef.current = null;
      return;
    }

    const activeUid = currentUser.id || currentUser.uid || 'usr';
    if (!wasLoggedIn || lastGpsLoginUserIdRef.current !== activeUid) {
      lastGpsLoginUserIdRef.current = activeUid;
      activateDeviceGpsOnLogin();
    }
  }, [isLoggedIn, currentUser.id, currentUser.uid, activateDeviceGpsOnLogin]);

  // Continuous GPS Watcher + Active 3-Second Polling - Available freely for all users
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 2500,
      timeout: 5500,
    };

    navigator.geolocation.getCurrentPosition(applyFreshGpsFix, () => {}, geoOptions);

    watchIdRef.current = navigator.geolocation.watchPosition(
      applyFreshGpsFix,
      () => {},
      geoOptions
    );

    const gpsPollInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(applyFreshGpsFix, () => {}, geoOptions);
    }, GPS_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(gpsPollInterval);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [applyFreshGpsFix]);

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
    clearSelectedEventAutoClose();
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    setSelectedEvent(null);
    showToast('Reporte ocultado');
  };

  const [resolvedEventStreets, setResolvedEventStreets] = useState<Record<string, string>>({});
  const resolvingEventStreetsRef = useRef<Set<string>>(new Set());

  // Determinar automáticamente en segundo plano la dirección exacta de cada evento mediante geocodificación inversa
  useEffect(() => {
    let cancelled = false;
    events.forEach((ev) => {
      const hasValidExisting = Boolean(ev.streetAddress && !isFallbackZoneAddress(ev.streetAddress));
      const hasValidResolved = Boolean(
        resolvedEventStreets[ev.id] && !isFallbackZoneAddress(resolvedEventStreets[ev.id])
      );
      if (hasValidExisting || hasValidResolved || resolvingEventStreetsRef.current.has(ev.id)) {
        return;
      }
      const cached = getCachedStreetName(ev.lat, ev.lng);
      if (cached && !isFallbackZoneAddress(cached)) {
        setResolvedEventStreets((prev) => (prev[ev.id] === cached ? prev : { ...prev, [ev.id]: cached }));
        return;
      }
      resolvingEventStreetsRef.current.add(ev.id);
      reverseGeocode(ev.lat, ev.lng)
        .then((street) => {
          if (cancelled || !street) return;
          if (!isCoordinateAddress(street)) {
            setResolvedEventStreets((prev) => (prev[ev.id] === street ? prev : { ...prev, [ev.id]: street }));
          }
        })
        .catch(() => {})
        .finally(() => {
          resolvingEventStreetsRef.current.delete(ev.id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [events, resolvedEventStreets]);

  const eventsWithStreet = useMemo(() => {
    return events.map((ev) => {
      const resolved =
        (resolvedEventStreets[ev.id] && !isCoordinateAddress(resolvedEventStreets[ev.id])
          ? resolvedEventStreets[ev.id]
          : undefined) ||
        getCachedStreetName(ev.lat, ev.lng) ||
        (ev.streetAddress && !isCoordinateAddress(ev.streetAddress) ? ev.streetAddress : undefined);
      return resolved && resolved !== ev.streetAddress ? { ...ev, streetAddress: resolved } : ev;
    });
  }, [events, resolvedEventStreets]);

  const selectedEventWithStreet = useMemo(() => {
    if (!selectedEvent) return null;
    const matched = eventsWithStreet.find((e) => e.id === selectedEvent.id);
    if (matched) return matched;
    const street =
      resolvedEventStreets[selectedEvent.id] ||
      getCachedStreetName(selectedEvent.lat, selectedEvent.lng) ||
      (selectedEvent.streetAddress && !isCoordinateAddress(selectedEvent.streetAddress)
        ? selectedEvent.streetAddress
        : undefined);
    return street ? { ...selectedEvent, streetAddress: street } : selectedEvent;
  }, [selectedEvent, eventsWithStreet, resolvedEventStreets]);

  const handleCreateEvent = async (
    newEventData: Omit<MapEvent, 'id' | 'confirmations' | 'confirmedByUserIds' | 'reportedAt'>
  ) => {
    const now = Date.now();
    const isNearUserLoc =
      Boolean(userLocation?.address) &&
      !isFallbackZoneAddress(userLocation?.address) &&
      getDistanceKm(userLocation!.lat, userLocation!.lng, newEventData.lat, newEventData.lng) < 0.04;
    const quickStreetCandidate =
      (newEventData.streetAddress && !isFallbackZoneAddress(newEventData.streetAddress)
        ? newEventData.streetAddress
        : undefined) ||
      getCachedStreetName(newEventData.lat, newEventData.lng) ||
      (isNearUserLoc ? userLocation?.address : undefined);

    const created: MapEvent = {
      ...newEventData,
      id: `ev-${now}`,
      confirmations: 1,
      confirmedByUserIds: [currentUser.id],
      reportedAt: 'Recién',
      createdAtMs: newEventData.createdAtMs || now,
      expiresAtMs: newEventData.type === 'bus_location' ? now + 60000 : newEventData.expiresAtMs,
      streetAddress: quickStreetCandidate,
    };
    setEvents((prev) => [created, ...prev]);
    openAutoDismissEvent(created);
    setActiveTab('map');

    if (newEventData.type === 'bus_location') {
      const dirText = newEventData.direction === 'hacia_zarate' ? 'Hacia Zárate' : 'Hacia Malvinas';
      const speedText = newEventData.velocidadKmH ? ` · ${newEventData.velocidadKmH} km/h` : '';
      showToast(`📍 Ubicación de colectivo ahora (${dirText}${speedText}) registrada`);
    } else {
      showToast(`✅ ${created.title} registrado en el mapa`);
    }

    // Obtener la dirección exacta mediante geocodificación inversa (Nominatim / Photon) para hover, reporte y chat
    let resolvedStreet = quickStreetCandidate;
    if (!resolvedStreet || isFallbackZoneAddress(resolvedStreet)) {
      try {
        resolvedStreet = await reverseGeocode(newEventData.lat, newEventData.lng);
      } catch {
        resolvedStreet = `${newEventData.lat.toFixed(4)}, ${newEventData.lng.toFixed(4)}`;
      }
    }

    if (resolvedStreet && !isCoordinateAddress(resolvedStreet)) {
      setResolvedEventStreets((prev) => ({ ...prev, [created.id]: resolvedStreet! }));
      setEvents((prev) =>
        prev.map((ev) => (ev.id === created.id ? { ...ev, streetAddress: resolvedStreet } : ev))
      );
      setSelectedEvent((prev) =>
        prev && prev.id === created.id ? { ...prev, streetAddress: resolvedStreet } : prev
      );
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
      calle: resolvedStreet,
      ruta: newEventData.routeId === 'route-vigalondo-mcdonalds' ? 'vigalondo-mcdonalds' : 'campana-zarate',
      sentido: newEventData.direction === 'hacia_zarate' ? 'hacia_zarate' : 'hacia_malvinas',
      velocidadKmH: newEventData.velocidadKmH,
    }).catch((err) => console.warn('Firestore report write notice:', err));

    // Publicar automáticamente el evento en el chat comunitario con la dirección exacta obtenida por geocodificación inversa
    const streetChatPart = resolvedStreet
      ? ` · 📍 Dirección: ${resolvedStreet}`
      : ` · 📍 Coordenadas: ${newEventData.lat.toFixed(5)}, ${newEventData.lng.toFixed(5)}`;
    const descChatPart =
      created.description && created.description !== created.title ? `: ${created.description}` : '';
    const eventChatText =
      newEventData.type === 'bus_location'
        ? `📍 [UBICACIÓN COLECTIVO AHORA] Colectivo reportado por ${currentUser.name}: ${
            newEventData.direction === 'hacia_zarate' ? '➡️ Hacia Zárate' : '⬅️ Hacia Malvinas'
          }${streetChatPart}${newEventData.velocidadKmH ? ` · Velocidad: ${newEventData.velocidadKmH} km/h` : ''}. Visible en el mapa.`
        : `📢 [EVENTO EN VIVO] ${created.title}${descChatPart}${streetChatPart}. Reportado por ${currentUser.name}. Ya plasmado en el mapa.`;

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
          (currentUser.uid && hab.driverId === currentUser.uid) ||
          (currentUser.name &&
            hab.driverName &&
            hab.driverName.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
        );
        const detLat = -34.175 + ((idx % 7) - 3) * 0.0055;
        const detLng = -58.965 + ((idx % 5) - 2) * 0.0055;
        const liveLat =
          isViewerThisDriver && userLocation
            ? userLocation.lat
            : typeof hab.lat === 'number' && Number.isFinite(hab.lat)
            ? hab.lat
            : detLat;
        const liveLng =
          isViewerThisDriver && userLocation
            ? userLocation.lng
            : typeof hab.lng === 'number' && Number.isFinite(hab.lng)
            ? hab.lng
            : detLng;

        result.push({
          id: hab.id,
          userId: hab.driverId || hab.id,
          driverName: hab.driverName,
          vehicleType: hab.vehicleType,
          vehicleModel: hab.vehicleModel,
          patente: hab.patente || '',
          whatsapp: hab.whatsapp,
          zone: hab.zone || 'Zárate ↔ Campana',
          lat: liveLat,
          lng: liveLng,
          hoursPaid: hab.horas || 12,
          startsAt: hab.startsAt || now,
          endsAt: hab.endsAt || now + 12 * 3600 * 1000,
          status: 'active',
          rating: typeof hab.rating === 'number' ? hab.rating : 0,
          completedRides: (hab as any).completedRides || (hab as any).viajesRealizados || 0,
          indiceSeguridad: hab.indiceSeguridad,
          activationCode: hab.activationCode,
          disponibilidad: hab.disponibilidad || 'desocupado',
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

  const myLiveActiveSolicitud = useMemo(() => {
    const now = Date.now();
    const getTs = (s: SolicitudTransporteFirestore) => {
      if (typeof s.fechaAceptado === 'number') return s.fechaAceptado;
      if (typeof s.fechaSolicitud === 'number') return s.fechaSolicitud;
      if (typeof s.fechaSolicitud?.seconds === 'number') return s.fechaSolicitud.seconds * 1000;
      return 0;
    };
    const relevant = solicitudesList.filter((sol) => {
      if (sol.estado === 'cancelado' || sol.estado === 'expirada' || sol.estado === 'anulado' || sol.estado === 'completado') {
        return false;
      }
      if (isSolicitudExpired(sol, now)) return false;
      // Tarjeta de viaje activo exclusiva para el pasajero que creó el viaje
      const isMyPassengerRide =
        (currentUser.id && sol.pasajeroId === currentUser.id) ||
        (currentUser.uid && sol.pasajeroId === currentUser.uid);
      return Boolean(isMyPassengerRide);
    });
    if (relevant.length === 0) return null;
    const sorted = [...relevant].sort((a, b) => {
      const rank = (s: SolicitudTransporteFirestore) =>
        s.estado === 'en_camino' || s.estado === 'aceptado'
          ? 3
          : s.estado === 'pendiente'
          ? 2
          : 0;
      const diffRank = rank(b) - rank(a);
      if (diffRank !== 0) return diffRank;
      return getTs(b) - getTs(a);
    });
    return sorted[0] || null;
  }, [solicitudesList, currentUser.id, currentUser.uid]);

  // Mostrar la tarjeta de viaje activo al pasajero: 4s mientras busca móvil, y permanente al confirmarse el viaje con su Código de Viaje
  useEffect(() => {
    if (activeTab !== 'map') return;
    if (!myLiveActiveSolicitud?.id) return;
    const solId = myLiveActiveSolicitud.id;
    const isConfirmedRide =
      myLiveActiveSolicitud.estado === 'aceptado' || myLiveActiveSolicitud.estado === 'en_camino';
    const stateKey = `${solId}_${isConfirmedRide ? 'confirmado' : 'pendiente'}`;

    if (shownMapGlassRideIdsRef.current.has(stateKey)) return;

    shownMapGlassRideIdsRef.current.add(stateKey);
    setActiveMapGlassRideId(solId);

    if (mapGlassAutoHideTimerRef.current) {
      clearTimeout(mapGlassAutoHideTimerRef.current);
      mapGlassAutoHideTimerRef.current = null;
    }

    if (!isConfirmedRide) {
      mapGlassAutoHideTimerRef.current = setTimeout(() => {
        setActiveMapGlassRideId((prev) => (prev === solId ? null : prev));
        mapGlassAutoHideTimerRef.current = null;
      }, 4000);
    } else {
      showToast(
        myLiveActiveSolicitud.codigoSeguridad
          ? `✅ ¡Viaje confirmado! Tu Código de Viaje es ${myLiveActiveSolicitud.codigoSeguridad}`
          : '✅ ¡Viaje confirmado! Chofer en camino.'
      );
    }
  }, [activeTab, myLiveActiveSolicitud?.id, myLiveActiveSolicitud?.estado, myLiveActiveSolicitud?.codigoSeguridad]);

  const matchedLiveDriver = useMemo(() => {
    if (!myLiveActiveSolicitud?.choferId) return null;
    return (
      marketplaceTaxis.find(
        (t) =>
          t.userId === myLiveActiveSolicitud.choferId ||
          t.id === myLiveActiveSolicitud.choferId ||
          (myLiveActiveSolicitud.choferNombre &&
            t.driverName.trim().toLowerCase() ===
              myLiveActiveSolicitud.choferNombre.trim().toLowerCase())
      ) || null
    );
  }, [myLiveActiveSolicitud, marketplaceTaxis]);

  // Mantener coordenadas de rastreo sincronizadas en vivo cada 3s para mapa de conductor y pasajero
  const liveActiveTrackingTaxi = useMemo(() => {
    if (!activeTrackingTaxi) return null;
    return (
      marketplaceTaxis.find(
        (t) =>
          t.id === activeTrackingTaxi.id ||
          t.userId === activeTrackingTaxi.userId ||
          t.driverName.trim().toLowerCase() === activeTrackingTaxi.driverName.trim().toLowerCase()
      ) || activeTrackingTaxi
    );
  }, [activeTrackingTaxi, marketplaceTaxis]);

  const liveActiveTrackingPassenger = useMemo(() => {
    if (!activeTrackingPassenger) return null;
    const latest = solicitudesList.find((s) => s.id === activeTrackingPassenger.id);
    if (!latest) return activeTrackingPassenger;
    if (
      latest.estado === 'completado' ||
      latest.estado === 'cancelado' ||
      latest.estado === 'anulado'
    ) {
      return null;
    }
    return latest;
  }, [activeTrackingPassenger, solicitudesList]);

  // Transmisión GPS compartida cada 3 segundos hacia Firestore (Chofer en línea + Pasajero con viaje activo)
  const gpsBroadcastContextRef = useRef<{
    userLocation: UserLocation | null;
    isPrestandoServicioTaxi: boolean;
    isDriverOnline: boolean;
    driverIdentifiers: string[];
    activeSolicitudId: string | null;
  }>({
    userLocation: null,
    isPrestandoServicioTaxi: false,
    isDriverOnline: false,
    driverIdentifiers: [],
    activeSolicitudId: null,
  });

  gpsBroadcastContextRef.current = {
    userLocation,
    isPrestandoServicioTaxi,
    isDriverOnline,
    driverIdentifiers: [
      userHabilitacionRecord?.id,
      userHabilitacionRecord?.driverId,
      driverSession?.driverId,
      currentUser.uid,
      currentUser.id,
      driverSession?.driverName,
      currentUser.nombre,
      currentUser.name,
    ].filter(Boolean) as string[],
    activeSolicitudId:
      myLiveActiveSolicitud &&
      (myLiveActiveSolicitud.estado === 'pendiente' ||
        myLiveActiveSolicitud.estado === 'aceptado' ||
        myLiveActiveSolicitud.estado === 'en_camino')
        ? myLiveActiveSolicitud.id
        : null,
  };

  useEffect(() => {
    const pushLiveGpsSync = () => {
      const ctx = gpsBroadcastContextRef.current;
      const loc = ctx.userLocation;
      if (!loc || loc.isSimulated) return;

      if (ctx.isPrestandoServicioTaxi && ctx.isDriverOnline && ctx.driverIdentifiers.length > 0) {
        actualizarUbicacionChoferGps(ctx.driverIdentifiers, {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed,
          heading: loc.heading,
          accuracy: loc.accuracy,
          zone: loc.address,
        });
      }

      if (ctx.activeSolicitudId) {
        actualizarUbicacionPasajeroSolicitud(ctx.activeSolicitudId, {
          lat: loc.lat,
          lng: loc.lng,
        });
      }
    };

    pushLiveGpsSync();
    const timer = setInterval(pushLiveGpsSync, GPS_UPDATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

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
    const now = Date.now();
    const cleanTitle = title.trim() || 'Alerta Oficial UPPA';
    const cleanDesc = description.trim();
    const alertChatText = cleanDesc
      ? `🚨 [ALERTA OFICIAL UPPA] ${cleanTitle} — ${cleanDesc}`
      : `🚨 [ALERTA OFICIAL UPPA] ${cleanTitle}`;

    lastLocalAdminAlertRef.current = { text: alertChatText, at: now };

    // 1. Mostrar cartel destacado de 5 segundos en la sección del Mapa
    triggerMapAdminAlertCartel(`admin-alert-${now}`, cleanTitle, cleanDesc);

    // 2. Disparar alerta sonora y notificación Web Push
    triggerInAppPushNotification(
      cleanTitle,
      cleanDesc || 'Comunicado oficial de Administración UPPA',
      'admin'
    );

    // 3. Publicar automáticamente en el Chat General (todos los usuarios conectados)
    enviarMensajeChat('todos', {
      usuarioId: currentUser.uid || currentUser.id || 'usr-admin',
      nombreUsuario: 'Administración UPPA',
      texto: alertChatText,
      rol: 'administrador',
      avatarUrl: currentUser.avatarUrl,
    }).catch((err) => console.warn('Admin alert chat broadcast notice:', err));

    const adminChatNotice: ChatMessage = {
      id: `msg-admin-${now}`,
      channel: 'general',
      userId: currentUser.uid || currentUser.id || 'usr-admin',
      userName: 'Administración UPPA',
      content: alertChatText,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      sentiment: 'neutral',
    };
    setMessages((prev) => [...prev, adminChatNotice]);

    showToast('Alerta oficial enviada al Mapa (5s) y al Chat General');
  };

  const handleOpenContextualChat = (event: MapEvent) => {
    const resolvedStreet =
      event.streetAddress ||
      resolvedEventStreets[event.id] ||
      getCachedStreetName(event.lat, event.lng) ||
      undefined;
    setContextEventForChat(resolvedStreet ? { ...event, streetAddress: resolvedStreet } : event);
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

      {/* Pop-up exclusivo de 10 segundos para el prestador cuando el pasajero recibe su código */}
      {driverCodePopup && (
        <div
          role="alertdialog"
          aria-label="Código facilitado por el pasajero"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-md pointer-events-auto uppa-card-enter"
        >
          <div className="uppa-glass-ios rounded-2xl border-2 border-[#FFF19A] shadow-[0_12px_32px_rgba(0,0,0,0.7)] p-3.5 text-white space-y-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FFF19A] text-[#101114] flex items-center justify-center shrink-0 border border-[#101114]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-[13px] font-black text-[#FFF19A] leading-snug tracking-wide">
                    CODIGO PARA TAXIS &amp; MOTOS FACILITADO POR EL PASAJERO
                  </p>
                  <p className="text-[11px] text-white/90 mt-0.5 truncate">
                    Pasajero: <strong className="text-[#B7F36B]">{driverCodePopup.pasajeroNombre}</strong>
                  </p>
                  <p className="text-[10px] text-[#9299A5] truncate">
                    {driverCodePopup.origen} ➔ {driverCodePopup.destino}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDriverCodePopup(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                title="Cerrar aviso"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  activarGpsHaciaPasajero(driverCodePopup.solicitudId);
                  setActiveTrackingPassenger({ ...driverCodePopup.solicitud, gpsActivadoChofer: true });
                  setActiveTab('map');
                  setDriverCodePopup(null);
                  showToast(`📍 GPS activado hacia ${driverCodePopup.pasajeroNombre} · Viaje iniciado`);
                }}
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl uppa-cta-yellow text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                title="Activar GPS hacia el pasajero y avanzar al paso Viaje iniciado"
              >
                <Navigation className="w-3.5 h-3.5 text-[#101114]" />
                <span>GPS Pasajero</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('taxi');
                  setDriverCodePopup(null);
                }}
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#B7F36B] hover:brightness-95 text-[#101114] border border-[#101114] text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                title="Ir a Taxis & Motos para ingresar el código del pasajero"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Ir a Taxis &amp; Motos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#202329] border-2 border-[#FFF19A] px-4 py-2.5 rounded-xl shadow-[3px_3px_0px_#101114] text-xs font-bold flex items-center gap-2 text-white animate-in fade-in duration-200 max-w-[92vw]">
          <Sparkles className="w-4 h-4 text-[#FFF19A] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Eventos Push en Pantalla */}
      {(() => {
        const visiblePushEvents = screenPushEvents.filter(
          (ev) => !(ev.type === 'chat' && (activeTab === 'taxi' || activeTab === 'chat'))
        );
        if (visiblePushEvents.length === 0) return null;
        return (
          <aside aria-label="Eventos en tiempo real" className="fixed top-16 right-3 sm:right-6 z-40 max-w-sm w-[calc(100vw-1.5rem)] sm:w-88 space-y-2 pointer-events-none">
            {visiblePushEvents.slice(0, 4).map((ev) => {
              const remainingMs = Math.max(0, (ev.exposureExpiresAt || 0) - Date.now());
              const remainingSec = Math.floor(remainingMs / 1000);
              const min = Math.floor(remainingSec / 60);
              const sec = remainingSec % 60;
              const formattedTime =
                ev.type === 'chat'
                  ? `${(remainingMs / 1000).toFixed(1)}s`
                  : `${min}:${sec.toString().padStart(2, '0')}`;

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
        );
      })()}

      {/* Alerta / Recordatorio de email pendiente de autenticar */}
      {isLoggedIn &&
        !isEmailVerified &&
        (authUser?.email || currentUser.email) &&
        !(authUser?.email || currentUser.email).includes('guest') && (
        <div className="bg-[#202329] border-b border-[#FFF19A]/45 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-white z-40">
          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              setAuthModalDefaultMode('profile');
              setEmailVerificationFocusTick((n) => n + 1);
              setIsAuthModalOpen(true);
            }}
            title="Abrir UPPA Mi Perfil en Email Pendiente de Verificación"
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
          >
            <Mail className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
            <span className="truncate text-[#9299A5] group-hover:text-white transition-colors">
              Correo <strong className="text-white">{authUser?.email || currentUser.email}</strong> pendiente de verificación.
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              setAuthModalDefaultMode('profile');
              setEmailVerificationFocusTick((n) => n + 1);
              setIsAuthModalOpen(true);
            }}
            title="Ir a UPPA Mi Perfil para enviar el correo de verificación"
            className="text-[11px] font-black bg-[#FFF19A] text-[#101114] hover:brightness-95 cursor-pointer shrink-0 px-2.5 py-1 rounded-lg border border-[#101114] active:scale-95 transition-all"
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

          {/* Indicador Azul Titilante Exclusivo del Administrador al lado del Perfil Superior */}
          {isAdminViewer && pendingAdminHabilitaciones.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              title={`Habilitación pendiente (${pendingAdminHabilitaciones.length}): Hay solicitudes de chofer esperando aprobación. Tocá para ir a Administración UPPA`}
              aria-label="Indicador de habilitación pendiente para Administrador"
              className="relative min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#202329] border-2 border-blue-400 text-blue-200 hover:bg-blue-500/15 flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-90" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
              </span>
              <span className="text-[11px] font-black text-blue-200 hidden sm:inline whitespace-nowrap">
                Habilitar ({pendingAdminHabilitaciones.length})
              </span>
              <span className="text-[11px] font-black text-blue-200 sm:hidden font-mono">
                {pendingAdminHabilitaciones.length}
              </span>
            </button>
          )}

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

                  {/* Selector Rápido de Rol sin cerrar sesión */}
                  {currentUser.role !== 'admin' && currentUser.rol !== 'administrador' && (
                    <div className="p-2.5 rounded-xl bg-[#101114] border border-white/15 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-black uppercase tracking-wide text-white flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-[#FFF19A]" />
                          <span>Cambiar Rol en Sesión</span>
                        </span>
                        <span className="text-[9.5px] font-bold text-[#9299A5]">Sin salir</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRoleInSession('pasajero')}
                          title="Operar como Pasajero sin cerrar sesión"
                          className={`py-2 px-1.5 rounded-lg border text-[10.5px] font-black flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                            !isDriverUser
                              ? 'bg-[#FFF19A] text-[#101114] border-[#101114]'
                              : 'bg-[#202329] text-white border-white/15 hover:border-[#FFF19A]/60'
                          }`}
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>Pasajero</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRoleInSession('chofer_auto')}
                          title="Cambiar a Prestador de Servicio Auto Taxi sin cerrar sesión"
                          className={`py-2 px-1.5 rounded-lg border text-[10.5px] font-black flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                            isDriverUser && currentUser.rol !== 'chofer_moto' && currentUser.tipoVehiculo !== 'moto'
                              ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                              : 'bg-[#202329] text-white border-white/15 hover:border-[#B7F36B]/60'
                          }`}
                        >
                          <Car className="w-3.5 h-3.5" />
                          <span>Auto Taxi</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSwitchingRole}
                          onClick={() => handleSwitchRoleInSession('chofer_moto')}
                          title="Cambiar a Prestador de Servicio Moto Taxi (inicia abono obligatorio si no está habilitado)"
                          className={`py-2 px-1.5 rounded-lg border text-[10.5px] font-black flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-60 ${
                            isDriverUser && (currentUser.rol === 'chofer_moto' || currentUser.tipoVehiculo === 'moto')
                              ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                              : 'bg-[#202329] text-white border-white/15 hover:border-[#B7F36B]/60'
                          }`}
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Moto Taxi</span>
                        </button>
                      </div>
                      <p className="text-[9.5px] text-[#9299A5] leading-tight">
                        Pasar a <strong className="text-white">Auto/Moto Taxi</strong> inicia el abono para prestar servicio.
                      </p>
                    </div>
                  )}

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
                            Para figurar como Habilitado en la plataforma, completá tu solicitud de turno y el Administrador validará tu comprobante para iniciar tu temporizador en vivo.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setPublishTaxiInitialTab('transfer');
                              setPublishTaxiInitialVehicle(
                                currentUser.rol === 'chofer_moto' || currentUser.tipoVehiculo === 'moto'
                                  ? 'moto'
                                  : 'auto'
                              );
                              setIsPublishTaxiOpen(true);
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full min-h-[42px] py-2 px-3 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                            <span>Abonar y Solicitar Habilitación de Turno</span>
                          </button>
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
                    {!isEmailVerified && (authUser?.email || currentUser.email) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setAuthModalDefaultMode('profile');
                          setEmailVerificationFocusTick((n) => n + 1);
                          setIsAuthModalOpen(true);
                        }}
                        title="Ir a verificar tu correo electrónico pendiente"
                        className="w-full min-h-[42px] text-left px-3 py-2 rounded-xl text-xs font-black text-[#101114] bg-[#FFF19A] hover:brightness-95 border border-[#101114] flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[#101114]" />
                        <span>Verificar Email Pendiente</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setAuthModalDefaultMode('profile');
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
                        setManualPasajeroOverride(false);
                        setCurrentUser(INITIAL_USER);
                        setIsLoggedIn(false);
                        setIsAdminPinUnlocked(false);
                        try {
                          localStorage.removeItem('uppa_session_user');
                          localStorage.removeItem('uppa_manual_pasajero_override');
                          sessionStorage.removeItem('uppa_admin_unlocked');
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
        {firestorePermissionAlert && activeTab !== 'chat' && (
          <div className="bg-amber-500/15 border-b border-amber-400/40 px-3 py-2 flex items-center justify-between gap-2.5 text-xs text-amber-100 shrink-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <p className="text-[11px] leading-snug truncate">
                <strong className="text-amber-200 font-black">
                  Permisos de Firestore bloqueados{firestorePermissionAlert.path ? ` (${firestorePermissionAlert.path})` : ''}:
                </strong>{' '}
                {firestorePermissionAlert.anonymousAuthBlocked
                  ? 'Habilitá el inicio Anónimo en Firebase Auth o ingresá con Google/Correo.'
                  : 'Revisá las reglas de Firestore para habilitar reportes, chat y viajes para todos.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await ensureFirebaseAuthSession();
                  window.dispatchEvent(new CustomEvent('uppa-firestore-retry-sync'));
                  showToast('Reintentando conexión con Firestore...');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#101114] font-black text-[10.5px] cursor-pointer hover:brightness-95 active:scale-95 transition-all"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setFirestorePermissionAlert(null)}
                aria-label="Cerrar aviso de Firestore"
                className="p-1 rounded-lg text-amber-200 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {activeTab === 'map' && (
          <div className="relative w-full h-full flex flex-col">
            <div className="flex-1 w-full h-full">
              <TeslaMap
                routes={routes}
                events={eventsWithStreet}
                liveBuses={liveBuses}
                taxis={marketplaceTaxis}
                selectedEvent={selectedEventWithStreet}
                onSelectEvent={(ev) => {
                  clearSelectedEventAutoClose();
                  setSelectedEvent(ev);
                }}
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
                activeTrackingTaxi={liveActiveTrackingTaxi}
                onClearTrackingTaxi={() => setActiveTrackingTaxi(null)}
                onOpenPedirTransporte={() => setIsPedirTransporteOpen(true)}
                onAddEvent={handleCreateEvent}
                currentUserName={currentUser.name}
                currentUserId={currentUser.id}
                focusedStop={focusedStopOnMap}
                activeTrackingPassenger={liveActiveTrackingPassenger}
                onClearTrackingPassenger={() => setActiveTrackingPassenger(null)}
              />
            </div>

            {/* Icono pequeño (i) de información de funcionalidades de la sección Mapa */}
            <button
              type="button"
              onClick={() => setSectionInfoModal('map')}
              title="Ver funcionalidades de la sección Mapa"
              aria-label="Información de Mapa en Vivo"
              className="absolute top-3 left-3 z-20 w-7 h-7 rounded-full bg-[#202329]/90 backdrop-blur-md border border-white/25 hover:border-[#FFF19A] text-[#FFF19A] shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Tarjeta Glassmorphism iOS de Viaje Activo en Mapa (con Código de Viaje para el pasajero al confirmarse) */}
            {myLiveActiveSolicitud &&
              !activeTrackingPassenger &&
              !activeTrackingTaxi &&
              (myLiveActiveSolicitud.id === activeMapGlassRideId ? (
                <div className="absolute top-16 left-3 right-3 sm:left-4 sm:right-auto sm:w-[375px] z-20 pointer-events-auto">
                  <ActiveRideGlassWidget
                    solicitud={myLiveActiveSolicitud}
                    matchedDriver={matchedLiveDriver}
                    userLocation={userLocation}
                    isDriverViewer={false}
                    onLocateOnMap={() => {
                      if (matchedLiveDriver) {
                        setActiveTrackingTaxi(matchedLiveDriver);
                        showToast(`Trazando trayectoria con ${matchedLiveDriver.driverName}`);
                      } else {
                        setActiveTab('taxi');
                      }
                    }}
                    onOpenTaxiTab={() => setActiveTab('taxi')}
                    onClose={() => {
                      if (mapGlassAutoHideTimerRef.current) {
                        clearTimeout(mapGlassAutoHideTimerRef.current);
                        mapGlassAutoHideTimerRef.current = null;
                      }
                      setActiveMapGlassRideId(null);
                    }}
                  />
                </div>
              ) : (myLiveActiveSolicitud.estado === 'aceptado' || myLiveActiveSolicitud.estado === 'en_camino') &&
                myLiveActiveSolicitud.codigoSeguridad ? (
                <button
                  type="button"
                  onClick={() => setActiveMapGlassRideId(myLiveActiveSolicitud.id)}
                  title="Tocar para ver el detalle y Código de Viaje"
                  className="absolute top-14 left-3 z-20 px-3 py-2 rounded-2xl bg-[#101114]/95 border-2 border-[#FFF19A] text-white shadow-[0_6px_18px_rgba(0,0,0,0.65)] flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <KeyRound className="w-4 h-4 text-[#FFF19A] shrink-0" />
                  <span className="text-[11px] font-bold">Código de Viaje:</span>
                  <span className="font-mono font-black text-sm text-[#FFF19A] tracking-wider">
                    {myLiveActiveSolicitud.codigoSeguridad}
                  </span>
                </button>
              ) : null)}

            {/* Pop-up global de 5 segundos en la sección principal del mapa cuando un vehículo queda DESOCUPADO */}
            {desocupadoMapPopup && (
              <div
                role="status"
                aria-live="polite"
                className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-1.5rem)] max-w-md pointer-events-auto uppa-card-enter"
              >
                <div className="uppa-glass-ios rounded-2xl border-2 border-[#B7F36B] shadow-[0_12px_32px_rgba(0,0,0,0.72)] p-3.5 text-white flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDesocupadoMapPopup(null);
                      setActiveTab('taxi');
                    }}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
                    title="Ir a Taxis & Motos para solicitar este vehículo disponible"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center shrink-0 border border-[#101114]">
                      {desocupadoMapPopup.vehicleType === 'moto' ? (
                        <Bike className="w-5 h-5" />
                      ) : (
                        <Car className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-[13px] font-black text-[#B7F36B] group-hover:text-[#FFF19A] transition-colors leading-snug tracking-wide">
                        VEHICULO DESOCUPADO IR A TAXIS &amp; MOTOS
                      </p>
                      <p className="text-[11px] text-white/85 truncate mt-0.5">
                        {desocupadoMapPopup.driverName} · Disponible ahora
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDesocupadoMapPopup(null)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                    title="Cerrar aviso"
                    aria-label="Cerrar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Cartel Oficial de Alerta Push de Administración UPPA en la sección del Mapa (5 segundos) */}
            {mapAdminAlert && mapAdminAlert.expiresAt !== null && (() => {
              const remainingMs = Math.max(0, mapAdminAlert.expiresAt - mapAdminAlertNow);
              if (remainingMs <= 0) return null;
              const progressPct = Math.max(0, Math.min(100, (remainingMs / 5000) * 100));

              return (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-[45] w-[calc(100vw-2rem)] max-w-md pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200"
                >
                  <div className="rounded-2xl bg-[#101114]/95 backdrop-blur-xl border-2 border-[#FFF19A] shadow-[0_12px_34px_rgba(0,0,0,0.82)] overflow-hidden text-white">
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#FFF19A] text-[#101114] border border-[#101114] flex items-center justify-center shrink-0">
                            <Radio className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-[#FFF19A]/20 text-[#FFF19A] border border-[#FFF19A]/45 text-[9.5px] font-black uppercase tracking-wide">
                                Alerta Oficial UPPA
                              </span>
                              <span className="text-[10px] font-mono font-bold text-[#B7F36B]">
                                {(remainingMs / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-black text-white leading-snug mt-1">
                              {mapAdminAlert.title}
                            </h4>
                            {mapAdminAlert.body && (
                              <p className="text-[11px] sm:text-xs text-white/85 leading-snug mt-0.5">
                                {mapAdminAlert.body}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMapAdminAlert(null)}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                          title="Cerrar cartel"
                          aria-label="Cerrar cartel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px] text-[#9299A5]">
                        <span>También publicado en el Chat General</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMapAdminAlert(null);
                            setActiveTab('chat');
                          }}
                          className="px-2 py-1 rounded-lg bg-[#202329] hover:border-[#FFF19A] border border-white/15 text-[#FFF19A] font-bold cursor-pointer transition-colors"
                        >
                          Ver en Chat
                        </button>
                      </div>
                    </div>

                    <div className="h-1 w-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-[#FFF19A] to-[#B7F36B] transition-[width] duration-100 ease-linear"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

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
                busEvents={eventsWithStreet.filter((e) => e.type === 'bus_location')}
              />
            </div>

            <EventBottomSheet
              event={selectedEventWithStreet}
              currentUserId={currentUser.id}
              onClose={() => {
                clearSelectedEventAutoClose();
                setSelectedEvent(null);
              }}
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
            currentUserRole={isDriverHabilitado ? 'driver' : currentUser.role}
            isDriverHabilitado={isDriverHabilitado}
            userLocation={userLocation}
            onOpenInfo={() => setSectionInfoModal('taxi')}
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
            onOpenInfo={() => setSectionInfoModal('chat')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            events={eventsWithStreet}
            ads={ads}
            taxis={taxis}
            onDeleteEvent={handleDeleteEvent}
            onVerifyEvent={handleVerifyEvent}
            onBroadcastAlert={handleBroadcastAlert}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* Barra Flotante de Acceso Rápido al Chat Comunitario (visible en otras pantallas excepto Chat y Taxis & Motos por 4.5s) */}
      {activeTab !== 'chat' && activeTab !== 'taxi' && latestCommunityMessage && latestCommunityMessage.id !== dismissedChatMsgId && (
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
                    Escribió en Chat
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
      <nav className="shrink-0 bg-[#101114] border-t-2 border-white/15 px-1 py-1.5 z-40 safe-area-pb">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-0.5 sm:gap-1">
          {/* Tab 1: Mapa */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('map');
            }}
            title="Ver mapa en vivo, recorridos y colectivos"
            className={`flex-1 min-w-0 min-h-[48px] py-1 px-0.5 sm:px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group active:scale-95 ${
              activeTab === 'map'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all border ${
                activeTab === 'map'
                  ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[0_0_10px_rgba(255,241,154,0.35)]'
                  : 'bg-[#202329] border-white/20 text-[#9299A5] group-hover:text-[#FFF19A] group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)]'
              }`}
            >
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Mapa</span>
          </button>

          {/* Botón 2: Mi ubicación */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('map');
              if (!userLocation) {
                setIsLocationModalOpen(true);
              } else {
                window.dispatchEvent(new CustomEvent('uppa-map-locate-me'));
                showToast('Centrando en tu ubicación GPS');
              }
            }}
            className="flex-1 min-w-0 min-h-[48px] py-1 px-0.5 sm:px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer text-[#9299A5] hover:text-white group active:scale-95"
            title="Centrar el mapa en mi ubicación GPS actual"
          >
            <div className="p-1.5 rounded-lg bg-[#202329] border border-white/20 group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-[#B7F36B] transition-all">
              <Navigation className="w-4 h-4" />
            </div>
            <span className="text-[9px] sm:text-[9.5px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-[#9299A5] group-hover:text-white">
              Mi ubicacion
            </span>
          </button>

          {/* Botón 3: Enfocar */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('map');
              window.dispatchEvent(new CustomEvent('uppa-map-fit-route'));
              showToast('Enfocando traza completa Malvinas ↔ Zárate');
            }}
            className="flex-1 min-w-0 min-h-[48px] py-1 px-0.5 sm:px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer text-[#9299A5] hover:text-white group active:scale-95"
            title="Enfocar el recorrido completo en el mapa"
          >
            <div className="p-1.5 rounded-lg bg-[#202329] border border-white/20 group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)] text-white group-hover:text-[#FFF19A] transition-all">
              <Maximize2 className="w-4 h-4" />
            </div>
            <span className="text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap text-[#9299A5] group-hover:text-white">
              Enfocar
            </span>
          </button>

          {/* Tab 4: Taxi & Motos */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('taxi');
            }}
            title="Ir a Taxis & Motos para pedir o ver prestadores habilitados"
            className={`flex-1 min-w-0 min-h-[48px] py-1 px-0.5 sm:px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group active:scale-95 ${
              activeTab === 'taxi'
                ? 'text-[#B7F36B] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all flex items-center -space-x-1 border ${
                activeTab === 'taxi'
                  ? 'bg-[#B7F36B] border-[#B7F36B] text-[#101114] shadow-[0_0_10px_rgba(183,243,107,0.35)]'
                  : 'bg-[#202329] border-white/20 text-[#9299A5] group-hover:text-[#FFF19A] group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)]'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <Car className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap">
              Taxi &amp; Motos
            </span>
          </button>

          {/* Tab 5: Chat Comunitario */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('chat');
            }}
            title="Abrir el chat comunitario de pasajeros y prestadores"
            className={`flex-1 min-w-0 min-h-[48px] py-1 px-0.5 sm:px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative group active:scale-95 ${
              activeTab === 'chat'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all relative border ${
                activeTab === 'chat'
                  ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[0_0_10px_rgba(255,241,154,0.35)]'
                  : 'bg-[#202329] border-white/20 text-[#9299A5] group-hover:text-[#FFF19A] group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {communityChatList.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-[#B7F36B] text-[#101114] font-black text-[8.5px] min-w-3.5 text-center border border-[#101114]">
                  {communityChatList.length}
                </span>
              )}
            </div>
            <span className="text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 font-bold">Chat</span>
          </button>

          {/* Tab 6: Ticket de consulta */}
          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              setIsTicketModalOpen(true);
            }}
            title="Ticket de consulta"
            aria-label="Ticket de consulta"
            className={`flex-1 min-w-0 min-h-[48px] py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group active:scale-95 ${
              isTicketModalOpen
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all border ${
                isTicketModalOpen
                  ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[0_0_10px_rgba(255,241,154,0.35)]'
                  : 'bg-[#202329] border-white/20 text-[#9299A5] group-hover:text-[#FFF19A] group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)]'
              }`}
            >
              <Ticket className="w-4 h-4" />
            </div>
            <span className="text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap">Ticket</span>
          </button>

          {/* Botón Compartir QR (solo icono, sin texto, entre Ticket y Admin) */}
          <button
            type="button"
            onClick={() => {
              playMicroSound('ui_tap');
              setIsShareQrModalOpen(true);
            }}
            title="Compartir App UPPA con código QR"
            aria-label="Compartir App UPPA con código QR"
            className="shrink-0 min-h-[48px] px-1 sm:px-1.5 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-95"
          >
            <div
              className={`p-2 rounded-xl transition-all border ${
                isShareQrModalOpen
                  ? 'bg-[#B7F36B] border-[#B7F36B] text-[#101114] shadow-[0_0_12px_rgba(183,243,107,0.45)]'
                  : 'bg-[#202329] border-[#B7F36B]/45 text-[#B7F36B] group-hover:border-[#B7F36B] group-hover:shadow-[0_0_12px_rgba(183,243,107,0.45)]'
              }`}
            >
              <QrCode className="w-5 h-5" />
            </div>
          </button>

          {/* Tab 7: Admin */}
          <button
            onClick={() => {
              playMicroSound('ui_tap');
              setActiveTab('admin');
            }}
            title="Abrir el panel de Administración UPPA"
            className={`flex-1 min-w-0 min-h-[48px] py-1 px-0.5 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group active:scale-95 ${
              activeTab === 'admin'
                ? 'text-[#FFF19A] font-black'
                : 'text-[#9299A5] hover:text-white'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-all border ${
                activeTab === 'admin'
                  ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[0_0_10px_rgba(255,241,154,0.35)]'
                  : 'bg-[#202329] border-white/20 text-[#9299A5] group-hover:text-[#FFF19A] group-hover:border-[#FFF19A] group-hover:shadow-[0_0_10px_rgba(255,241,154,0.45)]'
              }`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[9.5px] sm:text-[10px] tracking-tight mt-0.5 font-bold whitespace-nowrap">Admin</span>
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
        currentUserPhone={currentUser.phone}
        initialOrigin={userLocation?.address || 'Campana Centro (Plaza Eduardo Costa)'}
        userLocation={userLocation}
        onSuccess={() => {
          showToast('¡Aviso emitido! Solo los choferes disponibles recibirán tu solicitud.');
          setActiveTab('taxi');
        }}
      />

      <PublishTaxiModal
        isOpen={isPublishTaxiOpen}
        initialTab={publishTaxiInitialTab}
        initialVehicleType={publishTaxiInitialVehicle}
        onClose={() => setIsPublishTaxiOpen(false)}
        onSubmit={handlePublishTaxi}
        onActivateDriverSession={(session) => {
          playMicroSound('payment_done');
          setManualPasajeroOverride(false);
          try {
            localStorage.removeItem('uppa_manual_pasajero_override');
          } catch {}
          setDriverSession(session);
          setCurrentUser((prev) => ({
            ...prev,
            role: 'driver',
            rol: session.vehicleType === 'moto' ? 'chofer_moto' : 'chofer_auto',
            esChofer: true,
            tipoVehiculo: session.vehicleType,
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
        events={eventsWithStreet}
        taxis={taxis}
      />

      <TicketConsultaModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        currentUserName={currentUser.name}
        currentUserEmail={currentUser.email}
        currentUserRole={currentUser.rol || currentUser.role}
        onSubmitted={() =>
          showToast('Ticket listo para enviar a uppatransportecolaborativo@gmail.com')
        }
      />

      <SectionInfoSheetModal
        isOpen={Boolean(sectionInfoModal)}
        initialSection={sectionInfoModal || 'map'}
        onClose={() => setSectionInfoModal(null)}
      />

      <ShareQrModal
        isOpen={isShareQrModalOpen}
        onClose={() => setIsShareQrModalOpen(false)}
        onCopied={(msg) => showToast(msg)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalDefaultMode(undefined);
        }}
        currentUser={currentUser}
        defaultMode={authModalDefaultMode}
        focusEmailVerificationTick={emailVerificationFocusTick}
        isHabilitado={hasActivePaidDriverHabilitacion}
        onOpenPublishTaxi={(vehicleType) => {
          setPublishTaxiInitialTab('transfer');
          if (vehicleType) {
            setPublishTaxiInitialVehicle(vehicleType);
          } else if (currentUser.rol === 'chofer_moto' || currentUser.tipoVehiculo === 'moto') {
            setPublishTaxiInitialVehicle('moto');
          } else {
            setPublishTaxiInitialVehicle('auto');
          }
          setIsPublishTaxiOpen(true);
        }}
        onUpdateUser={(updated) => {
          const roleChanged =
            updated.role !== currentUser.role || updated.rol !== currentUser.rol;
          if (updated.rol === 'pasajero' && !updated.esChofer) {
            setManualPasajeroOverride(true);
            try {
              localStorage.setItem('uppa_manual_pasajero_override', '1');
            } catch {}
          } else if (
            updated.esChofer ||
            updated.rol === 'chofer_moto' ||
            updated.rol === 'chofer_auto' ||
            updated.role === 'driver'
          ) {
            setManualPasajeroOverride(false);
            try {
              localStorage.removeItem('uppa_manual_pasajero_override');
            } catch {}
          }
          setCurrentUser(updated);
          if (roleChanged && !userLocation) setIsLocationModalOpen(true);
          showToast(
            updated.esChofer || updated.rol?.includes('chofer')
              ? `Rol activo: Prestador (${updated.tipoVehiculo === 'moto' ? 'Moto Taxi' : 'Auto Taxi'})`
              : updated.role === 'admin'
              ? 'Rol activo: Administrador UPPA'
              : 'Rol activo: Pasajero'
          );
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
