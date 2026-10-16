import React, { useState, useEffect } from 'react';
import { TaxiListing, SolicitudTransporteFirestore } from '../../types';
import {
  subscribeToSolicitudesTransporte,
  crearSolicitudTransporte,
  aceptarSolicitudTransporte,
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
  Navigation,
  KeyRound,
  Sparkles,
  ArrowRight,
  Send,
  Zap,
  Check,
  X,
} from 'lucide-react';

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
  const [reqOrigin, setReqOrigin] = useState('Justo Vigalondo 1419 (B° Malvinas)');
  const [reqDestination, setReqDestination] = useState("McDonald's Campana / Colectora Km 72.5");
  const [reqType, setReqType] = useState<'moto' | 'auto'>('moto');
  const [isSubmittingRide, setIsSubmittingRide] = useState(false);
  const [rideSuccessNotice, setRideSuccessNotice] = useState<string | null>(null);

  // Subscribe to alternative transport requests in real-time
  useEffect(() => {
    const unsub = subscribeToSolicitudesTransporte((list) => {
      setSolicitudes(list);
    });
    return () => unsub();
  }, []);

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
      setRideSuccessNotice('¡Solicitud de transporte creada! Los choferes cercanos fueron notificados.');
      setTimeout(() => setRideSuccessNotice(null), 4000);
    } catch (e: any) {
      alert('Error al solicitar transporte: ' + e.message);
    } finally {
      setIsSubmittingRide(false);
    }
  };

  const handleAcceptRide = async (solId: string) => {
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

  const filteredTaxis = taxis.filter(
    (t) => t.status === 'active' && (vehicleFilter === 'all' || t.vehicleType === vehicleFilter)
  );

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
            <p className="text-[11px] text-slate-300 max-w-xl leading-relaxed">
              Realizá la transferencia a Alias: <strong className="text-emerald-300 font-mono">luciaveronicag</strong> (CVU: <span className="font-mono text-emerald-200">0000003100020253501840</span> - Titular: <strong className="text-white">Lucia Veronica Gimenez</strong>). Adjuntá el comprobante al WhatsApp <strong className="text-emerald-300 font-mono">3489690058</strong>. El administrador lo habilita con clave <strong className="text-white">0608</strong> y arranca el temporizador en vivo.
            </p>
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
            Todos ({taxis.filter((t) => t.status === 'active').length})
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
            <span>Autos ({taxis.filter((t) => t.status === 'active' && t.vehicleType === 'auto').length})</span>
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
            <span>Motos ({taxis.filter((t) => t.status === 'active' && t.vehicleType === 'moto').length})</span>
          </button>
        </div>
      </div>

      {/* Alternative Transport Live Requests Carousel */}
      {solicitudes.length > 0 && (
        <div className="p-3 sm:px-5 bg-blue-950/20 border-b border-blue-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              Solicitudes Activas de Pasajeros en Espera ({solicitudes.filter((s) => s.estado === 'pendiente').length})
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {solicitudes.map((sol) => (
              <div
                key={sol.id}
                className={`p-3 rounded-xl border text-xs min-w-[260px] max-w-[300px] shrink-0 space-y-1.5 ${
                  sol.estado === 'pendiente'
                    ? 'bg-[#0f1424] border-amber-500/30 text-slate-200'
                    : 'bg-[#0c1322] border-blue-500/30 text-blue-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    {sol.tipoVehiculoRequerido === 'moto' ? <Bike className="w-3.5 h-3.5 text-amber-300" /> : <Car className="w-3.5 h-3.5 text-cyan-300" />}
                    <span>{sol.nombrePasajero}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      sol.estado === 'pendiente'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {sol.estado}
                  </span>
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
                    <span>Aceptar Viaje Ahora</span>
                  </button>
                ) : (
                  <p className="text-[10px] text-emerald-300 font-semibold truncate">
                    Chofer: {sol.choferNombre || 'Asignado'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver Cards Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
        {filteredTaxis.length === 0 ? (
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
          filteredTaxis.map((taxi) => {
            const isMoto = taxi.vehicleType === 'moto';
            const isExpired = taxi.endsAt <= Date.now();
            return (
              <div
                key={taxi.id}
                className="glass-card hover:bg-white/[0.06] rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-blue-500/20 bg-[#0d121f]"
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
                        isExpired ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
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

                      {/* Countdown Timer Badge */}
                      <span
                        className={`flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-lg text-[10px] ${
                          isExpired
                            ? 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                            : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                        }`}
                        title="Temporizador de servicio pagado"
                      >
                        <Clock className="w-3 h-3" />
                        <span>{isExpired ? 'Tiempo expirado' : `Quedan ${formatRemainingTime(taxi.endsAt)}`}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Button */}
                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
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
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Solicitud de Transporte Alternativo</h3>
                  <p className="text-[11px] text-slate-400">Cuando quedás sin micro o necesitás traslado urgente</p>
                </div>
              </div>
              <button onClick={() => setIsRequestRideOpen(false)} className="p-1 rounded-full text-slate-400 hover:text-white">
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

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[11px] text-blue-200">
                📢 Tu solicitud será emitida instantáneamente vía Firebase a los choferes habilitados en Zárate y Campana.
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
    </div>
  );
};

