import React, { useState, useEffect, useRef } from 'react';
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
  userLocation?: { lat: number; lng: number; address?: string } | null;
  onSuccess?: (solicitud: SolicitudTransporteFirestore) => void;
}

export const PedirTransporteModal: React.FC<PedirTransporteModalProps> = ({
  isOpen,
  onClose,
  currentUserId = 'usr-anonimo',
  currentUserName = 'Pasajero Comunidad UPPA',
  initialOrigin = 'Campana Centro (Plaza Eduardo Costa)',
  userLocation,
  onSuccess,
}) => {
  const [origen, setOrigen] = useState(initialOrigin);
  const [destino, setDestino] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState<'moto' | 'auto'>('moto');
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState(currentUserName !== 'Pasajero' ? currentUserName : '');
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPoliticasOpen, setIsPoliticasOpen] = useState(false);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setOrigen(initialOrigin || '');
      setDestino('');
      setNombre(currentUserName && currentUserName !== 'Pasajero' ? currentUserName : '');
      setTelefono('');
      setErrorMsg('');
      setSuccessMsg(null);
      setAceptaPoliticas(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialOrigin, currentUserName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!origen.trim()) {
      setErrorMsg('Ingresá el lugar donde te encontrás en el campo "¿Dónde estás? (Origen)".');
      return;
    }
    if (!destino.trim()) {
      setErrorMsg('Ingresá el punto hacia donde vas en el campo "¿Hacia dónde vas? (Destino)".');
      return;
    }
    if (!aceptaPoliticas) {
      setErrorMsg('Debés aceptar la "Política & Descargo" para poder emitir el pedido de transporte alternativo.');
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
        origenCoords: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#202329] border-2 border-white/20 rounded-3xl p-5 sm:p-6 text-white shadow-[0_8px_0_rgba(0,0,0,0.65)] relative overflow-hidden flex flex-col max-h-[92vh]">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFF19A]" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0 gap-2">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#101114] border border-[#FFF19A]/50 flex items-center justify-center text-[#FFF19A] shrink-0">
              <Zap className="w-4 h-4 fill-[#FFF19A]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white font-display">
                  Pedir Transporte Alternativo
                </h2>
                <button
                  type="button"
                  onClick={() => setIsPoliticasOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-[#101114] bg-[#FFF19A] hover:brightness-105 border border-white transition-all cursor-pointer"
                  title="Leer Políticas de Uso y Descargo de Responsabilidad antes de pedir viaje"
                >
                  <ShieldAlert className="w-3 h-3 text-[#101114]" />
                  <span>Políticas & Descargo</span>
                </button>
              </div>
              <p className="text-[11px] text-[#9299A5] mt-0.5">
                Privacidad protegida: solo el chofer que acepte verá tu GPS y WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Cerrar formulario de pedido de transporte"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-3 p-3 rounded-2xl bg-[#101114] border border-[#FFF19A]/35 text-xs flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-[#FFF19A] shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-bold text-[#FFF19A]">Temporizador de 12 minutos para aceptación:</span>
            <p className="text-[11px] text-[#9299A5]">
              Tu solicitud se emite a choferes habilitados de Zárate y Campana por <strong className="text-white">12 minutos</strong>. Tu ubicación GPS exacta y código de abordaje quedan protegidos hasta que un prestador acepte tu viaje.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-3 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B]/50 text-[#B7F36B] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
          <div>
            <label className="block text-[11px] font-bold text-white mb-1.5 uppercase tracking-wider">
              ¿Qué transporte necesitás?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoVehiculo('moto')}
                title="Seleccionar Moto Taxi para viaje rápido"
                className={`min-h-[48px] p-3 rounded-2xl border-2 text-center transition-all flex items-center justify-center gap-2 font-extrabold text-xs cursor-pointer ${
                  tipoVehiculo === 'moto'
                    ? 'bg-[#FFF19A] border-white text-[#101114] shadow-[0_3px_0_#0A0B0D]'
                    : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Moto Taxi</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoVehiculo('auto')}
                title="Seleccionar Auto Taxi para viaje en automóvil"
                className={`min-h-[48px] p-3 rounded-2xl border-2 text-center transition-all flex items-center justify-center gap-2 font-extrabold text-xs cursor-pointer ${
                  tipoVehiculo === 'auto'
                    ? 'bg-[#B7F36B] border-white text-[#101114] shadow-[0_3px_0_#0A0B0D]'
                    : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Auto Taxi</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#B7F36B]" />
                  <span>¿Dónde estás? (Origen)</span>
                </label>
                {origen && (
                  <button
                    type="button"
                    onClick={() => setOrigen('')}
                    className="text-[10px] text-[#9299A5] hover:text-[#FFF19A] transition-colors cursor-pointer"
                    title="Limpiar campo de dirección de origen"
                  >
                    Borrar texto
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                autoComplete="off"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="Escribí dónde te encontrás (ej: Justo Vigalondo 1419, Plaza Costa...)"
                className="w-full min-h-[44px] bg-[#101114] border border-white/15 focus:border-[#FFF19A] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#9299A5] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FFF19A]" />
                  <span>¿Hacia dónde vas? (Destino)</span>
                </label>
                {destino && (
                  <button
                    type="button"
                    onClick={() => setDestino('')}
                    className="text-[10px] text-[#9299A5] hover:text-[#FFF19A] transition-colors cursor-pointer"
                    title="Limpiar campo de dirección de destino"
                  >
                    Borrar texto
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                autoComplete="off"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Escribí hacia dónde vas (ej: McDonald's Panamericana Km 72.5...)"
                className="w-full min-h-[44px] bg-[#101114] border border-white/15 focus:border-[#FFF19A] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#9299A5] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-white mb-1">
                Tu Nombre
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Laura"
                className="w-full min-h-[44px] bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white mb-1">
                WhatsApp o Teléfono (Para recibir al chofer)
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3489 123456"
                className="w-full min-h-[44px] bg-[#101114] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] font-mono"
              />
            </div>
          </div>

          <div
            className={`p-3 rounded-2xl border transition-all ${
              aceptaPoliticas
                ? 'bg-[#101114] border-[#FFF19A]'
                : 'bg-[#101114] border-white/15 hover:border-[#FFF19A]/40'
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceptaPoliticas}
                onChange={(e) => {
                  setAceptaPoliticas(e.target.checked);
                  if (e.target.checked && errorMsg.includes('Política')) {
                    setErrorMsg('');
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded border-white/20 accent-[#FFF19A] cursor-pointer"
              />
              <div className="text-xs text-[#9299A5] leading-snug">
                <span className="text-white">He leído y acepto la </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPoliticasOpen(true);
                  }}
                  title="Abrir documento completo de Política & Descargo de Responsabilidad"
                  className="font-bold text-[#FFF19A] hover:underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#FFF19A] inline" />
                  <span>Política & Descargo</span>
                </button>
                <span className="text-[#9299A5] block text-[11px] mt-0.5">
                  Obligatorio para emitir la solicitud a los prestadores habilitados.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || !!successMsg || !aceptaPoliticas || !origen.trim() || !destino.trim()}
              title="Enviar solicitud de transporte alternativo con temporizador de 12 minutos"
              className={`w-full h-12 font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all ${
                !aceptaPoliticas || !origen.trim() || !destino.trim() || isLoading
                  ? 'bg-[#101114] text-[#9299A5] border border-white/10 cursor-not-allowed opacity-60'
                  : 'uppa-cta-yellow cursor-pointer'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isLoading
                  ? 'Emitiendo aviso a los choferes...'
                  : 'Emitir Pedido de Transporte Alternativo'}
              </span>
            </button>
            {!aceptaPoliticas && (
              <p className="text-[10.5px] text-[#FFF19A] text-center mt-2 flex items-center justify-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Debés aceptar la "Política & Descargo" para poder emitir el pedido.</span>
              </p>
            )}
          </div>
        </form>
      </div>

      <PoliticasTransporteModal
        isOpen={isPoliticasOpen}
        onClose={() => setIsPoliticasOpen(false)}
      />
    </div>
  );
};
