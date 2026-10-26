import React, { useState, useEffect } from 'react';
import {
  Bus,
  Bike,
  Car,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  Zap,
} from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

type ActiveVehicleStage = 'micro' | 'moto' | 'auto' | 'all';

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(10);
  const [activeStage, setActiveStage] = useState<ActiveVehicleStage>('micro');
  const [statusText, setStatusText] = useState('Iniciando UPPA...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Stage 1: Micro / Colectivos (0 - 35%)
    const t1 = setTimeout(() => {
      setProgress(35);
      setActiveStage('micro');
      setStatusText('Sincronizando Líneas de Micro & Colectivo 228...');
    }, 500);

    // Stage 2: Moto Taxi (35 - 68%)
    const t2 = setTimeout(() => {
      setProgress(68);
      setActiveStage('moto');
      setStatusText('Conectando red de Moto Taxis en tiempo real...');
    }, 1300);

    // Stage 3: Auto Taxi (68 - 92%)
    const t3 = setTimeout(() => {
      setProgress(92);
      setActiveStage('auto');
      setStatusText('Habilitando Auto Taxis y geolocalización GPS...');
    }, 2200);

    // Stage 4: All active & ready (100%)
    const t4 = setTimeout(() => {
      setProgress(100);
      setActiveStage('all');
      setStatusText('¡Transporte Colaborativo Zárate-Campana listo!');
    }, 2900);

    // Stage 5: Auto-complete precisely at 3.5 seconds (3500ms)
    const t5 = setTimeout(() => {
      handleComplete();
    }, 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  const handleComplete = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 350);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070d] text-white px-3 sm:px-4 transition-all duration-400 select-none overflow-y-auto ${
        isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Glow ambient spots that react to active vehicle stage */}
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl transition-all duration-700 ${
            activeStage === 'micro'
              ? 'bg-sky-500/20'
              : activeStage === 'moto'
              ? 'bg-cyan-400/25'
              : activeStage === 'auto'
              ? 'bg-emerald-400/20'
              : 'bg-gradient-to-r from-sky-500/25 via-cyan-400/25 to-emerald-400/25'
          }`}
        />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />

        {/* Tech Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.4) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm sm:max-w-md w-full my-auto py-4 animate-in zoom-in-95 duration-500">
        {/* OFFICIAL UPPA LOGO CARD WITH ANIMATED VEHICLE ICON OVERLAYS */}
        <div className="relative mb-5 group">
          {/* Pulsing neon outer aura */}
          <div
            className={`absolute -inset-2.5 rounded-3xl blur-xl transition-all duration-700 opacity-80 ${
              activeStage === 'micro'
                ? 'bg-sky-500/35'
                : activeStage === 'moto'
                ? 'bg-cyan-400/40'
                : activeStage === 'auto'
                ? 'bg-emerald-400/35'
                : 'bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400 opacity-90'
            }`}
          />

          {/* Central Logo Container */}
          <div className="relative w-72 sm:w-80 md:w-88 aspect-square rounded-3xl overflow-hidden border-2 border-cyan-400/40 bg-[#070b14] shadow-2xl shadow-cyan-500/25">
            {/* The official image provided by the user */}
            <img
              src="/assets/aistudio/UPPALOGO_c4c84137.jpg"
              alt="UPPA Transporte Colaborativo Zárate-Campana"
              className="w-full h-full object-cover object-center"
            />

            {/* Glowing scanning laser beam effect across the image */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-75 shadow-[0_0_15px_rgba(56,189,248,0.9)] animate-pulse"
                style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>

            {/* INTERACTIVE ANIMATED OVERLAYS OVER THE THREE ICONS (MICRO, MOTO, AUTO) */}
            {/* 1. MICRO OVERLAY (Left sector of the dock) */}
            <div
              className={`absolute top-[37%] left-[13%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'micro' || activeStage === 'all'
                  ? 'border-2 border-cyan-300 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.7)] scale-105'
                  : 'border border-transparent bg-transparent opacity-30'
              }`}
            >
              {(activeStage === 'micro' || activeStage === 'all') && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/30 to-transparent rounded-2xl animate-pulse" />
                </>
              )}
            </div>

            {/* 2. MOTO OVERLAY (Center sector of the dock) */}
            <div
              className={`absolute top-[37%] left-[39%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'moto' || activeStage === 'all'
                  ? 'border-2 border-cyan-300 bg-cyan-400/25 shadow-[0_0_22px_rgba(34,211,238,0.85)] scale-105'
                  : 'border border-transparent bg-transparent opacity-20'
              }`}
            >
              {(activeStage === 'moto' || activeStage === 'all') && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-cyan-400/30 to-transparent rounded-2xl animate-pulse" />
                </>
              )}
            </div>

            {/* 3. AUTO OVERLAY (Right sector of the dock) */}
            <div
              className={`absolute top-[37%] left-[65%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'auto' || activeStage === 'all'
                  ? 'border-2 border-emerald-300 bg-emerald-400/25 shadow-[0_0_22px_rgba(52,211,153,0.85)] scale-105'
                  : 'border border-transparent bg-transparent opacity-20'
              }`}
            >
              {(activeStage === 'auto' || activeStage === 'all') && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-400/30 to-transparent rounded-2xl animate-pulse" />
                </>
              )}
            </div>

            {/* Wave sweep effect when all ready */}
            {activeStage === 'all' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-in slide-in-from-left duration-700 pointer-events-none" />
            )}
          </div>
        </div>

        {/* DYNAMIC VEHICLE LOADING STATUS PILLS */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs sm:max-w-sm mb-4">
          {/* Micro Pill */}
          <div
            className={`p-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'micro'
                ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/30 scale-105'
                : activeStage === 'moto' || activeStage === 'auto' || activeStage === 'all'
                ? 'bg-slate-900/80 border-sky-400/30 text-sky-300'
                : 'bg-slate-900/40 border-white/5 text-slate-500'
            }`}
          >
            <div className="relative">
              <Bus className="w-5 h-5 text-sky-300" />
              {(activeStage === 'micro' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight">MICRO</span>
            <span className="text-[9px] font-mono text-slate-400">
              {activeStage === 'micro'
                ? 'Cargando...'
                : activeStage === 'moto' || activeStage === 'auto' || activeStage === 'all'
                ? '✓ 228 Conectado'
                : 'En espera'}
            </span>
          </div>

          {/* Moto Pill */}
          <div
            className={`p-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'moto'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/30 scale-105'
                : activeStage === 'auto' || activeStage === 'all'
                ? 'bg-slate-900/80 border-cyan-400/30 text-cyan-300'
                : 'bg-slate-900/40 border-white/5 text-slate-500'
            }`}
          >
            <div className="relative">
              <Bike className="w-5 h-5 text-cyan-300" />
              {(activeStage === 'moto' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight">MOTO</span>
            <span className="text-[9px] font-mono text-slate-400">
              {activeStage === 'moto'
                ? 'Cargando...'
                : activeStage === 'auto' || activeStage === 'all'
                ? '✓ Motos Activas'
                : 'En espera'}
            </span>
          </div>

          {/* Auto Pill */}
          <div
            className={`p-2 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'auto'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/30 scale-105'
                : activeStage === 'all'
                ? 'bg-slate-900/80 border-emerald-400/30 text-emerald-300'
                : 'bg-slate-900/40 border-white/5 text-slate-500'
            }`}
          >
            <div className="relative">
              <Car className="w-5 h-5 text-emerald-300" />
              {(activeStage === 'auto' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold tracking-tight">AUTO</span>
            <span className="text-[9px] font-mono text-slate-400">
              {activeStage === 'auto'
                ? 'Cargando...'
                : activeStage === 'all'
                ? '✓ Taxis en GPS'
                : 'En espera'}
            </span>
          </div>
        </div>

        {/* Progress Bar & Live Status */}
        <div className="w-full max-w-xs sm:max-w-sm space-y-2 mb-4">
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-cyan-500/20 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(56,189,248,0.7)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block shrink-0" />
              <span className="truncate">{statusText}</span>
            </span>
            <span className="font-bold text-cyan-300 shrink-0 ml-2">{progress}%</span>
          </div>
        </div>

        {/* Direct Action Button */}
        <button
          onClick={handleComplete}
          className="group px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-400/40 text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 cursor-pointer backdrop-blur-md"
        >
          <span>Ingresar a UPPA</span>
          <ArrowRight className="w-3.5 h-3.5 text-cyan-300 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 text-center text-[10px] text-slate-400 font-mono py-2">
        UPPA · Red Colaborativa Campana ↔ Zárate · Micro · Moto · Auto Taxi
      </div>
    </div>
  );
};
