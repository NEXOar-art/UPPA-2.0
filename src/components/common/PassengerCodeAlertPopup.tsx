import React, { useState } from 'react';
import {
  KeyRound,
  BellRing,
  Copy,
  Check,
  MessageCircle,
  X,
  Car,
  Bike,
  ShieldCheck,
  Hand,
  Navigation,
} from 'lucide-react';
import { SolicitudTransporteFirestore, TaxiListing } from '../../types';

interface PassengerCodeAlertPopupProps {
  solicitud: SolicitudTransporteFirestore;
  matchedDriver?: TaxiListing | null;
  isBlinking: boolean;
  onDeactivateBlink: () => void;
  onDismiss: () => void;
  onGoToTaxiTab?: () => void;
}

export const PassengerCodeAlertPopup: React.FC<PassengerCodeAlertPopupProps> = ({
  solicitud,
  matchedDriver,
  isBlinking,
  onDeactivateBlink,
  onDismiss,
  onGoToTaxiTab,
}) => {
  const [copied, setCopied] = useState(false);

  const code = (solicitud.codigoSeguridad || '').trim();
  if (!code) return null;

  const driverName =
    solicitud.choferNombre || matchedDriver?.driverName || 'Tu prestador asignado';
  const isMoto =
    solicitud.tipoVehiculoRequerido === 'moto' ||
    matchedDriver?.vehicleType === 'moto';
  const cleanPhone = (solicitud.choferTelefono || matchedDriver?.whatsapp || '').replace(
    /\D/g,
    ''
  );
  const fullPhone = cleanPhone
    ? cleanPhone.startsWith('54')
      ? cleanPhone
      : `549${cleanPhone}`
    : '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeactivateBlink();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Código de viaje requerido para enviar al prestador"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[66] w-[calc(100vw-1.25rem)] max-w-md pointer-events-auto uppa-card-enter"
    >
      <div
        onClick={onDeactivateBlink}
        className={`uppa-glass-ios rounded-3xl border-2 p-3.5 sm:p-4 text-white space-y-3 cursor-pointer select-none transition-all duration-300 ${
          isBlinking
            ? 'uppa-code-popup-titilando border-[#FFF19A]'
            : 'border-[#B7F36B]/80 shadow-[0_14px_34px_rgba(0,0,0,0.75)]'
        }`}
      >
        {/* Encabezado inteligente con estado de parpadeo */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border-2 border-[#101114] transition-colors ${
                isBlinking
                  ? 'bg-[#FFF19A] text-[#101114]'
                  : 'bg-[#B7F36B] text-[#101114]'
              }`}
            >
              {isBlinking ? (
                <BellRing className="w-5 h-5 animate-bounce" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider ${
                    isBlinking
                      ? 'bg-[#FFF19A] text-[#101114]'
                      : 'bg-[#B7F36B]/20 border border-[#B7F36B]/60 text-[#B7F36B]'
                  }`}
                >
                  {isBlinking && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#101114] animate-ping" />
                  )}
                  <span>
                    {isBlinking ? 'Aviso urgente · Enviá tu código' : 'Parpadeo desactivado'}
                  </span>
                </span>
              </div>

              <h3 className="text-sm font-black text-white leading-tight pt-0.5">
                ¡{driverName} aceptó tu viaje!
              </h3>
              <p className="text-[11px] text-white/90 leading-snug">
                Necesita este <strong className="text-[#FFF19A]">código de viaje asignado</strong>{' '}
                para confirmar tu abordaje e iniciar el traslado.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeactivateBlink();
              onDismiss();
            }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contexto del vehículo y recorrido */}
        <div className="rounded-2xl bg-[#101114]/80 border border-white/12 px-3 py-2 flex items-center justify-between gap-2 text-[10.5px]">
          <div className="flex items-center gap-1.5 min-w-0 text-white/90">
            {isMoto ? (
              <Bike className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
            ) : (
              <Car className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
            )}
            <span className="font-bold truncate">
              {matchedDriver?.vehicleModel || (isMoto ? 'Moto Taxi' : 'Auto Taxi')}
            </span>
            {matchedDriver?.patente && (
              <span className="px-1.5 py-0.5 rounded bg-white text-[#101114] font-mono font-black text-[9px] uppercase shrink-0">
                {matchedDriver.patente}
              </span>
            )}
          </div>
          <span className="text-[#9299A5] truncate max-w-[52%] text-right">
            {solicitud.origen} ➔ <strong className="text-[#FFF19A]">{solicitud.destino}</strong>
          </span>
        </div>

        {/* Caja destacada con el Código de Viaje ya asignado */}
        <div className="rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/85 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#FFF19A]">
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>Tu Código de Viaje</span>
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tracking-[0.22em] text-[#FFF19A] select-all leading-none">
              {code}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            title="Copiar código de viaje"
            className={`min-h-[40px] px-3 py-2 rounded-xl border text-[11px] font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
              copied
                ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                : 'bg-[#202329] hover:bg-[#2A2E36] text-white border-white/20'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>

        {/* Acciones de envío directo */}
        <div className="flex items-center gap-2 flex-wrap">
          {fullPhone && (
            <a
              href={`https://wa.me/${fullPhone}?text=${encodeURIComponent(
                `Hola ${driverName}! Soy ${solicitud.nombrePasajero}. Te envío mi código de viaje en UPPA: ${code}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                onDeactivateBlink();
              }}
              title="Enviar código por WhatsApp al prestador"
              className="flex-1 min-w-[180px] min-h-[40px] px-3 py-2 rounded-xl uppa-cta-green font-black text-[11.5px] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Enviar ({code}) por WhatsApp</span>
            </a>
          )}

          {onGoToTaxiTab && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeactivateBlink();
                onGoToTaxiTab();
              }}
              title="Ir a Taxis & Motos"
              className={`${
                fullPhone ? 'px-3' : 'flex-1 px-3'
              } min-h-[40px] py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer`}
            >
              <Navigation className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
              <span>{fullPhone ? 'Taxis & Motos' : 'Ir a Taxis & Motos'}</span>
            </button>
          )}
        </div>

        {/* Indicador de toque para desactivar parpadeo */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeactivateBlink();
          }}
          className={`w-full py-1.5 px-3 rounded-xl text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isBlinking
              ? 'bg-[#FFF19A]/15 border border-[#FFF19A]/60 text-[#FFF19A] hover:bg-[#FFF19A]/25'
              : 'bg-white/[0.04] border border-white/10 text-[#B7F36B]'
          }`}
        >
          {isBlinking ? (
            <>
              <Hand className="w-3.5 h-3.5 shrink-0" />
              <span>Tocá este pop-up para dejar de titilar</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Parpadeo desactivado · Mostrá o enviá el código al prestador</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
