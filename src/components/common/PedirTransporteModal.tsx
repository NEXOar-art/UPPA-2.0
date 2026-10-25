import React, { useState, useEffect } from 'react';
import { SolicitudTransporteFirestore } from '../../types';
import { crearSolicitudTransporte } from '../../services/realtimeFirebaseService';
import {
  X,
  Zap,
  Bike,
  Car,
  MapPin,
  Send,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { PoliticasTransporteModal } from '../taxi/PoliticasTransporteModal';

interface PedirTransporteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUserName?: string;
  initialOrigin?: string;
  onSuccess?: (solicitud: SolicitudTransporteFirestore) => void;
}

export const PedirTransporteModal: React.FC<PedirTransporteModalProps> = ({
  isOpen,
  onClose,
  currentUserId = 'usr-anonimo',
  currentUserName = 'Pasajero Comunidad UPPA',
  initialOrigin = 'Campana Centro (Plaza Eduardo Costa)',
  onSuccess,
}) => {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState<'moto' | 'auto'>('moto');
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPoliticasOpen, setIsPoliticasOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOrigen('');
      setDestino('');
      setNombre('');
      setTelefono('');
      setErrorMsg('');
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!origen.trim()) {
      setErrorMsg('Ingresá el lugar donde te encontrás.');
      return;
    }
    if (!destino.trim()) {
      setErrorMsg('Ingresá tu punto de destino.');
      return;
    }

    setIsLoading(true);
    try {
      const solicitud = await crearSolicitudTransporte({
        pasajeroId: currentUserId || `usr-${Date.now()}`,
        nombrePasajero: nombre.trim() || 'Pasajero UPPA',
        telefonoPasajero: telefono.trim(),
        origen: origen.trim(),
        destino: destino.trim(),
        tipoVehiculoRequerido: tipoVehiculo,
        precioEstimado: tipoVehiculo === 'moto' ? 2200 : 3800,
        distanciaKm: 4.8,
      });

      setSuccessMsg(
        `¡Alerta de transporte enviada! Todos los choferes habilitados de ${
          tipoVehiculo === 'moto' ? 'Moto Taxi' : 'Auto Taxi'
        } han recibido tu mensaje en tiempo real.`
      );

      if (onSuccess && solicitud) {
        onSuccess(solicitud);
      }

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir la solicitud de transporte.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0b0e17] border border-amber-500/40 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Gradient Banner */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0 gap-2">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 sm:mt-0">
              <Zap className="w-4 h-4 fill-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white font-display">
                  Pedir Transporte Alternativo
                </h2>
                {/* Botón destellando de políticas */}
                <button
                  type="button"
                  onClick={() => setIsPoliticasOpen(true)}
                  className="relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-amber-200 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all animate-pulse hover:scale-105 active:scale-95 cursor-pointer"
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
              <p className="text-[11px] text-slate-400 mt-0.5">
                Aviso prioritario: se notificará a todas las Moto Taxis y Auto Taxis activas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inconveniente Notice with 12-minute countdown rule */}
        <div className="my-3 p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 to-orange-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-bold text-amber-300">Temporizador de 12 minutos para aceptación:</span>
            <p className="text-[11px] text-slate-300">
              Al emitir la solicitud, se notifica en vivo a todos los choferes habilitados de Zárate y Campana. Dispondrán de <strong className="text-white">12 minutos</strong> para aceptarla; si transcurre ese plazo sin chofer asignado, deberás emitir una nueva solicitud.
            </p>
          </div>
        </div>

        {/* Error / Success messages */}
        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
          {/* Vehículo Requerido */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              ¿Qué transporte necesitás?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoVehiculo('moto')}
                className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                  tipoVehiculo === 'moto'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-1 ring-amber-400 shadow-md'
                    : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Moto Taxi (Rápido)</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoVehiculo('auto')}
                className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                  tipoVehiculo === 'auto'
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400 shadow-md'
                    : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Auto Taxi</span>
              </button>
            </div>
          </div>

          {/* Origen y Destino */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>¿Dónde estás? (Origen)</span>
              </label>
              <input
                type="text"
                required
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="Ej: Justo Vigalondo 1419 o Plaza Eduardo Costa"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>¿Hacia dónde vas? (Destino)</span>
              </label>
              <input
                type="text"
                required
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Ej: McDonald's Panamericana Km 72.5 o Zárate Centro"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Nombre y Contacto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tu Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Laura"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                WhatsApp o Teléfono (Opcional)
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3489 123456"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>

          {/* Botón de Envío */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !!successMsg}
              className="w-full h-11 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-97 transition-all cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4 fill-slate-950" />
              <span>
                {isLoading
                  ? 'Emitiendo aviso a los choferes...'
                  : 'Emitir Pedido de Transporte Alternativo'}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Se alertará en tiempo real en la pantalla de todas las Moto Taxi y Auto Taxi habilitadas en la zona.
            </p>
          </div>
        </form>
      </div>

      {/* Politicas & Descargo Modal */}
      <PoliticasTransporteModal
        isOpen={isPoliticasOpen}
        onClose={() => setIsPoliticasOpen(false)}
      />
    </div>
  );
};
