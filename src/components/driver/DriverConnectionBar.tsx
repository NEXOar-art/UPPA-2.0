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
  onCenterMap: () => void;
  onOpenRenewModal?: () => void;
}

export const DriverConnectionBar: React.FC<DriverConnectionBarProps> = ({
  isOnline,
  onToggleOnline,
  location,
  driverName,
  vehicleType,
  endsAt = Date.now() + 12 * 3600 * 1000,
  activationCode,
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
      className={`w-full border-b px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xl transition-all z-20 ${
        timerDisplay.isExpired
          ? 'bg-rose-950/90 border-rose-600/50 text-rose-200'
          : isOnline
          ? 'bg-[#0a0d14]/95 border-emerald-500/50 text-slate-200 backdrop-blur-xl'
          : 'bg-[#0a0d14]/95 border-slate-700/60 text-slate-400'
      }`}
    >
      {/* Driver Online/Offline toggle */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleOnline}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm cursor-pointer ${
            timerDisplay.isExpired
              ? 'bg-rose-700 text-white'
              : isOnline
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-emerald-500/25 ring-1 ring-emerald-300'
              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
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
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="font-bold text-white text-xs">{driverName}</span>
          <span className="text-slate-500">·</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
            {vehicleType === 'moto' ? (
              <>
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <span>Moto Taxi</span>
              </>
            ) : (
              <>
                <Car className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto Taxi</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Real-time Countdown Timer Badge */}
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs tracking-wider shadow-inner ${
            timerDisplay.isExpired
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
              : isLowTime
              ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}
          title="Temporizador de servicio pagado"
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[9px] uppercase text-slate-400 font-sans tracking-tight">
              {timerDisplay.isExpired ? 'Servicio Finalizado' : 'Tiempo Pagado'}
            </span>
            <span className="text-sm font-extrabold">{timerDisplay.formatted}</span>
          </div>
        </div>

        {/* Activation Code Pill */}
        {activationCode && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-200 font-mono text-[11px]"
            title="Código de habilitación activo"
          >
            <KeyRound className="w-3.5 h-3.5 text-purple-300" />
            <span className="font-semibold">{activationCode}</span>
          </div>
        )}

        {/* Renew / Add hours button */}
        {onOpenRenewModal && (
          <button
            onClick={onOpenRenewModal}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            title="Renovar o ingresar otro código"
          >
            <RotateCw className="w-3 h-3" />
            <span className="hidden md:inline">Renovar</span>
          </button>
        )}

        {/* Center map button */}
        <button
          onClick={onCenterMap}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Navigation className="w-3 h-3 text-cyan-400" />
          <span>Ver GPS</span>
        </button>
      </div>
    </div>
  );
};
