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
  Check,
  Copy,
  Plus,
  Send,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  MapPin,
  ExternalLink,
  Database,
  Activity,
  TrendingUp,
  LineChart,
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
  ads,
  taxis,
  onDeleteEvent,
  onVerifyEvent,
  onBroadcastAlert,
  currentUser,
}) => {
  // Check if current user is an authenticated administrator
  const isUserAdmin = currentUser?.role === 'admin' || currentUser?.rol === 'administrador';

  // Authentication & PIN State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('UPPA_ADMIN_UNLOCKED') === 'true';
    } catch {
      return false;
    }
  });

  const effectiveUnlocked = isAdminUnlocked || isUserAdmin;
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

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

  // Driver Enablement with PIN "0608" State
  const [selectedHabIdForActivation, setSelectedHabIdForActivation] = useState<string | null>(null);
  const [adminActivationPin, setAdminActivationPin] = useState('0608');
  const [activationHours, setActivationHours] = useState<number>(12);
  const [isEnablingDriver, setIsEnablingDriver] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sistema de Códigos Únicos Firestore (codigos_habilitacion)
  const [firestoreCodigos, setFirestoreCodigos] = useState<any[]>([]);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);

  const showErrorBanner = (msg: string) => {
    setActionErrorMessage(msg);
    setTimeout(() => setActionErrorMessage(null), 4500);
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

  // Broadcast Alert State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDesc, setBroadcastDesc] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  // Live Timer ticker for active drivers
  const [, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showSuccessBanner = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Subscribe to real-time collections when unlocked
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

  // Subscribe to chat channel
  useEffect(() => {
    if (!isAdminUnlocked) return;
    const unsubChat = subscribeToChat(activeChatChannel, (msgs) => setChatMessages(msgs));
    return () => unsubChat();
  }, [isAdminUnlocked, activeChatChannel]);

  // Handle PIN Unlock
  const handleUnlockWithPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === ADMIN_MASTER_PIN) {
      setIsAdminUnlocked(true);
      setPinError(null);
      try {
        localStorage.setItem('UPPA_ADMIN_UNLOCKED', 'true');
      } catch {}
      showSuccessBanner('Acceso administrativo concedido con clave 0608');
    } else {
      setPinError('Clave incorrecta. La clave de administración autorizada es 0608.');
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      localStorage.removeItem('UPPA_ADMIN_UNLOCKED');
    } catch {}
    setPinInput('');
  };

  // Handle Enable Driver with PIN "0608"
  const handleHabilitarChofer = async (habId: string) => {
    if (adminActivationPin.trim() !== ADMIN_MASTER_PIN) {
      showErrorBanner('Clave de administrador incorrecta. Debe ingresar 0608.');
      return;
    }

    setIsEnablingDriver(true);
    try {
      const res = await habilitarChoferConClaveAdmin(habId, adminActivationPin.trim(), activationHours);
      showSuccessBanner(res.message);
      setSelectedHabIdForActivation(null);
    } catch (err: any) {
      showErrorBanner(err.message || 'Error al habilitar chofer');
    } finally {
      setIsEnablingDriver(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // PIN Unlock Screen if locked (or auto-unlocked if current user is admin)
  if (!effectiveUnlocked) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#07090e] p-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-[#0f1422] border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white font-display tracking-tight flex items-center gap-2">
                Panel de Administración
              </h1>
              <p className="text-xs text-purple-300 font-medium">UPPA Comunidad de Transporte</p>
            </div>
          </div>

          <form onSubmit={handleUnlockWithPin} className="space-y-5">
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/25 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-center gap-2 text-purple-300 font-bold mb-1">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>Control de Seguridad & Habilitación</span>
              </div>
              El administrador ingresa con clave autorizada <strong className="text-white bg-purple-900/80 px-1.5 py-0.5 rounded border border-purple-400/50">0608</strong> para verificar pagos y habilitar el temporizador de choferes.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Ingresá la Clave de Administrador
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  placeholder="Clave (ej: 0608)"
                  className="w-full h-12 px-4 rounded-xl bg-slate-900/90 border border-purple-400/40 text-white font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              {pinError && <p className="text-xs text-rose-400 font-semibold mt-2">{pinError}</p>}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-98"
              >
                <Unlock className="w-4 h-4" />
                <span>Ingresar con Clave 0608</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinInput('0608');
                }}
                className="h-12 px-3 rounded-xl bg-purple-950/60 border border-purple-400/30 text-purple-300 hover:text-white text-xs font-mono font-bold transition-all"
                title="Autocompletar clave 0608"
              >
                0608
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Active Admin Screen
  const pendingHabilitaciones = habilitaciones.filter((h) => h.estado === 'pendiente');
  const activeHabilitaciones = habilitaciones.filter((h) => h.estado === 'activo');

  return (
    <div className="flex-1 overflow-y-auto bg-[#07090e] p-3 sm:p-5 flex flex-col gap-4 text-slate-100">
      {/* Top Banner with Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[#0d121f] border border-purple-500/25 p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white font-display">Administración UPPA</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tiempo Real Activo
              </span>
            </div>
            <p className="text-xs text-purple-300/80">
              Clave de Gestión: <strong className="text-white">0608</strong> • Conectado a Firestore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              const m = await obtenerMetricasEnTiempoReal();
              setMetricas(m);
              setIsRefreshing(false);
              showSuccessBanner('Métricas y datos sincronizados con Firestore');
            }}
            className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          <button
            onClick={handleLockAdmin}
            className="h-8 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {/* Success notification banner */}
      {actionSuccessMessage && (
        <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Error notification banner */}
      {actionErrorMessage && (
        <div className="bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
        <button
          onClick={() => setActiveTab('choferes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'choferes'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Habilitación Chofer (Clave 0608)</span>
          {pendingHabilitaciones.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center">
              {pendingHabilitaciones.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'usuarios'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Usuarios ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'database'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Base de Datos de Usuarios</span>
        </button>

        <button
          onClick={() => setActiveTab('reportes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'reportes'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Reportes ({reportes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Moderación Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('solicitudes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'solicitudes'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Viajes Alternativos ({solicitudes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('metricas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'metricas'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Métricas en Vivo</span>
        </button>

        <button
          onClick={() => setActiveTab('graficos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'graficos'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Gráficos Recharts</span>
        </button>

        <button
          onClick={() => setActiveTab('alerta')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'alerta'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Transmitir Alerta</span>
        </button>
      </div>

      {/* TAB 1: HABILITACIÓN DE CHOFERES CON CLAVE "0608" Y TEMPORIZADOR */}
      {activeTab === 'choferes' && (
        <div className="space-y-4">
          {/* Official Bank Account Information Card */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-[#0d1420] to-[#0c101a] border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Cuenta Oficial Habilitada de Transferencias
                </span>
                <h3 className="text-base font-extrabold text-white mt-1">
                  Habilitación de Chofer (Moto / Auto Taxi)
                </h3>
              </div>
              <a
                href="https://wa.me/5493489690058"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
              >
                <span>WhatsApp de Verificación: 3489690058</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-black/40 p-3 rounded-xl border border-white/5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">Alias de Transferencia:</span>
                  <span className="font-mono font-bold text-emerald-300">luciaveronicag</span>
                </div>
                <button
                  onClick={() => handleCopy('luciaveronicag', 'alias')}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Copiar alias"
                >
                  {copiedKey === 'alias' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">CVU:</span>
                  <span className="font-mono font-bold text-slate-200">0000003100020253501840</span>
                </div>
                <button
                  onClick={() => handleCopy('0000003100020253501840', 'cvu')}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Copiar CVU"
                >
                  {copiedKey === 'cvu' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">Titular:</span>
                  <span className="font-bold text-slate-200">Lucia Veronica Gimenez</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  Verificado
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5">
              💡 <strong>Regla del sistema:</strong> El código no lo pone el conductor. Cuando el chofer envía el comprobante de transferencia al WhatsApp <strong>3489690058</strong>, el administrador ingresa con clave <strong>0608</strong> y le habilita el tiempo pagado. En ese preciso momento comienza el temporizador en vivo solo para ese chofer.
            </p>
          </div>

          {/* Pending Driver Requests */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              Solicitudes Pendientes de Choferes ({pendingHabilitaciones.length})
            </h3>

            {pendingHabilitaciones.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                No hay solicitudes de choferes pendientes de habilitación en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingHabilitaciones.map((hab) => (
                  <div
                    key={hab.id}
                    className="p-4 rounded-2xl bg-[#0f1422] border border-amber-500/30 shadow-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                          {hab.vehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{hab.driverName}</h4>
                          <span className="text-[11px] text-slate-400 block">
                            {hab.vehicleModel} • {hab.vehicleType.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[10px] font-bold text-amber-300">
                        Pendiente Clave 0608
                      </span>
                    </div>

                    <div className="text-xs space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">WhatsApp:</span>
                        <a
                          href={`https://wa.me/${hab.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 font-bold hover:underline"
                        >
                          +{hab.whatsapp}
                        </a>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">Zona:</span>
                        <span>{hab.zone}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">Tiempo Solicitado:</span>
                        <span className="font-bold text-amber-300">{hab.horas} horas</span>
                      </div>
                      {hab.comprobanteFileName && (
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Comprobante:</span>
                          <span className="font-mono text-[11px] text-sky-300 truncate max-w-[180px]">
                            {hab.comprobanteFileName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Enablement action form with PIN 0608 */}
                    {selectedHabIdForActivation === hab.id ? (
                      <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Habilitar con Clave de Administrador</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Clave Admin</label>
                            <input
                              type="text"
                              value={adminActivationPin}
                              onChange={(e) => setAdminActivationPin(e.target.value)}
                              placeholder="0608"
                              className="w-full h-8 px-2.5 rounded-lg bg-black/70 border border-purple-400/50 text-white font-mono text-center text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Horas Pagadas</label>
                            <select
                              value={activationHours}
                              onChange={(e) => setActivationHours(Number(e.target.value))}
                              className="w-full h-8 px-2 rounded-lg bg-black/70 border border-purple-400/50 text-white text-xs font-bold"
                            >
                              <option value={6}>6 horas</option>
                              <option value={12}>12 horas</option>
                              <option value={24}>24 horas (1 día)</option>
                              <option value={48}>48 horas (2 días)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleHabilitarChofer(hab.id)}
                            disabled={isEnablingDriver}
                            className="flex-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isEnablingDriver ? 'Iniciando...' : 'Habilitar y Comenzar Temporizador'}</span>
                          </button>
                          <button
                            onClick={() => setSelectedHabIdForActivation(null)}
                            className="h-9 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedHabIdForActivation(hab.id);
                            setActivationHours(hab.horas || 12);
                            setAdminActivationPin('0608');
                          }}
                          className="flex-1 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Habilitar con Clave 0608</span>
                        </button>
                        <a
                          href={`https://wa.me/${hab.whatsapp}?text=${encodeURIComponent(
                            `Hola ${hab.driverName}! Recibimos tu comprobante en UPPA. Estamos validando la habilitación de tu ${hab.vehicleType}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:text-white flex items-center justify-center"
                          title="Contactar chofer por WhatsApp"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generador de Códigos Únicos en Firestore (codigos_habilitacion) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0e1322] to-[#12192e] border border-cyan-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Generador de Códigos Únicos Firestore</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                      codigos_habilitacion
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Crea códigos aleatorios de 6 caracteres con ID único que nunca se repiten.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerarCodigo('moto')}
                  disabled={isGeneratingCode}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>{isGeneratingCode ? 'Generando...' : '+ Código Moto'}</span>
                </button>
                <button
                  onClick={() => handleGenerarCodigo('auto')}
                  disabled={isGeneratingCode}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>{isGeneratingCode ? 'Generando...' : '+ Código Auto'}</span>
                </button>
              </div>
            </div>

            {/* Last generated code spotlight */}
            {lastGeneratedCode && (
              <div className="p-3 rounded-xl bg-black/60 border border-cyan-400/40 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs text-slate-300">Último código generado:</span>
                  <span className="font-mono font-black text-sm text-cyan-300 tracking-wider">
                    {lastGeneratedCode}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(lastGeneratedCode, 'lastCode')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-200 text-xs font-bold flex items-center gap-1"
                >
                  {copiedKey === 'lastCode' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'lastCode' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {/* List of codes in codigos_habilitacion */}
            {firestoreCodigos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>Códigos registrados en Firestore ({firestoreCodigos.length})</span>
                  <span className="text-[10px] text-slate-500">Libres: {firestoreCodigos.filter((c) => !c.usado).length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                  {firestoreCodigos.map((cod) => (
                    <div
                      key={cod.id}
                      className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                        cod.usado
                          ? 'bg-slate-900/60 border-slate-700/50 text-slate-500'
                          : 'bg-black/50 border-cyan-500/40 text-cyan-200'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold tracking-wide">{cod.id}</div>
                        <div className="text-[9px] text-slate-400">
                          {cod.tipoVehiculo === 'moto' ? '🏍️ Moto' : '🚕 Auto'} · {cod.usado ? 'Usado' : 'Libre'}
                        </div>
                      </div>
                      {!cod.usado && (
                        <button
                          onClick={() => handleCopy(cod.id, cod.id)}
                          className="p-1 rounded text-cyan-300 hover:text-white"
                          title="Copiar código"
                        >
                          {copiedKey === cod.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Currently Active Drivers with Running Countdown Timer */}
          <div className="space-y-3 pt-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Choferes Habilitados con Temporizador Activo ({activeHabilitaciones.length})
            </h3>

            {activeHabilitaciones.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-900/40 border border-white/5 text-slate-400 text-xs">
                No hay choferes activos con temporizador en este momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeHabilitaciones.map((hab) => {
                  const timer = hab.endsAt ? getTimerState(hab.endsAt) : { formatted: '00:00:00', isExpired: false };
                  return (
                    <div
                      key={hab.id}
                      className="p-4 rounded-2xl bg-[#0f1422] border border-emerald-500/30 shadow-lg space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                            {hab.vehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">{hab.driverName}</h4>
                            <span className="text-[11px] text-slate-400">
                              {hab.vehicleModel} • {hab.vehicleType.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Live Timer Countdown Badge */}
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-emerald-400/50 text-emerald-300 font-mono text-xs font-black shadow-inner">
                            <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
                            <span>{timer.formatted}</span>
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            {hab.horas}h pagadas
                          </span>
                        </div>
                      </div>

                      <div className="text-xs bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Código Asignado:</span>
                          <span className="font-mono font-bold text-purple-300">{hab.activationCode || 'UPPA-TX-0608'}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Habilitado con:</span>
                          <span className="text-emerald-300 font-semibold">{hab.habilitadoPor || 'Clave 0608'}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">Zona:</span>
                          <span>{hab.zone}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (confirm(`¿Revocar o pausar servicio a ${hab.driverName}?`)) {
                              await revocarHabilitacionChofer(hab.id);
                              showSuccessBanner(`Habilitación revocada para ${hab.driverName}`);
                            }
                          }}
                          className="flex-1 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Revocar / Finalizar</span>
                        </button>
                        <a
                          href={`https://wa.me/${hab.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1"
                        >
                          <span>WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
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
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Gestión de Usuarios Firestore (usuarios/&#123;uid&#125;)</span>
            </h3>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o rol..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400 w-full sm:w-64"
              />
            </div>
          </div>

          <div className="bg-[#0f1422] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Rol</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
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
                      <tr key={user.uid} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs">
                            {user.nombre.charAt(0)}
                          </div>
                          <div>
                            <span>{user.nombre}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">UID: {user.uid.substring(0, 8)}...</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{user.email}</td>
                        <td className="py-3 px-3">
                          <select
                            value={user.rol}
                            onChange={async (e) => {
                              await actualizarRolUsuario(user.uid, e.target.value as any);
                              showSuccessBanner(`Rol actualizado a ${e.target.value} para ${user.nombre}`);
                            }}
                            className="h-7 px-2 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 text-[11px] font-bold"
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
                            onClick={async () => {
                              await actualizarEstadoUsuario(user.uid, !user.activo);
                              showSuccessBanner(`Usuario ${user.activo ? 'bloqueado' : 'habilitado'}`);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              user.activo
                                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                            }`}
                          >
                            {user.activo ? 'Activo' : 'Bloqueado'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar usuario ${user.nombre}?`)) {
                                await eliminarUsuarioFirestore(user.uid);
                                showSuccessBanner(`Usuario eliminado de Firestore`);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2.5: BASE DE DATOS DE USUARIOS (CREDENCIALES Y REGISTROS) */}
      {activeTab === 'database' && (
        <div className="bg-[#0b0e17] border border-white/5 rounded-2xl p-4 shadow-xl">
          <UppaDatabaseViewer isEmbedded={true} currentUserRole="admin" />
        </div>
      )}

      {/* TAB 3: REPORTES EN TIEMPO REAL */}
      {activeTab === 'reportes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Reportes de Incidentes (reportes/&#123;reporteId&#125;)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportes.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-2xl bg-[#0f1422] border border-white/5 space-y-2.5 shadow-md"
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
                      <span className="text-xs font-bold text-white uppercase">{rep.tipo}</span>
                      <span className="text-[10px] text-slate-400 block">Por {rep.nombreUsuario}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      rep.estado === 'activo'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {rep.estado.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
                  {rep.descripcion}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="w-3 h-3 text-sky-400" />
                    {rep.ubicacion.lat.toFixed(4)}, {rep.ubicacion.lng.toFixed(4)}
                  </span>
                  <span>Confirmaciones: {rep.confirmaciones || 1}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      const next = rep.estado === 'activo' ? 'oculto' : 'activo';
                      await actualizarEstadoReporte(rep.id, next as any);
                      showSuccessBanner(`Estado de reporte actualizado a ${next}`);
                    }}
                    className="flex-1 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                  >
                    {rep.estado === 'activo' ? 'Ocultar' : 'Activar'}
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('¿Eliminar reporte permanentemente?')) {
                        await eliminarReporte(rep.id);
                        showSuccessBanner('Reporte eliminado de Firestore');
                      }
                    }}
                    className="h-7 px-3 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MODERACIÓN DE CHAT */}
      {activeTab === 'chat' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>Moderación de Chat en Tiempo Real</span>
            </h3>
            <div className="flex items-center gap-1.5">
              {(['campana-zarate', 'zarate-campana', 'general'] as const).map((channel) => (
                <button
                  key={channel}
                  onClick={() => setActiveChatChannel(channel)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    activeChatChannel === channel
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
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

          <div className="space-y-2 bg-[#0f1422] p-3 rounded-2xl border border-white/5 max-h-[500px] overflow-y-auto">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">No hay mensajes recientes en esta sala.</p>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                    msg.reportado
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : 'bg-black/30 border-white/5 text-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{msg.nombreUsuario}</span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                        {msg.rol || 'pasajero'}
                      </span>
                      {msg.reportado && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px] font-bold">
                          REPORTADO
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed">{msg.texto}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('¿Eliminar este mensaje?')) {
                        await eliminarMensajeChat(activeChatChannel, msg.id);
                        showSuccessBanner('Mensaje eliminado');
                      }
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 shrink-0"
                    title="Eliminar mensaje"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: VIAJES Y TRANSPORTE ALTERNATIVO */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-cyan-400" />
            <span>Solicitudes de Transporte Alternativo (solicitudes_transporte)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {solicitudes.map((sol) => (
              <div
                key={sol.id}
                className="p-4 rounded-2xl bg-[#0f1422] border border-white/5 space-y-2.5 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold">
                      {sol.tipoVehiculoRequerido === 'moto' ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{sol.nombrePasajero}</h4>
                      <span className="text-[10px] text-slate-400">Tipo: {sol.tipoVehiculoRequerido.toUpperCase()}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      sol.estado === 'pendiente'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : sol.estado === 'aceptado'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {sol.estado.toUpperCase()}
                  </span>
                </div>

                <div className="text-xs space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Origen:</span>
                    <span className="text-slate-200 font-medium truncate max-w-[200px]">{sol.origen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destino:</span>
                    <span className="text-slate-200 font-medium truncate max-w-[200px]">{sol.destino}</span>
                  </div>
                  {sol.choferNombre && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Chofer Asignado:</span>
                      <span className="font-bold">{sol.choferNombre}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await actualizarEstadoSolicitud(sol.id, 'completado');
                      showSuccessBanner('Viaje marcado como completado');
                    }}
                    className="flex-1 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold"
                  >
                    Completar
                  </button>
                  <button
                    onClick={async () => {
                      await actualizarEstadoSolicitud(sol.id, 'cancelado');
                      showSuccessBanner('Viaje cancelado');
                    }}
                    className="h-7 px-3 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold"
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
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Dashboard y Estadísticas en Tiempo Real</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Usuarios Conectados</span>
              <span className="text-2xl font-black text-purple-300">{metricas.usuariosConectados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Reportes Activos</span>
              <span className="text-2xl font-black text-amber-300">{metricas.reportesActivos}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Viajes Solicitados</span>
              <span className="text-2xl font-black text-cyan-300">{metricas.viajesSolicitados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Viajes Completados</span>
              <span className="text-2xl font-black text-emerald-300">{metricas.viajesCompletados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase block">Tiempo Promedio</span>
              <span className="text-2xl font-black text-white">{metricas.tiempoPromedioAceptacionMinutos} min</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#0f1422] border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Reportes por Zona</h4>
              <div className="space-y-2">
                {metricas.reportesPorZona.map((z) => (
                  <div key={z.zona} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{z.zona}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">{z.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0f1422] border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Demoras por Franja Horaria</h4>
              <div className="space-y-2">
                {metricas.demorasPorHorario.map((d) => (
                  <div key={d.franja} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{d.franja}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">{d.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GRÁFICOS Y MÉTRICAS RECHARTS EN TIEMPO REAL */}
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
        <div className="max-w-xl mx-auto w-full bg-[#0f1422] border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transmitir Alerta a la Comunidad</h3>
              <p className="text-xs text-slate-400">Emite una notificación push instantánea a todos los usuarios</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Título de la Alerta</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Ej: Desvío preventivo en Colectora Panamericana"
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Mensaje / Detalle</label>
              <textarea
                value={broadcastDesc}
                onChange={(e) => setBroadcastDesc(e.target.value)}
                placeholder="Explicación del corte, desvío o aviso de emergencia..."
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
              />
            </div>

            <button
              onClick={() => {
                if (!broadcastTitle.trim()) return;
                onBroadcastAlert(broadcastTitle, broadcastDesc);
                triggerInAppPushNotification(broadcastTitle, broadcastDesc, 'admin');
                setBroadcastSent(true);
                setTimeout(() => setBroadcastSent(false), 3000);
                setBroadcastTitle('');
                setBroadcastDesc('');
                showSuccessBanner('Alerta transmitida instantáneamente por FCM y Web Push');
              }}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
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
