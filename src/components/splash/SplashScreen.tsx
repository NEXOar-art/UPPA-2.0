import React, { useState, useEffect } from 'react';
import uppaLogoBadge from '../../assets/images/uppa_logo_badge_1791766822917.jpg';
import { ArrowRight, Sparkles, Navigation, Bus, Bike } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Iniciando UPPA Transporte...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(55);
      setStatusText('Cargando Cartografía OpenStreetMap...');
    }, 450);

    const t2 = setTimeout(() => {
      setProgress(90);
      setStatusText('Sincronizando recorridos Campana ↔ Zárate...');
    }, 1000);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('¡Conectado a la Comunidad!');
    }, 1500);

    const t4 = setTimeout(() => {
      handleComplete();
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const handleComplete = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070b12] text-white px-4 transition-opacity duration-400 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm sm:max-w-md w-full animate-in zoom-in-95 duration-500">
        {/* Logo Badge Container with Pulsing Halo */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-cyan-500/40 via-teal-400/30 to-emerald-400/40 blur-xl animate-pulse" />
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-2 border-cyan-400/50 shadow-2xl shadow-cyan-500/30 bg-[#090d16] flex items-center justify-center p-1">
            <img
              src={uppaLogoBadge}
              alt="UPPA Comunidad Transporte Campana-Zárate"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>

        {/* Brand Titles */}
        <div className="space-y-1 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>Transporte Colaborativo</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-sans drop-shadow-md">
            UPPA
          </h1>
          <h2 className="text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300 tracking-wide uppercase">
            COMUNIDAD TRANSPORTE CAMPANA-ZARATE
          </h2>
          <p className="text-xs text-slate-400 pt-1">
            OpenStreetMap en Vivo · Recorridos 228 & Troncales · Taxis y Motos
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="w-full max-w-xs space-y-2 mb-6">
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-cyan-400/50"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
            {statusText}
          </p>
        </div>

        {/* Skip / Direct Enter Button */}
        <button
          onClick={handleComplete}
          className="group px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg backdrop-blur-md cursor-pointer hover:border-cyan-400/40"
        >
          <span>Ingresar a la Red</span>
          <ArrowRight className="w-3.5 h-3.5 text-cyan-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 text-center text-[10px] text-slate-500 font-mono">
        UPPA © 2026 · Campana ↔ Zárate · Acceso Inmediato Sin Esperas
      </div>
    </div>
  );
};
