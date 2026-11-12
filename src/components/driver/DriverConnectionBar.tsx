import React, { useState, useEffect } from 'react';
import { UserLocation } from '../../utils/geolocation';
import { getTimerState } from '../../services/driverActivationService';
import {
  Power,
  Radio,
  Navigation,
  Clock,
  KeyRound,
  AlertTriangle,
  RotateCw,
  Bike,
  Car,
  Sparkles,
} from 'lucide-react';

interface DriverConnectionBarProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  location: UserLocation | null;
  driverName: string;
  vehicleType: 'auto' | 'moto';
  endsAt?: number;
  activationCode?: string;
  disponibilidad?: 'desocupado' | 'ocupado';
  onToggleDisponibilidad?: () => void;
  onCenterMap: () => void;
  onOpenRenewModal?: () => void;
}

export const DriverConnectionBar: React.FC<DriverConnectionBarProps> = ({
  isOnline,
  onToggleOnline,
  location,
  driverName,
  vehicleType,
  endsAt = 0,
  activationCode,
  disponibilidad = 'desocupado',
  onToggleDisponibilidad,
  onCenterMap,
  onOpenRenewModal,
}) => {
  const [timerDisplay, setTimerDisplay] = useState(() => getTimerState(endsAt));

  useEffect(() => {
    // Tick every 1 second for live countdown
    const update = () => {
      setTimerDisplay(getTimerState(endsAt));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const isLowTime = timerDisplay.totalSeconds < 1800 && !timerDisplay.isExpired;

  return (
    <div
      className={`w-full border-b-2 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs transition-all z-20 ${
        timerDisplay.isExpired
          ? 'bg-rose-950 border-rose-500/60 text-rose-200'
          : isOnline
          ? 'bg-[#202329] border-[#B7F36B]/50 text-white'
          : 'bg-[#101114] border-white/15 text-[#9299A5]'
      }`}
    >
      {/* Driver Online/Offline toggle */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onToggleOnline}
          title={
            timerDisplay.isExpired
              ? 'Tu turno abonado expiró. Renová para seguir en línea'
              : isOnline
              ? 'Pausar transmisión GPS en vivo (pasar a Offline)'
              : 'Activar transmisión GPS en vivo (pasar a En Línea)'
          }
          className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer border-2 ${
            timerDisplay.isExpired
              ? 'bg-rose-600 border-rose-400 text-white'
              : isOnline
              ? 'bg-[#B7F36B] border-[#B7F36B] text-[#101114]'
              : 'bg-[#101114] text-[#9299A5] hover:text-white border-white/15'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>
            {timerDisplay.isExpired
              ? 'TIEMPO EXPIRADO'
              : isOnline
              ? 'CONDUCTOR EN LÍNEA'
              : 'EN PAUSA (OFFLINE)'}
          </span>
        </button>

        {/* Driver identity & vehicle */}
        <div className="flex items-center gap-1.5 text-[#9299A5]">
          <span className="font-black text-white text-xs">{driverName}</span>
          <span>·</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-white">
            {vehicleType === 'moto' ? (
              <>
                <Bike className="w-3.5 h-3.5 text-[#FFF19A]" />
                <span>Moto Taxi</span>
              </>
            ) : (
              <>
                <Car className="w-3.5 h-3.5 text-[#B7F36B]" />
                <span>Auto Taxi</span>
              </>
            )}
          </span>
        </div>

        {/* Botón de Disponibilidad (Ocupado / Desocupado) */}
        {onToggleDisponibilidad && (
          <button
            type="button"
            onClick={onToggleDisponibilidad}
            className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer border-2 ${
              disponibilidad === 'ocupado'
                ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A]'
                : 'bg-[#101114] hover:bg-white/5 border-[#B7F36B] text-[#B7F36B]'
            }`}
            title={
              disponibilidad === 'ocupado'
                ? 'Estás en estado OCUPADO. Clic para pasar a DESOCUPADO'
                : 'Estás en estado DESOCUPADO. Clic para pasar a OCUPADO'
            }
          >
            {disponibilidad === 'ocupado' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#101114] animate-pulse" />
                <span>Pasar a Desocupado</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#B7F36B]" />
                <span>Desocupado (Listo)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Real-time Countdown Timer Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-mono font-bold text-xs tracking-wider ${
            timerDisplay.isExpired
              ? 'bg-rose-950 border-rose-500 text-rose-200'
              : isLowTime
              ? 'bg-[#101114] border-[#FFF19A] text-[#FFF19A]'
              : 'bg-[#101114] border-[#B7F36B]/50 text-[#B7F36B]'
          }`}
          title="Temporizador de servicio pagado en vivo"
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[9px] uppercase text-[#9299A5] font-sans tracking-tight">
              {timerDisplay.isExpired ? 'Servicio Finalizado' : 'Tiempo Pagado'}
            </span>
            <span className="text-sm font-black">{timerDisplay.formatted}</span>
          </div>
        </div>

        {/* Activation Code Pill */}
        {activationCode && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#101114] border border-white/15 text-[#FFF19A] font-mono text-[11px]"
            title="Código de habilitación activo"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="font-bold">{activationCode}</span>
          </div>
        )}

        {/* Renew / Add hours button */}
        {onOpenRenewModal && (
          <button
            type="button"
            onClick={onOpenRenewModal}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#101114] hover:bg-white/5 text-[#FFF19A] border-2 border-[#FFF19A]/40 font-black text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            title="Renovar turno o extender horas como prestador"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden md:inline">Renovar</span>
          </button>
        )}

        {/* Center map button */}
        <button
          type="button"
          onClick={onCenterMap}
          title="Ver ubicación y centrar GPS en el mapa"
          className="min-h-[38px] px-3 py-1.5 bg-[#101114] hover:bg-white/5 border-2 border-white/15 text-white rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Navigation className="w-3 h-3 text-[#B7F36B]" />
          <span>Ver GPS</span>
        </button>
      </div>
    </div>
  );
};
