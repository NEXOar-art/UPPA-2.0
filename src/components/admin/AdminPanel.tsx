import React, { useState, useEffect } from 'react';
import {
  MapEvent,
  AdListing,
  TaxiListing,
  HabilitacionChofer,
  UsuarioFirestore,
  ReporteFirestore,
  SolicitudTransporteFirestore,
  MensajeChatFirestore,
  AnalyticsSummary,
  User,
} from '../../types';
import {
  ADMIN_MASTER_PIN,
  subscribeToUsuarios,
  actualizarEstadoUsuario,
  actualizarRolUsuario,
  eliminarUsuarioFirestore,
  subscribeToReportes,
  actualizarEstadoReporte,
  eliminarReporte,
  subscribeToChat,
  eliminarMensajeChat,
  subscribeToSolicitudesTransporte,
  actualizarEstadoSolicitud,
  subscribeToHabilitacionesChofer,
  habilitarChoferConClaveAdmin,
  revocarHabilitacionChofer,
  obtenerMetricasEnTiempoReal,
  triggerInAppPushNotification,
  crearCodigoHabilitacion,
  suscribirCodigosHabilitacion,
  obtenerHabilitacionesActuales,
} from '../../services/realtimeFirebaseService';
import { getTimerState } from '../../services/driverActivationService';
import { UppaDatabaseViewer } from './UppaDatabaseViewer';
import { AdminRealtimeCharts } from './AdminRealtimeCharts';
import {
  Shield,
  KeyRound,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Car,
  Bike,
  Users,
  MessageSquare,
  BarChart3,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Copy,
  Send,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  MapPin,
  ExternalLink,
  Database,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminPanelProps {
  events: MapEvent[];
  ads: AdListing[];
  taxis: TaxiListing[];
  onDeleteEvent: (eventId: string) => void;
  onVerifyEvent: (eventId: string) => void;
  onBroadcastAlert: (title: string, description: string) => void;
  currentUser?: User;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  events,
  taxis,
  onBroadcastAlert,
}) => {
  // Acceso protegido por Clave PIN ("0608") + bloqueo anti fuerza bruta
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('uppa_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState<number>(0);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'choferes' | 'usuarios' | 'database' | 'reportes' | 'chat' | 'solicitudes' | 'metricas' | 'graficos' | 'alerta'
  >('choferes');

  // Real-Time Firestore State
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [reportes, setReportes] = useState<ReporteFirestore[]>([]);
  const [chatMessages, setChatMessages] = useState<MensajeChatFirestore[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);
  const [habilitaciones, setHabilitaciones] = useState<HabilitacionChofer[]>([]);
  const [metricas, setMetricas] = useState<AnalyticsSummary | null>(null);

  const [activeChatChannel, setActiveChatChannel] = useState<'campana-zarate' | 'zarate-campana' | 'general'>('campana-zarate');
  const [searchFilter, setSearchFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Driver Enablement State
  const [selectedHabIdForActivation, setSelectedHabIdForActivation] = useState<string | null>(null);
  const [adminActivationPin, setAdminActivationPin] = useState('');
  const [activationHours, setActivationHours] = useState<number>(12);
  const [isEnablingDriver, setIsEnablingDriver] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Inline Confirmations (replacing window.confirm)
  const [confirmRevokeHabId, setConfirmRevokeHabId] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [confirmDeleteReportId, setConfirmDeleteReportId] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);

  // Sistema de Códigos Únicos Firestore
  const [firestoreCodigos, setFirestoreCodigos] = useState<any[]>([]);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);

  // Broadcast Alert State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDesc, setBroadcastDesc] = useState('');

  // Live Timer ticker
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showErrorBanner = (msg: string) => {
    setActionErrorMessage(msg);
    setTimeout(() => setActionErrorMessage(null), 4500);
  };

  const showSuccessBanner = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handleGenerarCodigo = async (tipoVehiculo: 'moto' | 'auto') => {
    setIsGeneratingCode(true);
    try {
      const code = await crearCodigoHabilitacion(tipoVehiculo);
      setLastGeneratedCode(code);
      showSuccessBanner(`¡Código único ${code} generado en Firestore para ${tipoVehiculo === 'moto' ? 'Moto' : 'Auto'}!`);
    } catch (e: any) {
      showErrorBanner(e.message || 'Error al generar código');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  useEffect(() => {
    if (!isAdminUnlocked) return;

    const unsubUsuarios = subscribeToUsuarios((list) => setUsuarios(list));
    const unsubReportes = subscribeToReportes((list) => setReportes(list));
    const unsubSolicitudes = subscribeToSolicitudesTransporte((list) => setSolicitudes(list));
    const unsubHabilitaciones = subscribeToHabilitacionesChofer((list) => setHabilitaciones(list));
    const unsubCodigos = suscribirCodigosHabilitacion((list) => setFirestoreCodigos(list));

    obtenerMetricasEnTiempoReal().then((m) => setMetricas(m));

    return () => {
      unsubUsuarios();
      unsubReportes();
      unsubSolicitudes();
      unsubHabilitaciones();
      unsubCodigos();
    };
  }, [isAdminUnlocked]);

  useEffect(() => {
    if (!isAdminUnlocked) return;
    const unsubChat = subscribeToChat(activeChatChannel, (msgs) => setChatMessages(msgs));
    return () => unsubChat();
  }, [isAdminUnlocked, activeChatChannel]);

  const handleUnlockWithPin = (e?: React.FormEvent, customValue?: string) => {
    if (e) e.preventDefault();

    if (pinLockedUntil > Date.now()) {
      const secs = Math.ceil((pinLockedUntil - Date.now()) / 1000);
      setPinError(`Demasiados intentos fallidos. Esperá ${secs}s para volver a intentar.`);
      return;
    }

    const candidate = (customValue !== undefined ? customValue : pinInput).trim();
    const cleanLower = candidate.toLowerCase();

    const isValid =
      candidate === ADMIN_MASTER_PIN ||
      cleanLower === '0608' ||
      cleanLower === 'admin0608' ||
      cleanLower === 'uppa0608';

    if (isValid) {
      setFailedPinAttempts(0);
      setPinLockedUntil(0);
      setIsAdminUnlocked(true);
      try {
        sessionStorage.setItem('uppa_admin_unlocked', 'true');
      } catch {}
      setPinError(null);
      showSuccessBanner('¡Acceso administrativo habilitado con éxito!');
    } else {
      const nextAttempts = failedPinAttempts + 1;
      setFailedPinAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setPinLockedUntil(Date.now() + 30000);
        setFailedPinAttempts(0);
        setPinError('Demasiados intentos fallidos. Acceso bloqueado por 30 segundos.');
      } else {
        setPinError(`Código de acceso incorrecto (${nextAttempts}/5 intentos).`);
      }
    }
  };

  const handleLockAdmin = () => {
    try {
      sessionStorage.removeItem('uppa_admin_unlocked');
      localStorage.removeItem('uppa_admin_unlocked');
      sessionStorage.setItem('uppa_admin_unlocked', 'false');
    } catch {}
    setIsAdminUnlocked(false);
    setPinInput('');
    setPinError(null);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
  };

  const handleHabilitarChofer = async (habId: string) => {
    const pin = adminActivationPin.trim();
    if (pin !== ADMIN_MASTER_PIN && pin.toLowerCase() !== '0608') {
      showErrorBanner('Clave de administrador incorrecta.');
      return;
    }

    setIsEnablingDriver(true);
    try {
      const res = await habilitarChoferConClaveAdmin(habId, ADMIN_MASTER_PIN, activationHours);
      showSuccessBanner(res.message);
      setSelectedHabIdForActivation(null);
    } catch (err: any) {
      showErrorBanner(err.message || 'Error al habilitar chofer');
    } finally {
      setIsEnablingDriver(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const tabsScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      tabsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // PIN Unlock Screen
  if (!isAdminUnlocked) {
    const lockRemainingSecs = pinLockedUntil > nowTick ? Math.ceil((pinLockedUntil - nowTick) / 1000) : 0;

    return (
      <div className="flex-1 w-full h-full overflow-y-auto bg-[#101114] p-4 flex items-center justify-center min-h-[75vh]">
        <div className="w-full max-w-md bg-[#202329] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#000000] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="h-1.5 bg-[#FFF19A] absolute top-0 left-0 right-0" />

          <div className="flex items-center gap-3 mb-6 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/50 flex items-center justify-center text-[#FFF19A]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white font-display tracking-tight uppercase">
                Panel de Administración
              </h1>
              <p className="text-xs text-[#9299A5] font-medium">
                UPPA Comunidad de Transporte · Acceso Restringido
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlockWithPin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white mb-2">
                Código de Acceso de Administrador
              </label>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  disabled={lockRemainingSecs > 0}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  placeholder={lockRemainingSecs > 0 ? `Bloqueado (${lockRemainingSecs}s)` : 'Ingresá el código de acceso'}
                  className="w-full min-h-[48px] pl-4 pr-12 rounded-xl bg-[#101114] border-2 border-white/15 text-white font-mono text-center text-lg tracking-widest focus:outline-none focus:border-[#FFF19A] transition-all placeholder:text-[#9299A5] placeholder:text-xs placeholder:tracking-normal disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                  title={showPin ? 'Ocultar código de acceso' : 'Mostrar código de acceso'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pinError && <p className="text-xs text-rose-400 font-bold mt-2">{pinError}</p>}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={lockRemainingSecs > 0}
                title="Verificar código e ingresar al Panel de Administración UPPA"
                className="w-full min-h-[48px] rounded-xl uppa-cta-yellow font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>
                  {lockRemainingSecs > 0
                    ? `Reintentar en ${lockRemainingSecs}s`
                    : 'Ingresar al Panel'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const getHabTimestamp = (hab: HabilitacionChofer): number => {
    if (typeof hab.createdAt === 'number') return hab.createdAt;
    if (hab.createdAt?.toMillis) return hab.createdAt.toMillis();
    if (hab.createdAt) {
      const ms = new Date(hab.createdAt).getTime();
      if (!isNaN(ms)) return ms;
    }
    return 0;
  };

  const HABILITACION_TIMEOUT_MS = 25 * 60 * 1000;

  const pendingHabilitaciones = habilitaciones.filter((h) => {
    if (h.estado !== 'pendiente' || h.id === 'hab-2' || h.driverId === 'drv-carlos') return false;
    const createdMs = getHabTimestamp(h);
    if (createdMs > 0 && nowTick - createdMs > HABILITACION_TIMEOUT_MS) {
      return false;
    }
    return true;
  });

  const activeHabilitaciones = habilitaciones.filter(
    (h) => h.estado === 'activo' && Boolean(h.endsAt && h.endsAt > nowTick)
  );

  const ADMIN_TABS = [
    {
      id: 'choferes' as const,
      label: 'Habilitación de Choferes',
      shortLabel: 'Choferes',
      icon: <KeyRound className="w-3.5 h-3.5" />,
      badge: pendingHabilitaciones.length > 0 ? pendingHabilitaciones.length : null,
      badgeColor: 'bg-[#FFF19A] text-[#101114]',
      description: 'Aprobación de transferencias y alta de turnos',
    },
    {
      id: 'usuarios' as const,
      label: 'Usuarios Registrados',
      shortLabel: 'Usuarios',
      icon: <Users className="w-3.5 h-3.5" />,
      badge: usuarios.length,
      badgeColor: 'bg-white/15 text-white border border-white/20',
      description: 'Padrón de cuentas y roles de la app',
    },
    {
      id: 'database' as const,
      label: 'Base de Datos de Usuarios',
      shortLabel: 'Base de Datos',
      icon: <Database className="w-3.5 h-3.5" />,
      badge: null,
      description: 'Visualizador de registros y credenciales',
    },
    {
      id: 'reportes' as const,
      label: 'Reportes e Incidentes',
      shortLabel: 'Reportes',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      badge: reportes.length,
      badgeColor: 'bg-[#FFF19A]/20 text-[#FFF19A] border border-[#FFF19A]/40',
      description: 'Alertas en vivo aportadas por la comunidad',
    },
    {
      id: 'chat' as const,
      label: 'Moderación de Chat',
      shortLabel: 'Chat',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      badge: chatMessages.length,
      badgeColor: 'bg-[#B7F36B]/20 text-[#B7F36B] border border-[#B7F36B]/40',
      description: 'Mensajes en tiempo real entre pasajeros y choferes',
    },
    {
      id: 'solicitudes' as const,
      label: 'Viajes Alternativos',
      shortLabel: 'Viajes',
      icon: <Car className="w-3.5 h-3.5" />,
      badge: solicitudes.length,
      badgeColor: 'bg-white/15 text-white border border-white/20',
      description: 'Pedidos de autos y motos emitidos por pasajeros',
    },
    {
      id: 'metricas' as const,
      label: 'Métricas en Vivo',
      shortLabel: 'Métricas',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      badge: null,
      description: 'Resumen consolidado de operaciones',
    },
    {
      id: 'graficos' as const,
      label: 'Gráficos Analíticos',
      shortLabel: 'Gráficos',
      icon: <Activity className="w-3.5 h-3.5 text-[#B7F36B]" />,
      badge: null,
      description: 'Curvas de demanda, congestión y horarios',
    },
    {
      id: 'alerta' as const,
      label: 'Transmitir Alerta Push',
      shortLabel: 'Alerta Push',
      icon: <Radio className="w-3.5 h-3.5" />,
      badge: null,
      description: 'Notificación oficial a todas las pantallas',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#101114] p-3 sm:p-5 flex flex-col gap-4 text-white">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[#202329] border-2 border-white/15 p-4 rounded-2xl shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/50 flex items-center justify-center text-[#FFF19A]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-white font-display uppercase tracking-tight">
                Administración UPPA
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[#B7F36B]/15 border border-[#B7F36B]/45 text-[10px] font-black text-[#B7F36B] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B7F36B] animate-pulse" />
                Tiempo Real Activo
              </span>
            </div>
            <p className="text-xs text-[#9299A5]">
              Panel Oficial de Gestión · Conectado a Firestore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              const m = await obtenerMetricasEnTiempoReal();
              setMetricas(m);
              setHabilitaciones(obtenerHabilitacionesActuales());
              setIsRefreshing(false);
              showSuccessBanner('Métricas y solicitudes sincronizadas con Firestore');
            }}
            className="min-h-[40px] px-3 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            disabled={isRefreshing}
            title="Actualizar métricas y solicitudes desde Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FFF19A] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={handleLockAdmin}
            className="min-h-[40px] px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Bloquear panel de administración y volver a solicitar clave"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {actionSuccessMessage && (
        <div className="bg-[#202329] border-2 border-[#B7F36B] text-[#B7F36B] text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {actionErrorMessage && (
        <div className="bg-rose-950/50 border-2 border-rose-400/60 text-rose-200 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <div className="bg-[#202329] border-2 border-white/15 rounded-2xl p-3 space-y-2.5 shadow-[4px_4px_0px_#000000]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-[#9299A5] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#FFF19A] animate-pulse" />
              Sección activa:
            </span>
            <div className="relative flex-1 sm:w-72">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                aria-label="Seleccionar sección de administración"
                className="w-full appearance-none bg-[#101114] border-2 border-white/20 hover:border-[#FFF19A] text-white font-bold text-xs rounded-xl px-3 min-h-[40px] pr-9 focus:outline-none focus:border-[#FFF19A] cursor-pointer transition-colors"
              >
                {ADMIN_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id} className="bg-[#101114] text-white py-1">
                    {tab.label} {tab.badge ? `(${tab.badge})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#FFF19A] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
            <span className="text-[11px] text-[#9299A5] hidden md:inline">Navegar pestañas:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                title="Desplazar pestañas hacia la izquierda"
                className="w-9 h-9 rounded-lg bg-[#101114] hover:bg-white/10 text-[#9299A5] hover:text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                title="Desplazar pestañas hacia la derecha"
                className="w-9 h-9 rounded-lg bg-[#101114] hover:bg-white/10 text-[#9299A5] hover:text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={tabsScrollRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {ADMIN_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                type="button"
                title={tab.description}
                className={`shrink-0 px-3.5 min-h-[40px] rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 border-2 select-none cursor-pointer ${
                  isActive
                    ? 'bg-[#FFF19A] text-[#101114] border-white/25'
                    : 'text-[#9299A5] hover:text-white bg-[#101114] hover:bg-white/5 border-white/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== null && tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black min-w-[18px] text-center ${
                      isActive ? 'bg-[#101114] text-[#FFF19A]' : tab.badgeColor || 'bg-white/10 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#9299A5] px-1 pt-1 border-t border-white/10">
          <span className="truncate">
            <strong className="text-[#FFF19A] font-bold">
              {ADMIN_TABS.find((t) => t.id === activeTab)?.label}:
            </strong>{' '}
            {ADMIN_TABS.find((t) => t.id === activeTab)?.description}
          </span>
          <span className="text-[10px] text-[#9299A5] font-mono hidden sm:inline shrink-0 ml-2">
            Panel Oficial UPPA
          </span>
        </div>
      </div>

      {/* TAB 1: HABILITACIÓN DE CHOFERES */}
      {activeTab === 'choferes' && (
        <div className="space-y-4">
          <div className="bg-[#202329] border-2 border-[#B7F36B]/45 rounded-2xl p-4 shadow-[4px_4px_0px_#000000]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#B7F36B] bg-[#B7F36B]/15 px-2 py-0.5 rounded-md border border-[#B7F36B]/40">
                  Cuenta Oficial Habilitada de Transferencias
                </span>
                <h3 className="text-base font-black text-white mt-1.5">
                  Habilitación de Chofer (Moto / Auto Taxi)
                </h3>
              </div>
              <a
                href="https://wa.me/5493489690058"
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir WhatsApp oficial de verificación 3489690058"
                className="px-3.5 min-h-[42px] rounded-xl uppa-cta-green font-black text-xs flex items-center gap-1.5 transition-all"
              >
                <span>WhatsApp de Verificación: 3489690058</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#101114] p-3 rounded-xl border border-white/10">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#202329] border border-white/10">
                <div>
                  <span className="text-[10px] text-[#9299A5] block">Alias de Transferencia:</span>
                  <span className="font-mono font-bold text-[#B7F36B]">luciaveronicag</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('luciaveronicag', 'alias')}
                  className="p-2 rounded-lg text-[#9299A5] hover:text-white cursor-pointer"
                  title="Copiar alias luciaveronicag"
                >
                  {copiedKey === 'alias' ? <Check className="w-4 h-4 text-[#B7F36B]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#202329] border border-white/10">
                <div>
                  <span className="text-[10px] text-[#9299A5] block">CVU:</span>
                  <span className="font-mono font-bold text-white">0000003100020253501840</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('0000003100020253501840', 'cvu')}
                  className="p-2 rounded-lg text-[#9299A5] hover:text-white cursor-pointer"
                  title="Copiar CVU oficial"
                >
                  {copiedKey === 'cvu' ? <Check className="w-4 h-4 text-[#B7F36B]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#202329] border border-white/10">
                <div>
                  <span className="text-[10px] text-[#9299A5] block">Titular:</span>
                  <span className="font-bold text-white">Lucia Veronica Gimenez</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#B7F36B]/15 text-[#B7F36B] font-black border border-[#B7F36B]/40">
                  Verificado
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#9299A5] mt-2.5">
              💡 <strong className="text-white">Regla del sistema:</strong> El código no lo pone el conductor. Cuando el chofer envía el comprobante de transferencia al WhatsApp <strong className="text-white">3489690058</strong>, el administrador habilita el tiempo pagado una vez verificado y comienza el temporizador en vivo.
            </p>
          </div>

          {/* Pending Driver Requests */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFF19A] animate-pulse" />
              Solicitudes Pendientes de Choferes ({pendingHabilitaciones.length})
            </h3>

            {pendingHabilitaciones.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#202329] border-2 border-white/10 text-[#9299A5] text-xs space-y-1.5">
                <p className="font-bold text-white">
                  No hay solicitudes de choferes pendientes de habilitación en este momento.
                </p>
                <p className="text-[11px]">
                  Las solicitudes aparecerán aquí en tiempo real cuando los prestadores transfieran y envíen su solicitud (vigencia 25 minutos).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingHabilitaciones.map((hab) => {
                  const createdMs = getHabTimestamp(hab);
                  const remainingMs =
                    createdMs > 0
                      ? Math.max(0, HABILITACION_TIMEOUT_MS - (nowTick - createdMs))
                      : HABILITACION_TIMEOUT_MS;
                  const remMins = Math.floor(remainingMs / 60000);
                  const remSecs = Math.floor((remainingMs % 60000) / 1000);
                  const formattedPendingTimer = `${remMins}:${remSecs.toString().padStart(2, '0')}`;

                  return (
                    <div
                      key={hab.id}
                      className="p-4 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/45 shadow-[4px_4px_0px_#000000] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#101114] border border-[#FFF19A]/45 flex items-center justify-center text-[#FFF19A]">
                            {hab.vehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white">{hab.driverName}</h4>
                            <span className="text-[11px] text-[#9299A5] block">
                              {hab.vehicleModel} · {hab.vehicleType.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-[#FFF19A]/15 border border-[#FFF19A]/45 text-[10px] font-black text-[#FFF19A]">
                            Estado: Pendiente
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[9.5px] font-mono font-bold text-rose-300 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formattedPendingTimer} restante</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 bg-[#101114] p-2.5 rounded-xl border border-white/10">
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">WhatsApp:</span>
                          <a
                            href={`https://wa.me/${hab.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Escribir por WhatsApp a ${hab.driverName}`}
                            className="text-[#B7F36B] font-bold hover:underline"
                          >
                            +{hab.whatsapp}
                          </a>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">Zona:</span>
                          <span className="text-white">{hab.zone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">Tiempo Solicitado:</span>
                          <span className="font-bold text-[#FFF19A]">{hab.horas} horas</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#9299A5]">Confort / Capacidad:</span>
                          <span className="text-[#B7F36B] font-semibold text-right">
                            {hab.vehicleType === 'moto'
                              ? `${hab.cascoExtra !== false ? '🪖 Casco extra' : 'Sin casco'}${hab.baul !== false ? ' · 📦 Baúl' : ''}`
                              : `${hab.asientos || 4} asientos${hab.aireAcondicionado !== false ? ' · ❄️ Aire' : ''}${hab.baul !== false ? ' · 🧳 Baúl' : ''}${hab.aceptaMascotas ? ' · 🐾 Mascotas' : ''}`}
                          </span>
                        </div>
                        {hab.comprobanteFileName && (
                          <div className="flex justify-between">
                            <span className="text-[#9299A5]">Comprobante:</span>
                            <span className="font-mono text-[11px] text-[#FFF19A] truncate max-w-[180px]">
                              {hab.comprobanteFileName}
                            </span>
                          </div>
                        )}
                      </div>

                      {selectedHabIdForActivation === hab.id ? (
                        <div className="p-3 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/45 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-black text-[#FFF19A]">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Habilitar con Clave de Administrador</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#9299A5] block mb-1">Clave Admin</label>
                              <input
                                type="password"
                                value={adminActivationPin}
                                onChange={(e) => setAdminActivationPin(e.target.value)}
                                placeholder="••••"
                                className="w-full min-h-[38px] px-2.5 rounded-lg bg-[#202329] border border-[#FFF19A]/40 text-white font-mono text-center text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#9299A5] block mb-1">Horas Pagadas</label>
                              <select
                                value={activationHours}
                                onChange={(e) => setActivationHours(Number(e.target.value))}
                                className="w-full min-h-[38px] px-2 rounded-lg bg-[#202329] border border-[#FFF19A]/40 text-white text-xs font-bold"
                              >
                                <option value={2}>2 horas</option>
                                <option value={6}>6 horas</option>
                                <option value={12}>12 horas</option>
                                <option value={24}>24 horas (1 día)</option>
                                <option value={48}>48 horas (2 días)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleHabilitarChofer(hab.id)}
                              disabled={isEnablingDriver}
                              title="Confirmar clave y activar temporizador de servicio para el chofer"
                              className="flex-1 min-h-[42px] rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>{isEnablingDriver ? 'Iniciando...' : 'Habilitar y Comenzar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedHabIdForActivation(null)}
                              title="Cancelar habilitación"
                              className="min-h-[42px] px-3 rounded-xl bg-[#202329] border border-white/15 text-[#9299A5] hover:text-white text-xs font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHabIdForActivation(hab.id);
                              setActivationHours(hab.horas || 12);
                              setAdminActivationPin('');
                            }}
                            title={`Habilitar servicio de ${hab.driverName}`}
                            className="flex-1 min-h-[44px] rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Habilitar Chofer</span>
                          </button>
                          <a
                            href={`https://wa.me/${hab.whatsapp}?text=${encodeURIComponent(
                              `Hola ${hab.driverName}! Recibimos tu comprobante en UPPA. Estamos validando la habilitación de tu ${hab.vehicleType}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] px-3.5 rounded-xl bg-[#101114] border border-[#B7F36B]/45 text-[#B7F36B] hover:bg-[#B7F36B]/15 flex items-center justify-center"
                            title={`Contactar a ${hab.driverName} por WhatsApp`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generador de Códigos Únicos en Firestore */}
          <div className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-3 shadow-[4px_4px_0px_#000000]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#101114] border border-[#FFF19A]/45 flex items-center justify-center text-[#FFF19A]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                    <span>Generador de Códigos Únicos Firestore</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#101114] text-[#FFF19A] border border-white/15">
                      codigos_habilitacion
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#9299A5]">
                    Crea códigos aleatorios de 6 caracteres con ID único que nunca se repiten.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerarCodigo('moto')}
                  disabled={isGeneratingCode}
                  title="Generar código único para Moto Taxi"
                  className="px-3.5 min-h-[40px] rounded-xl bg-[#101114] hover:bg-white/10 text-[#B7F36B] border-2 border-[#B7F36B]/45 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>{isGeneratingCode ? 'Generando...' : '+ Código Moto'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerarCodigo('auto')}
                  disabled={isGeneratingCode}
                  title="Generar código único para Auto Taxi"
                  className="px-3.5 min-h-[40px] rounded-xl bg-[#101114] hover:bg-white/10 text-[#FFF19A] border-2 border-[#FFF19A]/45 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>{isGeneratingCode ? 'Generando...' : '+ Código Auto'}</span>
                </button>
              </div>
            </div>

            {lastGeneratedCode && (
              <div className="p-3 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/45 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FFF19A] animate-pulse" />
                  <span className="text-xs text-[#9299A5]">Último código generado:</span>
                  <span className="font-mono font-black text-sm text-[#FFF19A] tracking-wider">
                    {lastGeneratedCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(lastGeneratedCode, 'lastCode')}
                  title="Copiar último código generado"
                  className="px-3 py-1.5 rounded-lg bg-[#202329] border border-white/15 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'lastCode' ? <Check className="w-3.5 h-3.5 text-[#B7F36B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'lastCode' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {firestoreCodigos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-[#9299A5] flex items-center justify-between">
                  <span>Códigos registrados en Firestore ({firestoreCodigos.length})</span>
                  <span>Libres: {firestoreCodigos.filter((c) => !c.usado).length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                  {firestoreCodigos.map((cod) => (
                    <div
                      key={cod.id}
                      className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                        cod.usado
                          ? 'bg-[#101114]/60 border-white/10 text-[#9299A5]'
                          : 'bg-[#101114] border-[#FFF19A]/40 text-[#FFF19A]'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold tracking-wide">{cod.id}</div>
                        <div className="text-[9px] text-[#9299A5]">
                          {cod.tipoVehiculo === 'moto' ? '🏍️ Moto' : '🚕 Auto'} · {cod.usado ? 'Usado' : 'Libre'}
                        </div>
                      </div>
                      {!cod.usado && (
                        <button
                          type="button"
                          onClick={() => handleCopy(cod.id, cod.id)}
                          className="p-1.5 rounded text-[#FFF19A] hover:text-white cursor-pointer"
                          title={`Copiar código ${cod.id}`}
                        >
                          {copiedKey === cod.id ? <Check className="w-3.5 h-3.5 text-[#B7F36B]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Drivers */}
          <div className="space-y-3 pt-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B7F36B]" />
              Choferes Habilitados con Temporizador Activo ({activeHabilitaciones.length})
            </h3>

            {activeHabilitaciones.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-[#202329] border-2 border-white/10 text-[#9299A5] text-xs">
                No hay choferes activos con temporizador en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeHabilitaciones.map((hab) => {
                  const timer = hab.endsAt ? getTimerState(hab.endsAt) : { formatted: '00:00:00', isExpired: false };
                  const isConfirmingRevoke = confirmRevokeHabId === hab.id;

                  return (
                    <div
                      key={hab.id}
                      className="p-4 rounded-2xl bg-[#202329] border-2 border-[#B7F36B]/45 shadow-[4px_4px_0px_#000000] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#101114] border border-[#B7F36B]/45 flex items-center justify-center text-[#B7F36B]">
                            {hab.vehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white">{hab.driverName}</h4>
                            <span className="text-[11px] text-[#9299A5]">
                              {hab.vehicleModel} · {hab.vehicleType.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-[#B7F36B]/15 border border-[#B7F36B]/45 text-[10px] font-black text-[#B7F36B]">
                            Estado: Habilitado
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#101114] border border-[#B7F36B]/45 text-[#B7F36B] font-mono text-xs font-black">
                            <Clock className="w-3.5 h-3.5 text-[#B7F36B] animate-spin" style={{ animationDuration: '6s' }} />
                            <span>{timer.formatted}</span>
                          </span>
                          <span className="text-[9px] text-[#9299A5] block mt-0.5">
                            {hab.horas}h pagadas
                          </span>
                        </div>
                      </div>

                      <div className="text-xs bg-[#101114] p-2.5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">Código Asignado:</span>
                          <span className="font-mono font-bold text-[#FFF19A]">{hab.activationCode || 'UPPA-TX-0608'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">Habilitado con:</span>
                          <span className="text-[#B7F36B] font-semibold">{hab.habilitadoPor || 'Clave 0608'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#9299A5]">Zona:</span>
                          <span className="text-white">{hab.zone}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#9299A5]">Confort / Capacidad:</span>
                          <span className="text-[#B7F36B] font-medium text-right">
                            {hab.vehicleType === 'moto'
                              ? `${hab.cascoExtra !== false ? '🪖 Casco extra' : 'Sin casco'}${hab.baul !== false ? ' · 📦 Baúl' : ''}`
                              : `${hab.asientos || 4} asientos${hab.aireAcondicionado !== false ? ' · ❄️ Aire' : ''}${hab.baul !== false ? ' · 🧳 Baúl' : ''}${hab.aceptaMascotas ? ' · 🐾 Mascotas' : ''}`}
                          </span>
                        </div>
                      </div>

                      {isConfirmingRevoke ? (
                        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-400/50 flex items-center justify-between gap-2 text-xs">
                          <span className="text-rose-200 font-bold">¿Revocar a {hab.driverName}?</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeHabId(null)}
                              title="Cancelar revocación"
                              className="px-2.5 py-1.5 rounded-lg bg-[#101114] text-white font-bold cursor-pointer"
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await revocarHabilitacionChofer(hab.id);
                                setConfirmRevokeHabId(null);
                                showSuccessBanner(`Habilitación revocada para ${hab.driverName}`);
                              }}
                              title={`Confirmar revocación de ${hab.driverName}`}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500 text-[#101114] font-black cursor-pointer"
                            >
                              Sí, Revocar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeHabId(hab.id)}
                            title={`Revocar o finalizar turno de ${hab.driverName}`}
                            className="flex-1 min-h-[40px] rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Revocar / Finalizar</span>
                          </button>
                          <a
                            href={`https://wa.me/${hab.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Contactar a ${hab.driverName} por WhatsApp`}
                            className="min-h-[40px] px-3.5 rounded-xl bg-[#101114] border border-[#B7F36B]/45 text-[#B7F36B] hover:bg-[#B7F36B]/15 text-xs font-bold flex items-center gap-1"
                          >
                            <span>WhatsApp</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USUARIOS FIRESTORE */}
      {activeTab === 'usuarios' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FFF19A]" />
              <span>Gestión de Usuarios Firestore (usuarios/&#123;uid&#125;)</span>
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o rol..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="min-h-[40px] pl-8 pr-3 rounded-xl bg-[#202329] border-2 border-white/15 text-xs text-white focus:outline-none focus:border-[#FFF19A] w-full sm:w-64"
              />
            </div>
          </div>

          <div className="bg-[#202329] border-2 border-white/15 rounded-2xl overflow-hidden shadow-[4px_4px_0px_#000000]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101114] text-[#9299A5] text-[11px] uppercase border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Rol</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-white/90">
                  {usuarios
                    .filter((u) => {
                      if (!searchFilter) return true;
                      const q = searchFilter.toLowerCase();
                      return (
                        u.nombre.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q) ||
                        u.rol.toLowerCase().includes(q)
                      );
                    })
                    .map((user) => (
                      <tr key={user.uid} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A] font-black flex items-center justify-center text-xs">
                            {user.nombre.charAt(0)}
                          </div>
                          <div>
                            <span>{user.nombre}</span>
                            <span className="block text-[10px] text-[#9299A5] font-mono">
                              UID: {user.uid.substring(0, 8)}...
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#9299A5]">{user.email}</td>
                        <td className="py-3 px-3">
                          <select
                            value={user.rol}
                            onChange={async (e) => {
                              await actualizarRolUsuario(user.uid, e.target.value as any);
                              showSuccessBanner(`Rol actualizado a ${e.target.value} para ${user.nombre}`);
                            }}
                            aria-label={`Cambiar rol de ${user.nombre}`}
                            className="h-8 px-2 rounded-lg bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A] text-[11px] font-bold"
                          >
                            <option value="pasajero">Pasajero</option>
                            <option value="chofer_moto">Chofer Moto</option>
                            <option value="chofer_auto">Chofer Auto</option>
                            <option value="chofer_micro">Chofer Micro</option>
                            <option value="administrador">Administrador</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await actualizarEstadoUsuario(user.uid, !user.activo);
                              showSuccessBanner(`Usuario ${user.activo ? 'bloqueado' : 'habilitado'}`);
                            }}
                            title={user.activo ? `Bloquear acceso a ${user.nombre}` : `Habilitar acceso a ${user.nombre}`}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black border cursor-pointer ${
                              user.activo
                                ? 'bg-[#B7F36B]/15 border-[#B7F36B]/45 text-[#B7F36B]'
                                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                            }`}
                          >
                            {user.activo ? 'Activo' : 'Bloqueado'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {confirmDeleteUid === user.uid ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUid(null)}
                                title="Cancelar eliminación"
                                className="px-2 py-1 rounded bg-[#101114] border border-white/15 text-white text-[10px] font-bold cursor-pointer"
                              >
                                No
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await eliminarUsuarioFirestore(user.uid);
                                  setConfirmDeleteUid(null);
                                  showSuccessBanner('Usuario eliminado de Firestore');
                                }}
                                title={`Confirmar eliminación de ${user.nombre}`}
                                className="px-2 py-1 rounded bg-rose-500 text-[#101114] text-[10px] font-black cursor-pointer"
                              >
                                Sí
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(user.uid)}
                              className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                              title={`Eliminar usuario ${user.nombre}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2.5: BASE DE DATOS */}
      {activeTab === 'database' && (
        <div className="bg-[#202329] border-2 border-white/15 rounded-2xl p-4 shadow-[4px_4px_0px_#000000]">
          <UppaDatabaseViewer isEmbedded={true} currentUserRole="admin" />
        </div>
      )}

      {/* TAB 3: REPORTES EN TIEMPO REAL */}
      {activeTab === 'reportes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FFF19A]" />
              <span>Reportes de Incidentes (reportes/&#123;reporteId&#125;)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportes.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-[#9299A5] bg-[#202329] border-2 border-white/10 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-[#FFF19A]/40 mx-auto mb-2" />
                <p className="font-bold text-white">No hay incidentes activos en este momento</p>
                <p className="text-[11px] text-[#9299A5] mt-0.5">
                  Todos los eventos mostrados en el sistema son aportados exclusivamente por los usuarios en vivo.
                </p>
              </div>
            ) : (
              reportes.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-2.5 shadow-[4px_4px_0px_#000000]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {rep.tipo === 'accidente'
                          ? '💥'
                          : rep.tipo === 'demora'
                          ? '⏳'
                          : rep.tipo === 'corte'
                          ? '⛔'
                          : rep.tipo === 'control'
                          ? '👮'
                          : rep.tipo === 'congestion'
                          ? '🚗'
                          : '⚠️'}
                      </span>
                      <div>
                        <span className="text-xs font-black text-white uppercase">{rep.tipo}</span>
                        <span className="text-[10px] text-[#9299A5] block">Por {rep.nombreUsuario}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                        rep.estado === 'activo'
                          ? 'bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/45'
                          : 'bg-[#101114] text-[#9299A5] border border-white/10'
                      }`}
                    >
                      {rep.estado.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-white/90 leading-relaxed bg-[#101114] p-2.5 rounded-xl border border-white/10">
                    {rep.descripcion}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#9299A5]">
                    <span className="flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-[#FFF19A]" />
                      {rep.ubicacion.lat.toFixed(4)}, {rep.ubicacion.lng.toFixed(4)}
                    </span>
                    <span>Confirmaciones: {rep.confirmaciones || 1}</span>
                  </div>

                  {confirmDeleteReportId === rep.id ? (
                    <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-400/50 flex items-center justify-between text-xs">
                      <span className="text-rose-200 font-bold">¿Eliminar reporte?</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteReportId(null)}
                          title="Cancelar eliminación de reporte"
                          className="px-2.5 py-1 rounded bg-[#101114] text-white font-bold cursor-pointer"
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await eliminarReporte(rep.id);
                            setConfirmDeleteReportId(null);
                            showSuccessBanner('Reporte eliminado de Firestore');
                          }}
                          title="Confirmar eliminación permanente del reporte"
                          className="px-2.5 py-1 rounded bg-rose-500 text-[#101114] font-black cursor-pointer"
                        >
                          Sí, Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const next = rep.estado === 'activo' ? 'oculto' : 'activo';
                          await actualizarEstadoReporte(rep.id, next as any);
                          showSuccessBanner(`Estado de reporte actualizado a ${next}`);
                        }}
                        title={rep.estado === 'activo' ? 'Ocultar reporte del mapa' : 'Volver a activar reporte en mapa'}
                        className="flex-1 min-h-[38px] rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-xs font-bold text-white cursor-pointer"
                      >
                        {rep.estado === 'activo' ? 'Ocultar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteReportId(rep.id)}
                        title="Eliminar reporte permanentemente"
                        className="min-h-[38px] px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 text-xs font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MODERACIÓN DE CHAT */}
      {activeTab === 'chat' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#FFF19A]" />
              <span>Moderación de Chat en Tiempo Real</span>
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['campana-zarate', 'zarate-campana', 'general'] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setActiveChatChannel(channel)}
                  title={`Ver mensajes de sala ${channel}`}
                  className={`px-3 min-h-[36px] rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    activeChatChannel === channel
                      ? 'bg-[#FFF19A] text-[#101114] border-white/25'
                      : 'bg-[#202329] text-[#9299A5] hover:text-white border-white/10'
                  }`}
                >
                  {channel === 'campana-zarate'
                    ? 'Campana ↔ Zárate'
                    : channel === 'zarate-campana'
                    ? 'Zárate ↔ Campana'
                    : 'General'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 bg-[#202329] p-3 rounded-2xl border-2 border-white/15 max-h-[500px] overflow-y-auto">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-[#9299A5] py-6">No hay mensajes recientes en esta sala.</p>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                    msg.reportado
                      ? 'bg-rose-950/30 border-rose-400/50 text-rose-200'
                      : 'bg-[#101114] border-white/10 text-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{msg.nombreUsuario}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#202329] border border-white/15 text-[#FFF19A] text-[10px] font-mono">
                        {msg.rol || 'pasajero'}
                      </span>
                      {msg.reportado && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-[#101114] text-[9px] font-black">
                          REPORTADO
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-white/90">{msg.texto}</p>
                  </div>

                  {confirmDeleteChatId === msg.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChatId(null)}
                        title="Cancelar eliminación"
                        className="px-2 py-1 rounded bg-[#202329] border border-white/15 text-white text-[10px] font-bold cursor-pointer"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await eliminarMensajeChat(activeChatChannel, msg.id);
                          setConfirmDeleteChatId(null);
                          showSuccessBanner('Mensaje eliminado');
                        }}
                        title="Confirmar eliminación del mensaje"
                        className="px-2 py-1 rounded bg-rose-500 text-[#101114] text-[10px] font-black cursor-pointer"
                      >
                        Sí
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteChatId(msg.id)}
                      className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 shrink-0 cursor-pointer"
                      title={`Eliminar mensaje de ${msg.nombreUsuario}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: VIAJES Y TRANSPORTE ALTERNATIVO */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-[#FFF19A]" />
            <span>Solicitudes de Transporte Alternativo (solicitudes_transporte)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {solicitudes.map((sol) => (
              <div
                key={sol.id}
                className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-2.5 shadow-[4px_4px_0px_#000000]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A] flex items-center justify-center font-bold">
                      {sol.tipoVehiculoRequerido === 'moto' ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{sol.nombrePasajero}</h4>
                      <span className="text-[10px] text-[#9299A5]">
                        Tipo: {sol.tipoVehiculoRequerido.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                      sol.estado === 'pendiente'
                        ? 'bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45'
                        : sol.estado === 'aceptado'
                        ? 'bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/45'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    {sol.estado.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs space-y-1 bg-[#101114] p-2.5 rounded-xl border border-white/10">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#9299A5]">Origen:</span>
                    <span className="text-white font-medium truncate max-w-[200px]">{sol.origen}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#9299A5]">Destino:</span>
                    <span className="text-white font-medium truncate max-w-[200px]">{sol.destino}</span>
                  </div>
                  {sol.choferNombre && (
                    <div className="flex justify-between text-[#B7F36B]">
                      <span>Chofer Asignado:</span>
                      <span className="font-bold">{sol.choferNombre}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await actualizarEstadoSolicitud(sol.id, 'completado');
                      showSuccessBanner('Viaje marcado como completado');
                    }}
                    title="Marcar viaje como completado"
                    className="flex-1 min-h-[38px] rounded-xl uppa-cta-green text-xs font-black cursor-pointer"
                  >
                    Completar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await actualizarEstadoSolicitud(sol.id, 'cancelado');
                      showSuccessBanner('Viaje cancelado');
                    }}
                    title="Cancelar solicitud de viaje"
                    className="min-h-[38px] px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: MÉTRICAS Y ANALÍTICAS */}
      {activeTab === 'metricas' && metricas && (
        <div className="space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FFF19A]" />
            <span>Dashboard y Estadísticas en Tiempo Real</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15">
              <span className="text-[10px] text-[#9299A5] uppercase block">Usuarios Conectados</span>
              <span className="text-2xl font-black text-[#FFF19A]">{metricas.usuariosConectados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15">
              <span className="text-[10px] text-[#9299A5] uppercase block">Reportes Activos</span>
              <span className="text-2xl font-black text-white">{metricas.reportesActivos}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15">
              <span className="text-[10px] text-[#9299A5] uppercase block">Viajes Solicitados</span>
              <span className="text-2xl font-black text-[#FFF19A]">{metricas.viajesSolicitados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15">
              <span className="text-[10px] text-[#9299A5] uppercase block">Viajes Completados</span>
              <span className="text-2xl font-black text-[#B7F36B]">{metricas.viajesCompletados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15">
              <span className="text-[10px] text-[#9299A5] uppercase block">Tiempo Promedio</span>
              <span className="text-2xl font-black text-white">{metricas.tiempoPromedioAceptacionMinutos} min</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Reportes por Zona</h4>
              <div className="space-y-2">
                {metricas.reportesPorZona.map((z) => (
                  <div key={z.zona} className="flex items-center justify-between text-xs">
                    <span className="text-[#9299A5]">{z.zona}</span>
                    <span className="px-2 py-0.5 rounded bg-[#101114] border border-[#FFF19A]/40 text-[#FFF19A] font-bold">
                      {z.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Demoras por Franja Horaria</h4>
              <div className="space-y-2">
                {metricas.demorasPorHorario.map((d) => (
                  <div key={d.franja} className="flex items-center justify-between text-xs">
                    <span className="text-[#9299A5]">{d.franja}</span>
                    <span className="px-2 py-0.5 rounded bg-[#101114] border border-[#B7F36B]/40 text-[#B7F36B] font-bold">
                      {d.cantidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GRÁFICOS RECHARTS */}
      {activeTab === 'graficos' && (
        <AdminRealtimeCharts
          reportes={reportes}
          habilitaciones={habilitaciones}
          usuarios={usuarios}
          events={events}
          taxis={taxis}
          solicitudes={solicitudes}
        />
      )}

      {/* TAB 7: TRANSMITIR ALERTA GENERAL */}
      {activeTab === 'alerta' && (
        <div className="max-w-xl mx-auto w-full bg-[#202329] border-2 border-[#FFF19A]/45 rounded-2xl p-5 shadow-[4px_4px_0px_#000000] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border border-[#FFF19A]/45 text-[#FFF19A] flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Transmitir Alerta a la Comunidad</h3>
              <p className="text-xs text-[#9299A5]">Emite una notificación push instantánea a todos los usuarios</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white font-bold block mb-1">Título de la Alerta</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Ej: Desvío preventivo en Colectora Panamericana"
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#101114] border-2 border-white/15 text-white text-xs font-semibold focus:outline-none focus:border-[#FFF19A]"
              />
            </div>
            <div>
              <label className="text-xs text-white font-bold block mb-1">Mensaje / Detalle</label>
              <textarea
                value={broadcastDesc}
                onChange={(e) => setBroadcastDesc(e.target.value)}
                placeholder="Explicación del corte, desvío o aviso de emergencia..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[#101114] border-2 border-white/15 text-white text-xs focus:outline-none focus:border-[#FFF19A]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!broadcastTitle.trim()) return;
                onBroadcastAlert(broadcastTitle, broadcastDesc);
                triggerInAppPushNotification(broadcastTitle, broadcastDesc, 'admin');
                setBroadcastTitle('');
                setBroadcastDesc('');
                showSuccessBanner('Alerta transmitida instantáneamente por FCM y Web Push');
              }}
              title="Enviar notificación oficial a todos los usuarios conectados"
              className="w-full min-h-[48px] rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Emitir Alerta a Todos los Pasajeros y Choferes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
