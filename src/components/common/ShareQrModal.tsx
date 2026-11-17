import React, { useState } from 'react';
import { X, QrCode, Share2, Copy, Check, Download, Sparkles } from 'lucide-react';
import { playMicroSound } from '../../utils/soundEffects';

interface ShareQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopied?: (message: string) => void;
}

export const ShareQrModal: React.FC<ShareQrModalProps> = ({
  isOpen,
  onClose,
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://uppa.app';

  const handleCopyLink = async () => {
    playMicroSound('ui_tap');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareFeedback('¡Enlace de UPPA copiado!');
      onCopied?.('Enlace de UPPA copiado para compartir');
      setTimeout(() => {
        setCopied(false);
        setShareFeedback(null);
      }, 2500);
    } catch {
      setShareFeedback('Copiá el enlace mostrado arriba para compartirlo.');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const handleNativeShare = async () => {
    playMicroSound('ui_tap');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'UPPA · Comunidad de Transporte Zárate ↔ Campana',
          text: 'Sumate a UPPA para ver el mapa en vivo de la Línea 228, Taxis, Motos y Chat Comunitario:',
          url: shareUrl,
        });
        setShareFeedback('¡Compartido con éxito!');
        setTimeout(() => setShareFeedback(null), 2500);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#202329] border-2 border-[#B7F36B]/60 rounded-3xl p-5 shadow-[6px_6px_0px_rgba(0,0,0,0.75)] relative text-white space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#B7F36B] text-[#101114] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white uppercase tracking-tight leading-tight">
                Compartir App UPPA
              </h3>
              <p className="text-[11px] text-[#9299A5] truncate">
                Mostrá este QR a otro usuario
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar código QR"
            title="Cerrar código QR"
            className="w-9 h-9 rounded-xl bg-[#101114] hover:border-[#FFF19A] border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sección de Imagen QR */}
        <div className="rounded-2xl bg-[#101114] border-2 border-white/10 p-4 flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#202329] border border-[#FFF19A]/35 text-[10.5px] font-black text-[#FFF19A]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Escaneá con la cámara de otro celular</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border-4 border-[#B7F36B] shadow-[0_8px_24px_rgba(183,243,107,0.2)]">
            <img
              src="/assets/aistudio/QR_UPPA_da75e6d4.png"
              alt="Código QR para compartir la app UPPA"
              className="w-52 h-52 sm:w-56 sm:h-56 object-contain block"
            />
          </div>

          <p className="text-[11px] text-[#9299A5] leading-relaxed">
            Pasá este código QR para que otros vecinos accedan directo al{' '}
            <strong className="text-white">Mapa en Vivo</strong>,{' '}
            <strong className="text-white">Taxis &amp; Motos</strong> y{' '}
            <strong className="text-white">Chat Comunitario</strong>.
          </p>
        </div>

        {/* Feedback inline */}
        {shareFeedback && (
          <div className="px-3 py-2 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B]/45 text-[#B7F36B] text-xs font-black text-center">
            {shareFeedback}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartir enlace ahora</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#101114] hover:border-[#FFF19A] border-2 border-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#B7F36B]" />
                  <span className="text-[#B7F36B]">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#FFF19A]" />
                  <span>Copiar link</span>
                </>
              )}
            </button>

            <a
              href="/assets/aistudio/QR_UPPA_da75e6d4.png"
              download="QR_UPPA.png"
              onClick={() => playMicroSound('ui_tap')}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[#101114] hover:border-white border-2 border-white/15 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[#B7F36B]" />
              <span>Guardar QR</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
