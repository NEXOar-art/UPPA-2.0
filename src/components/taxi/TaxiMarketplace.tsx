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
  SOLICITUD_TIMEOUT_MS,
  SOLICITUD_ACEPTADA_MAX_VISIBILITY_MS,
  subscribeToRankingChoferes,
  getCalificacionInfo,
  isDriverExpiredOver10Min,
  getDriverExpiredRemainingSeconds,
  EXPIRED_DRIVER_MAX_VISIBILITY_MS,
  RANKING_WINDOW_MS,
} from '../../services/realtimeFirebaseService';
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
  RotateCcw,
  Timer,
  Trophy,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import { PoliticasTransporteModal } from './PoliticasTransporteModal';
import { CalificarChoferModal } from './CalificarChoferModal';

interface TaxiMarketplaceProps {
  taxis: TaxiListing[];
  onOpenPublishModal: (tab?: 'transfer' | 'enter-code') => void;
  onSelectTaxiOnMap?: (taxi: TaxiListing) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserPhone?: string;
  currentUserRole?: string;
}

export const TaxiMarketplace: React.FC<TaxiMarketplaceProps> = ({
  taxis,
  onOpenPublishModal,
  onSelectTaxiOnMap,
  currentUserId = 'usr-anon',
  currentUserName = 'Pasajero',
  currentUserPhone = '',
  currentUserRole = 'passenger',
}) => {
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'auto' | 'moto'>('all');
  const [solicitudes, setSolicitudes] = useState<SolicitudTransporteFirestore[]>([]);

  // Alternative transport request modal
  const [isRequestRideOpen, setIsRequestRideOpen] = useState(false);
  const [reqOrigin, setReqOrigin] = useState('');
  const [reqDestination, setReqDestination] = useState('');
  const [reqType, setReqType] = useState<'moto' | 'auto'>('moto');
  const [isSubmittingRide, setIsSubmittingRide] = useState(false);
  const [rideSuccessNotice, setRideSuccessNotice] = useState<string | null>(null);
  const [isPoliticasOpen, setIsPoliticasOpen] = useState(false);

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
  // Solicitudes visibles en pantalla:
  // - Solicitudes pendientes (y expiradas de 12 min si esperan reemisión)
  // - Solicitudes aceptadas (viajes realizados): VISIBLES POR 16 MINUTOS exactos desde su aceptación.
  //   Pasados los 16 minutos desaparecen automáticamente para que quede limpio y entren las nuevas peticiones.
  const visibleSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      if (sol.estado === 'aceptado') {
        return !isSolicitudAceptadaExpired(sol, nowTimestamp);
      }
      return true;
    });
  }, [solicitudes, nowTimestamp]);


  const handleCreateRideRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqOrigin.trim() || !reqDestination.trim() || isSubmittingRide) return;

    setIsSubmittingRide(true);
    try {
      await crearSolicitudTransporte({
        pasajeroId: currentUserId,
        nombrePasajero: currentUserName,
        origen: reqOrigin.trim(),
        destino: reqDestination.trim(),
        tipoVehiculoRequerido: reqType,
      });
      setIsRequestRideOpen(false);
      setRideSuccessNotice('¡Solicitud de transporte creada! Temporizador de 12 minutos activo para ser aceptada por un chofer.');
      setTimeout(() => setRideSuccessNotice(null), 5000);
    } catch (e: any) {
      alert('Error al solicitar transporte: ' + e.message);
    } finally {
      setIsSubmittingRide(false);
    }
  };

  const handleAcceptRide = async (solId: string) => {
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
      setRideSuccessNotice('¡Aceptaste el viaje! Los datos fueron actualizados en tiempo real.');
      setTimeout(() => setRideSuccessNotice(null), 4000);
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

  // Prestadores visibles en pantalla:
  // - Choferes activos con tiempo restante
  // - Choferes con "Tiempo expirado": visibles HASTA 10 MINUTOS exactos
  // - Pasados los 10 minutos dejan de aparecer en pantalla
  const visibleTaxis = useMemo(() => {
    return taxis.filter((t) => {
      if (vehicleFilter !== 'all' && t.vehicleType !== vehicleFilter) {
        return false;
      }
      if (t.endsAt > nowTimestamp) {
        return true;
      }
      const expiredElapsed = nowTimestamp - t.endsAt;
      return expiredElapsed <= EXPIRED_DRIVER_MAX_VISIBILITY_MS;
    });
  }, [taxis, vehicleFilter, nowTimestamp]);

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

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Glass Header */}
      <div className="p-4 sm:p-5 border-b border-white/5 bg-[#0b0e17]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-sm">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">Taxis & Motos</h2>
              <span className="text-[11px] text-blue-300">Transporte Alternativo Colaborativo · En Tiempo Real</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRequestRideOpen(true)}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Pedir Viaje</span>
            </button>

            <button
              onClick={() => onOpenPublishModal('transfer')}
              className="px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-lg shadow-emerald-400/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Prestar Servicio</span>
            </button>
          </div>
        </div>

        {/* Hero Banner: Prestar Servicio con Transferencia, Código y Temporizador */}
        <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#0d151c] to-teal-950/30 border border-emerald-500/30 shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-400/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Habilitación de Chofer
              </span>
              <span className="text-xs font-bold text-white">
                ¿Querés prestar servicio de Moto o Auto Taxi?
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenPublishModal('transfer')}
              className="px-3 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pedir Habilitación</span>
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

        {/* Desplegable de Ranking de Prestadores */}
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-[#0c121e]/90 overflow-hidden shadow-md transition-all">
          <button
            type="button"
            onClick={() => setIsRankingDropdownOpen(!isRankingDropdownOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">
                Ranking de Prestadores
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {rankingList.length}
              </span>
            </div>

            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-amber-400">
              {isRankingDropdownOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Lista desplegable al apretar */}
          {isRankingDropdownOpen && (
            <div className="border-t border-white/5 p-2.5 bg-[#090d16]/95 animate-in slide-in-from-top-2 duration-200">
              {rankingList.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400">
                  Sin calificaciones registradas
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
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

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          <button
            onClick={() => setVehicleFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              vehicleFilter === 'all'
                ? 'bg-blue-600/30 text-blue-200 border border-blue-400/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({visibleTaxis.length})
          </button>
          <button
            onClick={() => setVehicleFilter('auto')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all ${
              vehicleFilter === 'auto'
                ? 'bg-blue-600/30 text-blue-200 border border-blue-400/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Autos ({visibleTaxis.filter((t) => t.vehicleType === 'auto').length})</span>
          </button>
          <button
            onClick={() => setVehicleFilter('moto')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all ${
              vehicleFilter === 'moto'
                ? 'bg-blue-600/30 text-blue-200 border border-blue-400/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Motos ({visibleTaxis.filter((t) => t.vehicleType === 'moto').length})</span>
          </button>
        </div>
      </div>

      {/* Alternative Transport Live Requests Carousel with 12-min acceptance and 16-min visibility */}
      {visibleSolicitudes.length > 0 && (
        <div className="p-3 sm:px-5 bg-blue-950/20 border-b border-blue-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              Solicitudes de Pasajeros ({visibleSolicitudes.filter((s) => s.estado === 'pendiente' && !isSolicitudExpired(s, nowTimestamp)).length} activas · {visibleSolicitudes.filter((s) => s.estado === 'aceptado').length} aceptadas)
            </span>
            <button
              type="button"
              onClick={() => setIsPoliticasOpen(true)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse transition-all cursor-pointer"
              title="Ver Políticas de Uso y Descargo de Responsabilidad"
            >
              <ShieldAlert className="w-3 h-3 text-amber-300" />
              <span>Políticas & Descargo</span>
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {visibleSolicitudes.map((sol) => {
              const isExpired = isSolicitudExpired(sol, nowTimestamp);
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
                      : isExpired
                      ? 'bg-[#180f14] border-rose-500/30 text-rose-200'
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

                    {sol.estado === 'pendiente' && !isExpired && (
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

                    {sol.estado === 'pendiente' && isExpired && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                        EXPIRADA (12m)
                      </span>
                    )}

                    {sol.estado === 'aceptado' && (
                      <span
                        className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0 font-mono"
                        title="Visible por 16 minutos desde la aceptación (luego desaparece para mantener limpio el panel)"
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

                  {sol.estado === 'pendiente' && !isExpired ? (
                    <button
                      onClick={() => handleAcceptRide(sol.id)}
                      className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow transition-all cursor-pointer active:scale-95"
                    >
                      <Check className="w-3 h-3" />
                      <span>Aceptar Viaje ({formattedTimer})</span>
                    </button>
                  ) : sol.estado === 'pendiente' && isExpired ? (
                    <div className="space-y-1 pt-0.5">
                      <div className="text-[10px] text-rose-300/90 flex items-center gap-1 leading-tight">
                        <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>12 min cumplidos sin chofer</span>
                      </div>
                      <button
                        onClick={() => {
                          setReqOrigin(sol.origen);
                          setReqDestination(sol.destino);
                          setReqType(sol.tipoVehiculoRequerido);
                          setIsRequestRideOpen(true);
                        }}
                        className="w-full py-1 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Emitir Nueva Solicitud</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 border-t border-emerald-500/20 flex items-center justify-between text-[10px]">
                      <p className="text-emerald-300 font-semibold truncate">
                        Chofer: {sol.choferNombre || 'Asignado'}
                      </p>
                      <span className="text-[9px] text-emerald-400/80 font-mono shrink-0 ml-1" title="Visibilidad de 16 minutos tras aceptación">
                        {acceptedMins} min restantes
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Driver Cards Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
        {visibleTaxis.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <p>No hay vehículos de esta categoría disponibles en este momento.</p>
            <button
              onClick={() => onOpenPublishModal('transfer')}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-xl font-bold text-xs"
            >
              Habilitar mi Moto o Auto Taxi
            </button>
          </div>
        ) : (
          visibleTaxis.map((taxi) => {
            const isMoto = taxi.vehicleType === 'moto';
            const isExpired = taxi.endsAt <= nowTimestamp;
            const expiredElapsed = Math.max(0, nowTimestamp - taxi.endsAt);
            const remaining10MinSec = Math.max(0, Math.ceil((EXPIRED_DRIVER_MAX_VISIBILITY_MS - expiredElapsed) / 1000));
            const expMins = Math.floor(remaining10MinSec / 60);
            const expSecs = remaining10MinSec % 60;

            return (
              <div
                key={taxi.id}
                className={`glass-card hover:bg-white/[0.06] rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                  isExpired
                    ? 'border-rose-500/30 bg-[#160d14]'
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
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-[#07090e] ${
                        isExpired ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{taxi.driverName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 font-bold uppercase tracking-wide">
                        {isMoto ? '🏍️ Moto Taxi' : '🚕 Auto Taxi'}
                      </span>
                      <div className="flex items-center gap-0.5 text-xs text-amber-300 font-mono font-semibold">
                        <Star className="w-3 h-3 fill-amber-300" />
                        <span>{taxi.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-medium">
                      {taxi.vehicleModel}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="truncate max-w-[180px]">{taxi.zone}</span>
                      </span>

                      <span>·</span>

                      {/* Countdown Timer Badge con regla de 10 minutos para expirados */}
                      <span
                        className={`flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-lg text-[10px] ${
                          isExpired
                            ? 'bg-rose-950/90 border border-rose-500/60 text-rose-300 animate-pulse'
                            : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                        }`}
                        title={
                          isExpired
                            ? 'Tiempo expirado: visible por hasta 10 minutos en pantalla antes de desaparecer'
                            : 'Temporizador de servicio pagado'
                        }
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {isExpired
                            ? `Tiempo expirado (${expMins}:${expSecs.toString().padStart(2, '0')})`
                            : `Quedan ${formatRemainingTime(taxi.endsAt)}`}
                        </span>
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

            <form onSubmit={handleCreateRideRequest} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Punto de Origen</label>
                <input
                  type="text"
                  required
                  value={reqOrigin}
                  onChange={(e) => setReqOrigin(e.target.value)}
                  placeholder="Ej: Justo Vigalondo 1419 o Parada Colectora"
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Punto de Destino</label>
                <input
                  type="text"
                  required
                  value={reqDestination}
                  onChange={(e) => setReqDestination(e.target.value)}
                  placeholder="Ej: McDonald's Panamericana Km 72.5 o Zárate Centro"
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Vehículo Requerido</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqType('moto')}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      reqType === 'moto'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-slate-900 border-white/5 text-slate-400'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto Taxi (Rápido)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqType('auto')}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      reqType === 'auto'
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
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

              <button
                type="submit"
                disabled={isSubmittingRide}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmittingRide ? 'Publicando...' : 'Emitir Solicitud a Choferes'}</span>
              </button>
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


