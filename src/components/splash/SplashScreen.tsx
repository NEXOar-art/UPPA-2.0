import React, { useState, useEffect } from 'react';
import { Bus, Bike, Car, ArrowRight } from 'lucide-react';

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
    const t1 = setTimeout(() => {
      setProgress(35);
      setActiveStage('micro');
      setStatusText('Sincronizando Líneas de Micro & Colectivo 228...');
    }, 500);

    const t2 = setTimeout(() => {
      setProgress(68);
      setActiveStage('moto');
      setStatusText('Conectando red de Moto Taxis en tiempo real...');
    }, 1300);

    const t3 = setTimeout(() => {
      setProgress(92);
      setActiveStage('auto');
      setStatusText('Habilitando Auto Taxis y geolocalización GPS...');
    }, 2200);

    const t4 = setTimeout(() => {
      setProgress(100);
      setActiveStage('all');
      setStatusText('¡Transporte Colaborativo Zárate-Campana listo!');
    }, 2900);

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#101114] text-white px-3 sm:px-4 transition-all duration-400 select-none overflow-y-auto ${
        isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Automotive Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #FFF19A 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm sm:max-w-md w-full my-auto py-4 animate-in zoom-in-95 duration-500">
        {/* OFFICIAL UPPA LOGO CARD */}
        <div className="relative mb-5 group">
          <div className="relative w-72 sm:w-80 md:w-88 aspect-square rounded-3xl overflow-hidden border-2 border-[#FFF19A]/50 bg-[#202329] shadow-[6px_6px_0px_#000000]">
            <img
              src="/assets/aistudio/UPPALOGO_c4c84137.jpg"
              alt="UPPA Transporte Colaborativo Zárate-Campana"
              className="w-full h-full object-cover object-center"
            />

            {/* MICRO OVERLAY */}
            <div
              className={`absolute top-[37%] left-[13%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'micro' || activeStage === 'all'
                  ? 'border-2 border-[#FFF19A] bg-[#FFF19A]/15 scale-105'
                  : 'border border-transparent bg-transparent opacity-30'
              }`}
            >
              {(activeStage === 'micro' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFF19A] opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFF19A]" />
                </span>
              )}
            </div>

            {/* MOTO OVERLAY */}
            <div
              className={`absolute top-[37%] left-[39%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'moto' || activeStage === 'all'
                  ? 'border-2 border-[#B7F36B] bg-[#B7F36B]/15 scale-105'
                  : 'border border-transparent bg-transparent opacity-20'
              }`}
            >
              {(activeStage === 'moto' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B7F36B] opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B7F36B]" />
                </span>
              )}
            </div>

            {/* AUTO OVERLAY */}
            <div
              className={`absolute top-[37%] left-[65%] w-[25%] h-[25%] rounded-2xl pointer-events-none transition-all duration-500 flex items-center justify-center ${
                activeStage === 'auto' || activeStage === 'all'
                  ? 'border-2 border-[#FFF19A] bg-[#FFF19A]/15 scale-105'
                  : 'border border-transparent bg-transparent opacity-20'
              }`}
            >
              {(activeStage === 'auto' || activeStage === 'all') && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B7F36B] opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B7F36B]" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* VEHICLE LOADING STATUS CARDS */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs sm:max-w-sm mb-4">
          <div
            className={`p-2 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'micro'
                ? 'bg-[#202329] border-[#FFF19A] text-[#FFF19A] scale-105'
                : activeStage === 'moto' || activeStage === 'auto' || activeStage === 'all'
                ? 'bg-[#202329] border-[#B7F36B]/50 text-[#B7F36B]'
                : 'bg-[#202329]/50 border-white/10 text-[#9299A5]'
            }`}
          >
            <Bus className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-tight">MICRO</span>
            <span className="text-[9px] font-mono">
              {activeStage === 'micro'
                ? 'Cargando...'
                : activeStage === 'moto' || activeStage === 'auto' || activeStage === 'all'
                ? '✓ 228 Activo'
                : 'En espera'}
            </span>
          </div>

          <div
            className={`p-2 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'moto'
                ? 'bg-[#202329] border-[#FFF19A] text-[#FFF19A] scale-105'
                : activeStage === 'auto' || activeStage === 'all'
                ? 'bg-[#202329] border-[#B7F36B]/50 text-[#B7F36B]'
                : 'bg-[#202329]/50 border-white/10 text-[#9299A5]'
            }`}
          >
            <Bike className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-tight">MOTO</span>
            <span className="text-[9px] font-mono">
              {activeStage === 'moto'
                ? 'Cargando...'
                : activeStage === 'auto' || activeStage === 'all'
                ? '✓ Motos GPS'
                : 'En espera'}
            </span>
          </div>

          <div
            className={`p-2 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${
              activeStage === 'auto'
                ? 'bg-[#202329] border-[#FFF19A] text-[#FFF19A] scale-105'
                : activeStage === 'all'
                ? 'bg-[#202329] border-[#B7F36B]/50 text-[#B7F36B]'
                : 'bg-[#202329]/50 border-white/10 text-[#9299A5]'
            }`}
          >
            <Car className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-tight">AUTO</span>
            <span className="text-[9px] font-mono">
              {activeStage === 'auto'
                ? 'Cargando...'
                : activeStage === 'all'
                ? '✓ Taxis GPS'
                : 'En espera'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xs sm:max-w-sm space-y-2 mb-4">
          <div className="w-full h-2.5 bg-[#202329] rounded-full overflow-hidden p-0.5 border border-white/15">
            <div
              className="h-full bg-[#FFF19A] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-white">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-[#B7F36B] animate-ping inline-block shrink-0" />
              <span className="truncate">{statusText}</span>
            </span>
            <span className="font-black text-[#FFF19A] shrink-0 ml-2">{progress}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleComplete}
          title="Omitir animación inicial e ingresar directamente a UPPA"
          className="group px-6 min-h-[44px] rounded-xl uppa-cta-yellow font-black text-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Ingresar a UPPA</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="relative z-10 text-center text-[10px] text-[#9299A5] font-mono py-2">
        UPPA · Red Colaborativa Campana ↔ Zárate · Micro · Moto · Auto Taxi
      </div>
    </div>
  );
};
