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
    solicitud.choferNombre || matchedDriver?.driverName || 'Tu prestador';
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
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[66] w-[calc(100vw-1.5rem)] max-w-[338px] sm:max-w-[360px] pointer-events-auto uppa-card-enter"
    >
      <div
        onClick={onDeactivateBlink}
        className={`uppa-glass-ios rounded-2xl border-2 p-2.5 sm:p-3 text-white space-y-2 cursor-pointer select-none transition-all duration-300 ${
          isBlinking
            ? 'uppa-code-popup-titilando border-[#FFF19A]'
            : 'border-[#B7F36B]/80 shadow-[0_12px_28px_rgba(0,0,0,0.75)]'
        }`}
      >
        {/* Cabecera resumida */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border border-[#101114] transition-colors ${
                isBlinking
                  ? 'bg-[#FFF19A] text-[#101114]'
                  : 'bg-[#B7F36B] text-[#101114]'
              }`}
            >
              {isBlinking ? (
                <BellRing className="w-4 h-4 animate-bounce" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black text-white truncate">
                  ¡{driverName} aceptó!
                </h3>
                <span
                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase shrink-0 ${
                    isBlinking
                      ? 'bg-[#FFF19A] text-[#101114]'
                      : 'bg-[#B7F36B]/20 text-[#B7F36B] border border-[#B7F36B]/50'
                  }`}
                >
                  {isBlinking ? 'Atención' : 'Visto'}
                </span>
              </div>
              <p className="text-[10.5px] text-white/85 truncate leading-tight flex items-center gap-1">
                {isMoto ? (
                  <Bike className="w-3 h-3 text-[#FFF19A] shrink-0" />
                ) : (
                  <Car className="w-3 h-3 text-[#B7F36B] shrink-0" />
                )}
                <span className="truncate">
                  Enviá este código · ➔ <strong className="text-[#FFF19A]">{solicitud.destino}</strong>
                </span>
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
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Código asignado + Acciones compactas */}
        <div className="rounded-xl bg-[#101114] border border-[#FFF19A]/80 px-2.5 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#FFF19A]">
              <KeyRound className="w-3 h-3 shrink-0" />
              <span>Código de viaje</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-[0.2em] text-[#FFF19A] select-all leading-tight">
              {code}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar código"
              className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                copied
                  ? 'bg-[#B7F36B] text-[#101114] border-[#101114]'
                  : 'bg-[#202329] hover:bg-[#2A2E36] text-white border-white/20'
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Listo' : 'Copiar'}</span>
            </button>

            {fullPhone ? (
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
                title="Enviar código por WhatsApp"
                className="min-h-[34px] px-2.5 py-1 rounded-lg uppa-cta-green font-black text-[10.5px] flex items-center gap-1 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Enviar</span>
              </a>
            ) : (
              onGoToTaxiTab && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeactivateBlink();
                    onGoToTaxiTab();
                  }}
                  title="Ir a Taxis & Motos"
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[10.5px] cursor-pointer"
                >
                  Ver viaje
                </button>
              )
            )}
          </div>
        </div>

        {/* Pie táctil para desactivar el parpadeo */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeactivateBlink();
          }}
          className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isBlinking
              ? 'bg-[#FFF19A]/15 border border-[#FFF19A]/60 text-[#FFF19A] hover:bg-[#FFF19A]/25'
              : 'bg-white/[0.04] border border-white/10 text-[#B7F36B]'
          }`}
        >
          {isBlinking ? (
            <>
              <Hand className="w-3 h-3 shrink-0" />
              <span>Tocá para dejar de titilar</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 shrink-0" />
              <span>Parpadeo desactivado · Enviá el código</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
